import { useCallback, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Brand } from "@/components/brand";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  useListHostels,
  useRegister,
  useVerifyOtp,
  useResendOtp,
} from "@workspace/api-client-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  Loader2,
  ArrowRight,
  MailCheck,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ShieldX,
  User,
  GraduationCap,
  Building2,
  Shield,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

const REG_NUMBER_REGEX = /^[A-Z]+\d+[A-Z]?\/\d+\/\d{4}$/;

type PrefillData = {
  notInDatabase?: boolean;
  exists: boolean;
  feeCleared: boolean;
  feeBalance?: number;
  name?: string;
  gender?: string;
  schoolId?: string;
  departmentId?: string;
  courseId?: string;
  hostelId?: string | null;
  yearOfStudy?: number;
  suggestedEmail?: string;
  registrationNumber?: string;
  alreadyActive?: boolean;
};

type PasswordStrength = {
  score: number;
  label: string;
  color: string;
  bgColor: string;
  checks: { label: string; passed: boolean }[];
};

function checkPasswordStrength(pw: string): PasswordStrength {
  const checks = [
    { label: "At least 8 characters", passed: pw.length >= 8 },
    { label: "Uppercase letter (A-Z)", passed: /[A-Z]/.test(pw) },
    { label: "Lowercase letter (a-z)", passed: /[a-z]/.test(pw) },
    { label: "Number (0-9)", passed: /[0-9]/.test(pw) },
    { label: "Special character (!@#$…)", passed: /[^A-Za-z0-9]/.test(pw) },
  ];
  const score = checks.filter((c) => c.passed).length;
  const labels = [
    "Too weak",
    "Too weak",
    "Fair",
    "Good",
    "Strong",
    "Very strong",
  ];
  const colors = [
    "text-red-500",
    "text-red-500",
    "text-orange-500",
    "text-yellow-500",
    "text-green-500",
    "text-green-500",
  ];
  const bgColors = [
    "bg-red-500",
    "bg-red-500",
    "bg-orange-500",
    "bg-yellow-500",
    "bg-green-500",
    "bg-green-500",
  ];
  return {
    score,
    label: labels[score] ?? "Too weak",
    color: colors[score] ?? "text-red-500",
    bgColor: bgColors[score] ?? "bg-red-500",
    checks,
  };
}

