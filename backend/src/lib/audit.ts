import { db, auditLogTable } from "@workspace/db";
import { logger } from "./logger.js";

export async function audit(entry: {
  action: string;
  actorEmail?: string | null;
  actorRole?: string | null;
  target?: string | null;
  details?: string | null;
  ipAddress?: string | null;
}) {
  try {
    await db.insert(auditLogTable).values({
      action: entry.action,
      actorEmail: entry.actorEmail ?? null,
      actorRole: entry.actorRole ?? null,
      target: entry.target ?? null,
      details: entry.details ?? null,
      ipAddress: entry.ipAddress ?? null,
    });
  } catch (err) {
    logger.warn({ err }, "Failed to write audit log entry");
  }
}
