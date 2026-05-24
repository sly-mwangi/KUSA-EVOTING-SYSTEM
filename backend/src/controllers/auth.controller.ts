import type { Request, Response } from "express";
import { db, usersTable, otpsTable, studentRecordsTable } from "@workspace/db";
import { and, eq, gt, isNull } from "drizzle-orm";
import {
  generateOtp,
  hashOtp,
  hashPassword,
  loadUserProfile,
  signToken,
  verifyPassword,
} from "../lib/auth.js";
import { isEmailConfigured, sendOtpEmail } from "../lib/email.js";
import { audit } from "../lib/audit.js";

const REG_NUMBER_REGEX = /^[A-Z]+\d+[A-Z]?\/\d+\/\d{4}$/;
const OTP_TTL_MS = 10 * 60 * 1000;
const REGISTRATION_VALID_MONTHS = 11;

function suggestEmailFromRegNumber(regNo: string): string | null {
  const match = regNo.match(/^[A-Z]{1,2}\d+\/(\d+)\/(\d{4})$/);
  if (!match) return null;
  return `${match[1]}.${match[2]}@students.ku.ac.ke`;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters long";
  if (!/[A-Z]/.test(password))
    return "Password must contain at least one uppercase letter (A-Z)";
  if (!/[a-z]/.test(password))
    return "Password must contain at least one lowercase letter (a-z)";
  if (!/[0-9]/.test(password))
    return "Password must contain at least one number (0-9)";
  if (!/[^A-Za-z0-9]/.test(password))
    return "Password must contain at least one special character (e.g. !@#$%^&*)";
  return null;
}

