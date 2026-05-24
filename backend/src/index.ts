import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
} from "drizzle-orm/pg-core";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { seedCatalog } from "./seed.js";

const DATABASE_URL = process.env["DATABASE_URL"];
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

export const pool = new Pool({ connectionString: DATABASE_URL });
export const db = drizzle(pool);

const PORT = process.env.PORT || 8080;

async function startServer() {
  try {
    // Run seeding to ensure schools/hostels exist
    await seedCatalog();

    app.listen(PORT, () => {
      logger.info(`🚀 Backend running at http://localhost:${PORT}`);
    });
  } catch (err) {
    logger.error("Failed to start server", err);
    process.exit(1);
  }
}

startServer();

export const studentRecordsTable = pgTable("student_records", {
  registrationNumber: varchar("registration_number", {
    length: 50,
  }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  gender: varchar("gender", { length: 10 }).notNull(),
  schoolId: text("school_id").notNull(),
  departmentId: text("department_id").notNull(),
  courseId: text("course_id").notNull(),
  hostelId: text("hostel_id"),
  yearOfStudy: integer("year_of_study").notNull().default(1),
  feeBalance: numeric("fee_balance", { precision: 10, scale: 2 })
    .notNull()
    .default("0.00"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const usersTable = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 50 }).notNull().default("student"),
  status: varchar("status", { length: 50 }).notNull().default("pending_otp"),
  gender: varchar("gender", { length: 10 }),
  courseId: text("course_id"),
  hostelId: text("hostel_id"),
  registrationNumber: varchar("registration_number", { length: 50 }),
  registrationExpiresAt: timestamp("registration_expires_at"),
  feeStatus: varchar("fee_status", { length: 20 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const otpsTable = pgTable("otps", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  codeHash: text("code_hash").notNull(),
  purpose: varchar("purpose", { length: 50 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  consumedAt: timestamp("consumed_at"),
});

export const schoolsTable = pgTable("schools", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
});

export const departmentsTable = pgTable("departments", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  schoolId: text("school_id").notNull(),
});

export const coursesTable = pgTable("courses", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  departmentId: text("department_id").notNull(),
  level: varchar("level", { length: 20 }).notNull().default("bachelor"),
});

export const hostelsTable = pgTable("hostels", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  zone: varchar("zone", { length: 50 }).notNull(),
  gender: varchar("gender", { length: 10 }).notNull(),
});

export const pollsTable = pgTable("polls", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull().default(""),
  pollType: varchar("poll_type", { length: 20 }).notNull().default("general"),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  locked: boolean("locked").notNull().default(false),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const pollSeatsTable = pgTable("poll_seats", {
  id: uuid("id").defaultRandom().primaryKey(),
  pollId: uuid("poll_id").notNull(),
  code: varchar("code", { length: 100 }).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  scope: varchar("scope", { length: 50 }).notNull(),
  scopeRefId: text("scope_ref_id"),
  gender: varchar("gender", { length: 10 }),
  position: integer("position").notNull().default(0),
});

export const candidatesTable = pgTable("candidates", {
  id: uuid("id").defaultRandom().primaryKey(),
  pollId: uuid("poll_id").notNull(),
  seatId: uuid("seat_id").notNull(),
  userId: uuid("user_id").notNull(),
  manifesto: text("manifesto").notNull(),
  slogan: varchar("slogan", { length: 255 }),
  bio: text("bio"),
  photoUrl: text("photo_url"),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  attemptNumber: integer("attempt_number").notNull().default(1),
  reviewedBy: uuid("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const candidateDocumentsTable = pgTable("candidate_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  candidateId: uuid("candidate_id").notNull(),
  documentName: varchar("document_name", { length: 255 }).notNull(),
  documentUrl: text("document_url").notNull(),
  documentType: varchar("document_type", { length: 100 })
    .notNull()
    .default("document"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const electionApplicationSettingsTable = pgTable(
  "election_application_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pollId: uuid("poll_id").notNull().unique(),
    isOpen: boolean("is_open").notNull().default(false),
    openAt: timestamp("open_at", { withTimezone: true }),
    closeAt: timestamp("close_at", { withTimezone: true }),
    timerDurationMinutes: integer("timer_duration_minutes"),
    openedBy: uuid("opened_by"),
    closedBy: uuid("closed_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
);

export const endorsementsTable = pgTable("endorsements", {
  id: uuid("id").defaultRandom().primaryKey(),
  candidateId: uuid("candidate_id").notNull(),
  seatId: uuid("seat_id").notNull(),
  voterId: uuid("voter_id").notNull(),
});

export const ballotTokensTable = pgTable("ballot_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  pollId: uuid("poll_id").notNull(),
  seatId: uuid("seat_id").notNull(),
  userId: uuid("user_id").notNull(),
  tokenHash: text("token_hash").notNull(),
  used: boolean("used").notNull().default(false),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

export const votesTable = pgTable("votes", {
  id: uuid("id").defaultRandom().primaryKey(),
  pollId: uuid("poll_id").notNull(),
  seatId: uuid("seat_id").notNull(),
  candidateId: uuid("candidate_id"),
  slateId: uuid("slate_id"),
  encryptedPayload: text("encrypted_payload").notNull(),
  ballotHash: text("ballot_hash").notNull(),
  tokenHash: text("token_hash").notNull(),
  votedAt: timestamp("voted_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogTable = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  action: varchar("action", { length: 100 }).notNull(),
  actorEmail: varchar("actor_email", { length: 255 }),
  actorRole: varchar("actor_role", { length: 50 }),
  target: varchar("target", { length: 255 }),
  details: text("details"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