export default function RegisterPage() {
  const [step, setStep] = useState<"form" | "otp">("form");
  const [regNumber, setRegNumber] = useState("");
  const [regNumberError, setRegNumberError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [prefillData, setPrefillData] = useState<PrefillData | null>(null);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [showPasswordChecks, setShowPasswordChecks] = useState(false);

  const hostelsQ = useListHostels();
  const register = useRegister();
  const verify = useVerifyOtp();
  const resend = useResendOtp();
  const { login } = useAuth();
  const [, navigate] = useLocation();

  const hostels = (hostelsQ.data ?? []) as Array<any>;
  // Look up the hostel name from the DB-assigned hostelId (null = off-campus)
  const hostelDisplayName = useMemo(() => {
    if (!prefillData?.exists) return null;
    if (!prefillData.hostelId) return "Off-campus (non-residential)";
    const found = hostels.find((h: any) => h.id === prefillData.hostelId);
    return found
      ? `${found.name}${found.zone ? ` — ${found.zone} zone` : ""}`
      : prefillData.hostelId;
  }, [hostels, prefillData?.exists, prefillData?.hostelId]);

  const pwStrength = useMemo(() => checkPasswordStrength(password), [password]);

  const isBlocked =
    prefillData?.notInDatabase === true ||
    (prefillData?.exists && !prefillData.feeCleared);
  const canSubmit =
    prefillData?.exists && prefillData.feeCleared && !prefillData.alreadyActive;

  const doFetch = useCallback(async (regNo: string) => {
    setPrefillLoading(true);
    try {
      const res = await fetch(
        `/api/auth/prefill?regNumber=${encodeURIComponent(regNo)}`,
      );
      const data: PrefillData = await res.json();
      setPrefillData(data);
    } catch {
      setPrefillData(null);
    } finally {
      setPrefillLoading(false);
    }
  }, []);

  const handleRegNumberChange = (val: string) => {
    const upper = val.toUpperCase();
    setRegNumber(upper);
    setRegNumberError("");
    setPrefillData(null);

    if (!upper) return;

    if (REG_NUMBER_REGEX.test(upper)) {
      setRegNumberError("");
      doFetch(upper);
    } else if (upper.length > 5) {
      setRegNumberError("Format must be J31/4338/2022 or J31S/4338/2022");
    }
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!regNumber || !REG_NUMBER_REGEX.test(regNumber)) {
      toast.error("Enter a valid registration number first");
      return;
    }
    if (!canSubmit) return;
    if (pwStrength.score < 5) {
      toast.error(
        "Please choose a stronger password. All 5 requirements must be met.",
      );
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      const r = (await register.mutateAsync({
        data: {
          registrationNumber: regNumber,
          password,
          hostelId: prefillData?.hostelId || undefined,
        } as any,
      })) as any;
      setRegisteredEmail(r?.email ?? prefillData?.suggestedEmail ?? "");
      toast.success("Verification code sent to your university email");
      setStep("otp");
    } catch (err: any) {
      const code = err?.response?.data?.code ?? err?.code;
      if (code === "NOT_IN_DATABASE") {
        toast.error(
          "Your registration number is not in the KU student database.",
        );
      } else if (code === "FEE_NOT_CLEARED") {
        toast.error(
          "Your fee balance is not cleared. Please visit the Finance Office.",
        );
      } else {
        toast.error(
          err?.response?.data?.message ?? err?.message ?? "Could not register",
        );
      }
    }
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    const email = registeredEmail || prefillData?.suggestedEmail || "";
    try {
      const r = (await verify.mutateAsync({
        data: { email, otp: otpCode },
      })) as any;
      if (r?.token && r?.user) {
        login(r.token, r.user);
        toast.success(`Welcome to KUVOTE, ${r.user.name}`);
        navigate("/dashboard");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Code is invalid or expired");
    }
  };

  const handleResend = async () => {
    const email = registeredEmail || prefillData?.suggestedEmail || "";
    try {
      await resend.mutateAsync({ data: { email } });
      toast.success("New code sent");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not resend code");
    }
  };

  return (
    <div className="min-h-screen w-full bg-linear-to-br from-background via-background to-secondary/30 flex flex-col">
      <header className="container mx-auto flex items-center justify-between p-4">
        <Brand />
        <ThemeToggle />
      </header>

      <div className="container mx-auto flex flex-1 items-center justify-center px-4 py-8">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-xl"
        >
          {step === "form" ? (
            <Card className="border-border/70 shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl">
                  Create your KUVOTE account
                </CardTitle>
                <CardDescription>
                  Enter your KU registration number.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={submitForm} className="space-y-5">
                  {/* ── Registration Number ── */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="regNumber"
                      className="flex items-center gap-1.5"
                    >
                      <GraduationCap className="h-3.5 w-3.5" />
                      Registration Number{" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="regNumber"
                        type="text"
                        placeholder="A01/1234/2022"
                        value={regNumber}
                        onChange={(e) => handleRegNumberChange(e.target.value)}
                        className={
                          regNumberError ? "border-destructive pr-9" : "pr-9"
                        }
                        required
                      />
                      {prefillLoading && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    {regNumberError && (
                      <p className="text-xs text-destructive">
                        {regNumberError}
                      </p>
                    )}
                  </div>

                  {/* ── Status Banner ── */}
                  <AnimatePresence mode="wait">
                    {prefillData && (
                      <motion.div
                        key={
                          prefillData.notInDatabase
                            ? "not-found"
                            : prefillData.feeCleared
                              ? "eligible"
                              : "fee-blocked"
                        }
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        {prefillData.notInDatabase ? (
                          <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
                            <ShieldX className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                            <div>
                              <p className="font-semibold text-destructive">
                                Not in the student database
                              </p>
                              <p className="text-muted-foreground mt-0.5">
                                This registration number was not found in KU
                                records. Please contact the{" "}
                                <strong>Registrar's Office</strong> or verify
                                the number and try again.
                              </p>
                            </div>
                          </div>
                        ) : prefillData.alreadyActive ? (
                          <div className="flex items-start gap-3 rounded-lg border border-chart-3/40 bg-chart-3/10 px-4 py-3 text-sm">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-chart-3" />
                            <div>
                              <p className="font-semibold">
                                Account already exists
                              </p>
                              <p className="text-muted-foreground mt-0.5">
                                An account for this registration number is
                                already registered.{" "}
                                <Link
                                  href="/login"
                                  className="font-medium text-primary hover:underline"
                                >
                                  Sign in instead.
                                </Link>
                              </p>
                            </div>
                          </div>
                        ) : !prefillData.feeCleared ? (
                          <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
                            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                            <div>
                              <p className="font-semibold text-destructive">
                                Fee balance not cleared
                              </p>
                              <p className="text-muted-foreground mt-0.5">
                                Outstanding balance:{" "}
                                <strong>
                                  KES {prefillData.feeBalance?.toLocaleString()}
                                </strong>
                                . You must clear all fees at the Finance Office
                                before you can register to vote.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-3 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                            <div>
                              <p className="font-semibold text-green-700 dark:text-green-300">
                                Eligible to register
                              </p>
                              <p className="text-muted-foreground mt-0.5">
                                Fee balance cleared. Your details have been
                                verified and pre-filled below.
                              </p>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ── Auto-Filled Student Details (read-only) ── */}
                  <AnimatePresence>
                    {prefillData?.exists &&
                      prefillData.feeCleared &&
                      !prefillData.alreadyActive && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-3"
                        >
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5" /> Student Details
                            (from KU database)
                          </p>

                          <div className="grid gap-3 sm:grid-cols-2 text-sm">
                            <div>
                              <span className="text-muted-foreground text-xs">
                                Full Name
                              </span>
                              <p className="font-medium mt-0.5">
                                {prefillData.name}
                              </p>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">
                                Gender
                              </span>
                              <p className="font-medium mt-0.5 capitalize">
                                {prefillData.gender}
                              </p>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">
                                University Email
                              </span>
                              <p className="font-medium mt-0.5 break-all">
                                {prefillData.suggestedEmail}
                              </p>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">
                                Year of Study
                              </span>
                              <p className="font-medium mt-0.5">
                                Year {prefillData.yearOfStudy}
                              </p>
                            </div>
                          </div>

                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Shield className="h-3 w-3" />
                            These details are pulled directly from the KU
                            Registrar's database and cannot be changed here.
                          </p>
                        </motion.div>
                      )}
                  </AnimatePresence>

                  {/* ── Hostel (auto-filled from DB, read-only) ── */}
                  <AnimatePresence>
                    {prefillData?.exists &&
                      prefillData.feeCleared &&
                      !prefillData.alreadyActive &&
                      hostelDisplayName && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-2 overflow-hidden"
                        >
                          <Label className="flex items-center gap-1.5 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                            <Building2 className="h-3.5 w-3.5" />
                            Accommodation
                          </Label>
                          <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm">
                            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="flex-1 font-medium">
                              {hostelDisplayName}
                            </span>
                            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              ss
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {prefillData.hostelId
                              ? "Your hostel is assigned in the university housing database and cannot be changed here."
                              : "You are not registered in any KU hostel. You will be recorded as an off-campus (non-residential) student."}
                          </p>
                        </motion.div>
                      )}
                  </AnimatePresence>

                  {/* ── Password ── */}
                  <AnimatePresence>
                    {prefillData?.exists &&
                      prefillData.feeCleared &&
                      !prefillData.alreadyActive && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-4 overflow-hidden"
                        >
                          <div className="space-y-2">
                            <Label htmlFor="password">
                              Password{" "}
                              <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              id="password"
                              type="password"
                              required
                              value={password}
                              onChange={(e) => {
                                setPassword(e.target.value);
                                setShowPasswordChecks(true);
                              }}
                              placeholder="Create a strong password"
                            />

                            {/* Strength Bar */}
                            {password.length > 0 && (
                              <div className="space-y-2">
                                <div className="flex gap-1">
                                  {[1, 2, 3, 4, 5].map((i) => (
                                    <div
                                      key={i}
                                      className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                                        i <= pwStrength.score
                                          ? pwStrength.bgColor
                                          : "bg-muted"
                                      }`}
                                    />
                                  ))}
                                </div>
                                <p
                                  className={`text-xs font-medium ${pwStrength.color}`}
                                >
                                  {pwStrength.label}
                                </p>
                              </div>
                            )}
                            {showPasswordChecks && password.length > 0 && (
                              <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                                {pwStrength.checks.map((c) => (
                                  <li
                                    key={c.label}
                                    className={`flex items-center gap-1.5 text-xs ${c.passed ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}
                                  >
                                    {c.passed ? (
                                      <CheckCircle2 className="h-3 w-3 shrink-0" />
                                    ) : (
                                      <XCircle className="h-3 w-3 shrink-0 opacity-50" />
                                    )}
                                    {c.label}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="confirm">
                              Confirm Password{" "}
                              <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              id="confirm"
                              type="password"
                              required
                              value={confirm}
                              onChange={(e) => setConfirm(e.target.value)}
                              placeholder="Re-enter your password"
                              className={
                                confirm.length > 0 && confirm !== password
                                  ? "border-destructive"
                                  : ""
                              }
                            />
                            {confirm.length > 0 && confirm !== password && (
                              <p className="text-xs text-destructive">
                                Passwords do not match
                              </p>
                            )}
                          </div>
                        </motion.div>
                      )}
                  </AnimatePresence>

                  <Button
                    type="submit"
                    className="w-full gap-2"
                    disabled={
                      register.isPending ||
                      !canSubmit ||
                      pwStrength.score < 5 ||
                      password !== confirm ||
                      password.length === 0
                    }
                  >
                    {register.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                    Create Account
                  </Button>

                  <p className="text-center text-sm text-muted-foreground">
                    Already have an account?{" "}
                    <Link
                      href="/login"
                      className="font-medium text-primary hover:underline"
                    >
                      Sign in
                    </Link>
                  </p>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/70 shadow-lg">
              <CardHeader>
                <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/15 text-primary">
                  <MailCheck className="h-5 w-5" />
                </div>
                <CardTitle className="text-2xl">Verify your email</CardTitle>
                <CardDescription>
                  Enter the 6-digit code we sent to{" "}
                  <span className="font-medium text-foreground">
                    {registeredEmail || prefillData?.suggestedEmail}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={submitOtp} className="space-y-6">
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={otpCode}
                      onChange={setOtpCode}
                    >
                      <InputOTPGroup>
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                          <InputOTPSlot key={i} index={i} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={verify.isPending}
                  >
                    {verify.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Verify and sign in"
                    )}
                  </Button>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => setStep("form")}
                      className="hover:underline"
                    >
                      Edit details
                    </button>
                    <button
                      type="button"
                      onClick={handleResend}
                      className="flex items-center gap-1 hover:underline"
                    >
                      <RotateCcw className="h-3 w-3" /> Resend code
                    </button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  );
}