async function issueOtp(
  email: string,
  purpose: "registration" | "password_reset",
) {
  const code = generateOtp();
  const codeHash = hashOtp(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await db.insert(otpsTable).values({ email, codeHash, purpose, expiresAt });
  try {
    await sendOtpEmail(email, code, purpose);
  } catch {
    // swallow
  }
  return { code };
}

async function consumeOtp(
  email: string,
  code: string,
  purpose: "registration" | "password_reset",
): Promise<boolean> {
  const codeHash = hashOtp(code);
  const rows = await db
    .select()
    .from(otpsTable)
    .where(
      and(
        eq(otpsTable.email, email),
        eq(otpsTable.codeHash, codeHash),
        eq(otpsTable.purpose, purpose),
        isNull(otpsTable.consumedAt),
        gt(otpsTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  const otp = rows[0];
  if (!otp) return false;
  await db
    .update(otpsTable)
    .set({ consumedAt: new Date() })
    .where(eq(otpsTable.id, otp.id));
  return true;
}

// GET /auth/prefill?regNumber=J31/4338/2022
// Looks up the university student_records table — the single source of truth.
export async function prefillRegistration(req: Request, res: Response) {
  const regNumberParam = ((req.query.regNumber as string) ?? "")
    .trim()
    .toUpperCase();

  if (!regNumberParam) {
    res.status(400).json({ message: "regNumber query parameter is required" });
    return;
  }
  if (!REG_NUMBER_REGEX.test(regNumberParam)) {
    res.status(400).json({
      message:
        "Invalid registration number format. Expected J31/4338/2022 or J31S/4338/2022",
    });
    return;
  }

  const studentRows = await db
    .select()
    .from(studentRecordsTable)
    .where(eq(studentRecordsTable.registrationNumber, regNumberParam))
    .limit(1);

  const student = studentRows[0];

  if (!student) {
    res.json({
      notInDatabase: true,
      exists: false,
      feeCleared: false,
      suggestedEmail: suggestEmailFromRegNumber(regNumberParam),
    });
    return;
  }

  const feeBalance = parseFloat(student.feeBalance ?? "0");
  const feeCleared = feeBalance === 0;

  const userRows = await db
    .select({ id: usersTable.id, status: usersTable.status })
    .from(usersTable)
    .where(eq(usersTable.email, student.email))
    .limit(1);
  const alreadyActive = userRows[0]?.status === "active";

  res.json({
    notInDatabase: false,
    exists: true,
    feeCleared,
    feeBalance,
    name: student.name,
    gender: student.gender,
    schoolId: student.schoolId,
    departmentId: student.departmentId,
    courseId: student.courseId,
    hostelId: student.hostelId ?? null,
    yearOfStudy: student.yearOfStudy,
    suggestedEmail: student.email,
    registrationNumber: student.registrationNumber,
    alreadyActive,
  });
}

export async function register(req: Request, res: Response) {
  const { password, registrationNumber, hostelId } = (req.body ?? {}) as Record<
    string,
    string
  >;

  if (!registrationNumber) {
    res
      .status(400)
      .json({ message: "Registration number is required to register" });
    return;
  }

  const regNo = registrationNumber.trim().toUpperCase();

  if (!REG_NUMBER_REGEX.test(regNo)) {
    res.status(400).json({
      message:
        "Registration number must be in the format J31/4338/2022 or J31S/4338/2022",
    });
    return;
  }

  if (!password) {
    res.status(400).json({ message: "Password is required" });
    return;
  }

  const pwError = validatePasswordStrength(password);
  if (pwError) {
    res.status(400).json({ message: pwError, code: "WEAK_PASSWORD" });
    return;
  }

  // Authoritative lookup — student must exist in the university database
  const studentRows = await db
    .select()
    .from(studentRecordsTable)
    .where(eq(studentRecordsTable.registrationNumber, regNo))
    .limit(1);

  const student = studentRows[0];

  if (!student) {
    res.status(403).json({
      message:
        "Your registration number is not in the KU student database. Please contact the Registrar's Office.",
      code: "NOT_IN_DATABASE",
    });
    return;
  }

  const feeBalance = parseFloat(student.feeBalance ?? "0");
  if (feeBalance > 0) {
    res.status(403).json({
      message: `Your fee balance of KES ${feeBalance.toLocaleString()} is not cleared. Please visit the Finance Office before registering.`,
      code: "FEE_NOT_CLEARED",
    });
    return;
  }

  const email = student.email;

  const existingRows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  const existing = existingRows[0];

  if (existing?.status === "active") {
    res.status(409).json({
      message:
        "An account with this registration number already exists. Please sign in.",
    });
    return;
  }

  const expiresAt = addMonths(new Date(), REGISTRATION_VALID_MONTHS);
  const chosenHostel = hostelId || student.hostelId || null;

  if (existing) {
    await db
      .update(usersTable)
      .set({
        name: student.name,
        passwordHash: await hashPassword(password),
        gender: student.gender,
        courseId: student.courseId,
        hostelId: chosenHostel,
        registrationNumber: regNo,
        registrationExpiresAt: expiresAt,
        feeStatus: "cleared",
      })
      .where(eq(usersTable.id, existing.id));
  } else {
    await db.insert(usersTable).values({
      name: student.name,
      email,
      passwordHash: await hashPassword(password),
      role: "student",
      status: "pending_otp",
      gender: student.gender,
      courseId: student.courseId,
      hostelId: chosenHostel,
      registrationNumber: regNo,
      registrationExpiresAt: expiresAt,
      feeStatus: "cleared",
    });
  }

  const otp = await issueOtp(email, "registration");
  await audit({
    action: "user.register",
    actorEmail: email,
    actorRole: "student",
    target: email,
  });
  res.status(201).json({
    message: "Verification code sent to your university email",
    email,
  });
}

export async function verifyOtp(req: Request, res: Response) {
  const { email, otp: code } = (req.body ?? {}) as Record<string, string>;
  if (!email || !code) {
    res.status(400).json({ message: "email and otp are required" });
    return;
  }
  const ok = await consumeOtp(email, code, "registration");
  if (!ok) {
    res.status(400).json({ message: "Invalid or expired code" });
    return;
  }
  const userRows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);
  const user = userRows[0];
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }
  await db
    .update(usersTable)
    .set({ status: "active" })
    .where(eq(usersTable.id, user.id));
  const token = signToken({
    sub: user.id,
    email: user.email,
    role: user.role as any,
  });
  const profile = await loadUserProfile(user.id);
  await audit({
    action: "user.verify",
    actorEmail: email,
    actorRole: "student",
    target: email,
  });
  res.json({ token, user: profile });
}

export async function resendOtp(req: Request, res: Response) {
  const { email } = (req.body ?? {}) as Record<string, string>;
  if (!email) {
    res.status(400).json({ message: "email required" });
    return;
  }
  const purposeBody = (req.body?.purpose ?? "registration") as
    | "registration"
    | "password_reset";
  await issueOtp(email, purposeBody);
  res.json({ message: "Code sent" });
}

export async function login(req: Request, res: Response) {
  const { identifier, password } = (req.body ?? {}) as Record<string, string>;
  if (!identifier || !password) {
    res.status(400).json({ message: "identifier and password are required" });
    return;
  }

  let lookupEmail = identifier.trim().toLowerCase();
  if (!identifier.includes("@")) {
    const upper = identifier.trim().toUpperCase();
    if (REG_NUMBER_REGEX.test(upper)) {
      const derived = suggestEmailFromRegNumber(upper);
      if (derived) lookupEmail = derived;
    }
  }

  const isEmail = lookupEmail.includes("@");
  const userRows = await db
    .select()
    .from(usersTable)
    .where(
      isEmail
        ? eq(usersTable.email, lookupEmail)
        : eq(usersTable.registrationNumber, identifier),
    )
    .limit(1);

  const user = userRows[0];
  if (!user) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }
  if (user.status === "pending_otp") {
    res.status(403).json({ message: "Please verify your email first" });
    return;
  }
  if (user.status === "disabled") {
    res.status(403).json({
      message:
        "Your account has been disabled. Contact the Electoral Commission.",
    });
    return;
  }
  if (user.registrationExpiresAt && user.registrationExpiresAt < new Date()) {
    res
      .status(403)
      .json({ message: "Your registration has expired. Please re-register." });
    return;
  }

  // Live fee check from the authoritative student_records table
  if (user.registrationNumber) {
    const studentRows = await db
      .select({ feeBalance: studentRecordsTable.feeBalance })
      .from(studentRecordsTable)
      .where(
        eq(studentRecordsTable.registrationNumber, user.registrationNumber),
      )
      .limit(1);
    const student = studentRows[0];
    if (student) {
      const feeBalance = parseFloat(student.feeBalance ?? "0");
      const feeStatus = feeBalance === 0 ? "cleared" : "outstanding";
      await db
        .update(usersTable)
        .set({ feeStatus })
        .where(eq(usersTable.id, user.id));
    }
  }

  const token = signToken({
    sub: user.id,
    email: user.email,
    role: user.role as any,
  });
  const profile = await loadUserProfile(user.id);
  await audit({
    action: "user.login",
    actorEmail: user.email,
    actorRole: user.role,
    target: user.email,
  });
  res.json({ token, user: profile });
}

export async function adminLogin(req: Request, res: Response) {
  const { email, password } = (req.body ?? {}) as Record<string, string>;
  if (!email || !password) {
    res.status(400).json({ message: "email and password are required" });
    return;
  }
  const userRows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);
  const user = userRows[0];
  if (!user || user.role !== "admin") {
    res.status(401).json({ message: "Invalid admin credentials" });
    return;
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ message: "Invalid admin credentials" });
    return;
  }
  const token = signToken({ sub: user.id, email: user.email, role: "admin" });
  const profile = await loadUserProfile(user.id);
  await audit({
    action: "admin.login",
    actorEmail: user.email,
    actorRole: "admin",
    target: user.email,
  });
  res.json({ token, user: profile });
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = (req.body ?? {}) as Record<string, string>;
  if (!email) {
    res.status(400).json({ message: "email required" });
    return;
  }
  const userRows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);
  if (!userRows[0]) {
    res.json({
      message: "If an account exists, a code has been sent",
    });
    return;
  }
  await issueOtp(email, "password_reset");
  await audit({
    action: "user.forgot_password",
    actorEmail: email,
    actorRole: "student",
    target: email,
  });
  res.json({ message: "Reset code sent" });
}

export async function resetPassword(req: Request, res: Response) {
  const {
    email,
    otp: code,
    newPassword,
  } = (req.body ?? {}) as Record<string, string>;
  if (!email || !code || !newPassword) {
    res
      .status(400)
      .json({ message: "email, otp and newPassword are required" });
    return;
  }
  const pwError = validatePasswordStrength(newPassword);
  if (pwError) {
    res.status(400).json({ message: pwError, code: "WEAK_PASSWORD" });
    return;
  }
  const ok = await consumeOtp(email, code, "password_reset");
  if (!ok) {
    res.status(400).json({ message: "Invalid or expired code" });
    return;
  }
  await db
    .update(usersTable)
    .set({ passwordHash: await hashPassword(newPassword) })
    .where(eq(usersTable.email, email));
  await audit({
    action: "user.reset_password",
    actorEmail: email,
    actorRole: "student",
    target: email,
  });
  res.json({ message: "Password reset successfully" });
}

export async function getMe(req: Request, res: Response) {
  const profile = await loadUserProfile(req.user!.id);
  res.json({ user: profile });
}
