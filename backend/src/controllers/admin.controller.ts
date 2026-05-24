import type { Request, Response } from "express";
import {
  db,
  usersTable,
  pollsTable,
  pollSeatsTable,
  candidatesTable,
  candidateDocumentsTable,
  electionApplicationSettingsTable,
  votesTable,
  endorsementsTable,
  ballotTokensTable,
  auditLogTable,
  schoolsTable,
  departmentsTable,
  coursesTable,
  hostelsTable,
} from "@workspace/db";
import {
  and,
  count,
  desc,
  eq,
  gte,
  lte,
  isNotNull,
  inArray,
} from "drizzle-orm";
import { hashPassword } from "../lib/auth.js";
import { audit } from "../lib/audit.js";

export async function getDashboard(_req: Request, res: Response) {
  const now = new Date();
  const totalVoters = await db
    .select({ n: count() })
    .from(usersTable)
    .where(eq(usersTable.role, "student"));
  const activeVoters = await db
    .select({ n: count() })
    .from(usersTable)
    .where(
      and(eq(usersTable.role, "student"), eq(usersTable.status, "active")),
    );
  const totalVotes = await db.select({ n: count() }).from(votesTable);
  const allPolls = await db.select().from(pollsTable);
  const activePolls = allPolls.filter(
    (p) => p.startDate <= now && p.endDate >= now,
  ).length;
  const totalPolls = allPolls.length;
  const totalCandidates = await db.select({ n: count() }).from(candidatesTable);
  const recent = await db
    .select()
    .from(auditLogTable)
    .orderBy(desc(auditLogTable.createdAt))
    .limit(15);
  res.json({
    totalVoters: Number(totalVoters[0]?.n ?? 0),
    activeVoters: Number(activeVoters[0]?.n ?? 0),
    totalVotesCast: Number(totalVotes[0]?.n ?? 0),
    totalPolls,
    activePolls,
    totalCandidates: Number(totalCandidates[0]?.n ?? 0),
    recentActivity: recent.map((r) => ({
      id: r.id,
      action: r.action,
      actorEmail: r.actorEmail,
      target: r.target,
      details: r.details,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export async function getAdminPolls(_req: Request, res: Response) {
  const polls = await db
    .select()
    .from(pollsTable)
    .orderBy(desc(pollsTable.createdAt));
  const now = new Date();
  const out = await Promise.all(
    polls.map(async (p) => {
      const status =
        now < p.startDate ? "upcoming" : now > p.endDate ? "closed" : "active";
      const seats = await db
        .select({ n: count() })
        .from(pollSeatsTable)
        .where(eq(pollSeatsTable.pollId, p.id));
      const candidates = await db
        .select({ n: count() })
        .from(candidatesTable)
        .where(eq(candidatesTable.pollId, p.id));
      const votes = await db
        .select({ n: count() })
        .from(votesTable)
        .where(eq(votesTable.pollId, p.id));
      const appSettings = await db
        .select()
        .from(electionApplicationSettingsTable)
        .where(eq(electionApplicationSettingsTable.pollId, p.id))
        .limit(1);
      return {
        id: p.id,
        title: p.title,
        description: p.description,
        pollType: p.pollType,
        startDate: p.startDate.toISOString(),
        endDate: p.endDate.toISOString(),
        status,
        locked: p.locked,
        seatCount: Number(seats[0]?.n ?? 0),
        candidateCount: Number(candidates[0]?.n ?? 0),
        voteCount: Number(votes[0]?.n ?? 0),
        applicationOpen: appSettings[0]?.isOpen ?? false,
        applicationCloseAt: appSettings[0]?.closeAt
          ? appSettings[0].closeAt.toISOString()
          : null,
        timerDurationMinutes: appSettings[0]?.timerDurationMinutes ?? null,
      };
    }),
  );
  res.json(out);
}

export async function createPoll(req: Request, res: Response) {
  const { title, description, pollType, startDate, endDate, seats } =
    (req.body ?? {}) as {
      title: string;
      description?: string;
      pollType?: string;
      startDate: string;
      endDate: string;
      seats: Array<{
        code: string;
        label: string;
        scope: "school" | "department" | "hostel" | "sgc" | "university";
        scopeRefId?: string | null;
        gender?: "male" | "female" | null;
      }>;
    };
  if (
    !title ||
    !startDate ||
    !endDate ||
    !Array.isArray(seats) ||
    seats.length === 0
  ) {
    res.status(400).json({
      message: "title, startDate, endDate and at least one seat are required",
    });
    return;
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  ) {
    res.status(400).json({ message: "Invalid start/end dates" });
    return;
  }
  const inserted = await db
    .insert(pollsTable)
    .values({
      title,
      description: description ?? "",
      pollType: pollType ?? "general",
      startDate: start,
      endDate: end,
      createdBy: req.user!.id,
    })
    .returning();
  const poll = inserted[0];
  for (let i = 0; i < seats.length; i++) {
    const s = seats[i];
    await db.insert(pollSeatsTable).values({
      pollId: poll.id,
      code: s.code,
      label: s.label,
      scope: s.scope,
      scopeRefId: s.scopeRefId ?? null,
      gender: s.gender ?? null,
      position: i,
    });
  }
  await audit({
    action: "admin.create_poll",
    actorEmail: req.user!.email,
    actorRole: "admin",
    target: poll.id,
    details: title,
  });
  res.status(201).json({ id: poll.id, message: "Poll created" });
}

export async function updatePoll(req: Request, res: Response) {
  const { pollId } = req.params;
  const { title, description, startDate, endDate } = (req.body ?? {}) as {
    title?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
  };
  const existing = await db
    .select()
    .from(pollsTable)
    .where(eq(pollsTable.id, pollId as string))
    .limit(1);
  if (!existing[0]) {
    res.status(404).json({ message: "Poll not found" });
    return;
  }
  const updates: Partial<typeof pollsTable.$inferInsert> = {};
  if (title) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (startDate) {
    const s = new Date(startDate);
    if (!Number.isNaN(s.getTime())) updates.startDate = s;
  }
  if (endDate) {
    const e = new Date(endDate);
    if (!Number.isNaN(e.getTime())) updates.endDate = e;
  }
  await db
    .update(pollsTable)
    .set(updates)
    .where(eq(pollsTable.id, pollId as string));
  await audit({
    action: "admin.update_poll",
    actorEmail: req.user!.email,
    actorRole: "admin",
    target: pollId as string,
    details: title ?? "updated",
  });
  res.json({ message: "Poll updated" });
}

export async function deletePoll(req: Request, res: Response) {
  const { pollId } = req.params;
  const id = pollId as string;

  try {
 

    // 1. Get all candidate IDs for this poll
    const candidates = await db
      .select({ id: candidatesTable.id })
      .from(candidatesTable)
      .where(eq(candidatesTable.pollId, id));
    const candidateIds = candidates.map((c) => c.id);

    // 2. Delete in order of dependency (bottom-up)

    // Step A: Delete votes and ballot tokens (linked to pollId)
    await db.delete(votesTable).where(eq(votesTable.pollId, id));
    await db.delete(ballotTokensTable).where(eq(ballotTokensTable.pollId, id));

    // Step B: Delete candidate-specific data (endorsements and documents)
    if (candidateIds.length > 0) {
      await db
        .delete(endorsementsTable)
        .where(inArray(endorsementsTable.candidateId, candidateIds));
      await db
        .delete(candidateDocumentsTable)
        .where(inArray(candidateDocumentsTable.candidateId, candidateIds));
    }

    // Step C: Delete candidates (linked to pollId)
    await db.delete(candidatesTable).where(eq(candidatesTable.pollId, id));

    // Step D: Delete application settings (linked to pollId)
    await db
      .delete(electionApplicationSettingsTable)
      .where(eq(electionApplicationSettingsTable.pollId, id));

    // Step E: Delete poll seats (linked to pollId)
    await db.delete(pollSeatsTable).where(eq(pollSeatsTable.pollId, id));

    // Step F: Finally delete the poll itself
    await db.delete(pollsTable).where(eq(pollsTable.id, id));

    // 3. Log the action
    await audit({
      action: "admin.delete_poll",
      actorEmail: req.user!.email,
      actorRole: "admin",
      target: id,
    });

    res.json({ message: "Poll and all associated data deleted successfully" });
  } catch (error) {
    console.error("CRITICAL: Delete poll failed", error);
    res.status(500).json({
      message: "Internal Server Error: Could not delete poll.",
      error: error instanceof Error ? error.message : "Unknown database error",
    });
  }
}

export async function lockPoll(req: Request, res: Response) {
  const { pollId } = req.params;
  await db
    .update(pollsTable)
    .set({ locked: true })
    .where(eq(pollsTable.id, pollId as string));
  await audit({
    action: "admin.lock_poll",
    actorEmail: req.user!.email,
    actorRole: "admin",
    target: pollId as string,
  });
  res.json({ message: "Poll locked" });
}

export async function unlockPoll(req: Request, res: Response) {
  const { pollId } = req.params;
  await db
    .update(pollsTable)
    .set({ locked: false })
    .where(eq(pollsTable.id, pollId as string));
  await audit({
    action: "admin.unlock_poll",
    actorEmail: req.user!.email,
    actorRole: "admin",
    target: pollId as string,
  });
  res.json({ message: "Poll unlocked" });
}

export async function openApplicationWindow(req: Request, res: Response) {
  const { pollId } = req.params;
  const { timerDurationMinutes } = (req.body ?? {}) as {
    timerDurationMinutes?: number;
  };
  const pollRows = await db
    .select()
    .from(pollsTable)
    .where(eq(pollsTable.id, pollId as string))
    .limit(1);
  if (!pollRows[0]) {
    res.status(404).json({ message: "Poll not found" });
    return;
  }
  const now = new Date();
  const closeAt = timerDurationMinutes
    ? new Date(now.getTime() + timerDurationMinutes * 60 * 1000)
    : null;
  const existing = await db
    .select()
    .from(electionApplicationSettingsTable)
    .where(eq(electionApplicationSettingsTable.pollId, pollId as string))
    .limit(1);
  if (existing[0]) {
    await db
      .update(electionApplicationSettingsTable)
      .set({
        isOpen: true,
        openAt: now,
        closeAt: closeAt,
        timerDurationMinutes: timerDurationMinutes ?? null,
        openedBy: req.user!.id,
        updatedAt: now,
      })
      .where(eq(electionApplicationSettingsTable.pollId, pollId as string));
  } else {
    await db.insert(electionApplicationSettingsTable).values({
      pollId: pollId as string,
      isOpen: true,
      openAt: now,
      closeAt: closeAt,
      timerDurationMinutes: timerDurationMinutes ?? null,
      openedBy: req.user!.id,
      updatedAt: now,
    });
  }
  await audit({
    action: "admin.open_application_window",
    actorEmail: req.user!.email,
    actorRole: "admin",
    target: pollId as string,
    details: timerDurationMinutes
      ? `timer=${timerDurationMinutes}min`
      : "no timer",
  });
  res.json({
    message: "Application window opened",
    closeAt: closeAt?.toISOString() ?? null,
  });
}

export async function closeApplicationWindow(req: Request, res: Response) {
  const { pollId } = req.params;
  const now = new Date();
  const existing = await db
    .select()
    .from(electionApplicationSettingsTable)
    .where(eq(electionApplicationSettingsTable.pollId, pollId as string))
    .limit(1);
  if (existing[0]) {
    await db
      .update(electionApplicationSettingsTable)
      .set({
        isOpen: false,
        closeAt: now,
        closedBy: req.user!.id,
        updatedAt: now,
      })
      .where(eq(electionApplicationSettingsTable.pollId, pollId as string));
  } else {
    await db.insert(electionApplicationSettingsTable).values({
      pollId: pollId as string,
      isOpen: false,
      closeAt: now,
      closedBy: req.user!.id,
      updatedAt: now,
    });
  }
  await audit({
    action: "admin.close_application_window",
    actorEmail: req.user!.email,
    actorRole: "admin",
    target: pollId as string,
  });
  res.json({ message: "Application window closed" });
}

export async function getApplicationSettings(req: Request, res: Response) {
  const { pollId } = req.params;
  const rows = await db
    .select()
    .from(electionApplicationSettingsTable)
    .where(eq(electionApplicationSettingsTable.pollId, pollId as string))
    .limit(1);
  if (!rows[0]) {
    res.json({
      pollId,
      isOpen: false,
      openAt: null,
      closeAt: null,
      timerDurationMinutes: null,
    });
    return;
  }
  const r = rows[0];
  res.json({
    pollId,
    isOpen: r.isOpen,
    openAt: r.openAt?.toISOString() ?? null,
    closeAt: r.closeAt?.toISOString() ?? null,
    timerDurationMinutes: r.timerDurationMinutes ?? null,
  });
}

export async function getUsers(req: Request, res: Response) {
  const genderFilter = req.query.gender as string | undefined;
  const rows = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      registrationNumber: usersTable.registrationNumber,
      role: usersTable.role,
      status: usersTable.status,
      gender: usersTable.gender,
      hostelName: hostelsTable.name,
      courseName: coursesTable.name,
      registrationExpiresAt: usersTable.registrationExpiresAt,
      feeStatus: usersTable.feeStatus,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .leftJoin(hostelsTable, eq(usersTable.hostelId, hostelsTable.id))
    .leftJoin(coursesTable, eq(usersTable.courseId, coursesTable.id))
    .orderBy(desc(usersTable.createdAt));
  const filtered =
    genderFilter && genderFilter !== "all"
      ? rows.filter((r) => r.gender === genderFilter)
      : rows;
  res.json(
    filtered.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      registrationNumber: r.registrationNumber ?? null,
      role: r.role as "student" | "admin",
      status: r.status,
      gender: r.gender ?? null,
      hostelName: r.hostelName ?? null,
      courseName: r.courseName ?? null,
      feeStatus: r.feeStatus ?? null,
      registrationExpiresAt: r.registrationExpiresAt
        ? r.registrationExpiresAt.toISOString()
        : null,
      createdAt: r.createdAt.toISOString(),
    })),
  );
}

export async function removeVoter(req: Request, res: Response) {
  const { userId } = req.params;
  const userRows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId as string))
    .limit(1);
  if (!userRows[0]) {
    res.status(404).json({ message: "User not found" });
    return;
  }
  if (userRows[0].role === "admin") {
    res.status(403).json({ message: "Cannot remove an admin user" });
    return;
  }
  await db.delete(usersTable).where(eq(usersTable.id, userId as string));
  await audit({
    action: "admin.remove_voter",
    actorEmail: req.user!.email,
    actorRole: "admin",
    target: userId as string,
    details: userRows[0].email,
  });
  res.json({ message: "Voter removed from the system" });
}

export async function approveUser(req: Request, res: Response) {
  await db
    .update(usersTable)
    .set({ status: "active" })
    .where(eq(usersTable.id, req.params.userId as string));
  await audit({
    action: "admin.approve_user",
    actorEmail: req.user!.email,
    actorRole: "admin",
    target: req.params.userId as string,
  });
  res.json({ message: "User approved" });
}

export async function disableUser(req: Request, res: Response) {
  await db
    .update(usersTable)
    .set({ status: "disabled" })
    .where(eq(usersTable.id, req.params.userId as string));
  await audit({
    action: "admin.disable_user",
    actorEmail: req.user!.email,
    actorRole: "admin",
    target: req.params.userId as string,
  });
  res.json({ message: "User disabled" });
}

export async function promoteUser(req: Request, res: Response) {
  await db
    .update(usersTable)
    .set({ role: "admin" })
    .where(eq(usersTable.id, req.params.userId as string));
  await audit({
    action: "admin.promote_user",
    actorEmail: req.user!.email,
    actorRole: "admin",
    target: req.params.userId as string,
  });
  res.json({ message: "User promoted to admin" });
}

export async function getAdminCandidates(_req: Request, res: Response) {
  const rows = await db
    .select({
      id: candidatesTable.id,
      pollId: candidatesTable.pollId,
      pollTitle: pollsTable.title,
      seatId: candidatesTable.seatId,
      seatLabel: pollSeatsTable.label,
      userId: candidatesTable.userId,
      name: usersTable.name,
      email: usersTable.email,
      manifesto: candidatesTable.manifesto,
      slogan: candidatesTable.slogan,
      bio: candidatesTable.bio,
      photoUrl: candidatesTable.photoUrl,
      status: candidatesTable.status,
      rejectionReason: candidatesTable.rejectionReason,
      reviewedAt: candidatesTable.reviewedAt,
      createdAt: candidatesTable.createdAt,
    })
    .from(candidatesTable)
    .leftJoin(pollsTable, eq(candidatesTable.pollId, pollsTable.id))
    .leftJoin(pollSeatsTable, eq(candidatesTable.seatId, pollSeatsTable.id))
    .leftJoin(usersTable, eq(candidatesTable.userId, usersTable.id))
    .orderBy(desc(candidatesTable.createdAt));

  const withDocs = await Promise.all(
    rows.map(async (r) => {
      const docs = await db
        .select()
        .from(candidateDocumentsTable)
        .where(eq(candidateDocumentsTable.candidateId, r.id));
      return {
        id: r.id,
        pollId: r.pollId,
        pollTitle: r.pollTitle ?? "",
        seatId: r.seatId,
        seatLabel: r.seatLabel ?? "",
        userId: r.userId,
        name: r.name ?? "",
        email: r.email ?? "",
        manifesto: r.manifesto,
        slogan: r.slogan ?? null,
        bio: r.bio ?? null,
        photoUrl: r.photoUrl ?? null,
        status: r.status as "pending" | "endorsed" | "approved" | "rejected",
        rejectionReason: r.rejectionReason ?? null,
        reviewedAt: r.reviewedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        documents: docs.map((d) => ({
          id: d.id,
          documentName: d.documentName,
          documentUrl: d.documentUrl,
          documentType: d.documentType,
          uploadedAt: d.uploadedAt.toISOString(),
        })),
      };
    }),
  );
  res.json(withDocs);
}

export async function addCandidate(req: Request, res: Response) {
  const { pollId, seatId, userId, manifesto } = (req.body ?? {}) as Record<
    string,
    string
  >;
  if (!pollId || !seatId || !userId || !manifesto) {
    res
      .status(400)
      .json({ message: "pollId, seatId, userId and manifesto are required" });
    return;
  }
  const exists = await db
    .select()
    .from(candidatesTable)
    .where(
      and(
        eq(candidatesTable.seatId, seatId),
        eq(candidatesTable.userId, userId),
      ),
    )
    .limit(1);
  if (exists[0]) {
    res
      .status(409)
      .json({ message: "Candidate already applied for this seat" });
    return;
  }
  const inserted = await db
    .insert(candidatesTable)
    .values({ pollId, seatId, userId, manifesto, status: "approved" })
    .returning();
  await audit({
    action: "admin.add_candidate",
    actorEmail: req.user!.email,
    actorRole: "admin",
    target: inserted[0].id,
  });
  res.status(201).json({ id: inserted[0].id, message: "Candidate added" });
}

export async function approveCandidate(req: Request, res: Response) {
  await db
    .update(candidatesTable)
    .set({
      status: "approved",
      rejectionReason: null,
      reviewedBy: req.user!.id,
      reviewedAt: new Date(),
    })
    .where(eq(candidatesTable.id, req.params.candidateId as string));
  await audit({
    action: "admin.approve_candidate",
    actorEmail: req.user!.email,
    actorRole: "admin",
    target: req.params.candidateId as string,
  });
  res.json({ message: "Candidate approved" });
}

export async function rejectCandidate(req: Request, res: Response) {
  const { reason } = (req.body ?? {}) as Record<string, string>;
  await db
    .update(candidatesTable)
    .set({
      status: "rejected",
      rejectionReason: reason ?? null,
      reviewedBy: req.user!.id,
      reviewedAt: new Date(),
    })
    .where(eq(candidatesTable.id, req.params.candidateId as string));
  await audit({
    action: "admin.reject_candidate",
    actorEmail: req.user!.email,
    actorRole: "admin",
    target: req.params.candidateId as string,
    details: reason ?? null,
  });
  res.json({ message: "Candidate rejected" });
}

export async function getReports(_req: Request, res: Response) {
  const usersBySchoolRows = await db
    .select({
      schoolId: schoolsTable.id,
      schoolName: schoolsTable.name,
      n: count(),
    })
    .from(usersTable)
    .leftJoin(coursesTable, eq(usersTable.courseId, coursesTable.id))
    .leftJoin(
      departmentsTable,
      eq(coursesTable.departmentId, departmentsTable.id),
    )
    .leftJoin(schoolsTable, eq(departmentsTable.schoolId, schoolsTable.id))
    .where(eq(usersTable.role, "student"))
    .groupBy(schoolsTable.id, schoolsTable.name);

  const candidatesByPoll = await db
    .select({
      pollId: pollsTable.id,
      pollTitle: pollsTable.title,
      n: count(),
    })
    .from(candidatesTable)
    .leftJoin(pollsTable, eq(candidatesTable.pollId, pollsTable.id))
    .groupBy(pollsTable.id, pollsTable.title);

  const polls = await db
    .select()
    .from(pollsTable)
    .orderBy(desc(pollsTable.createdAt));

  const participation = await Promise.all(
    polls.map(async (p) => {
      const totalEligible = await db
        .select({ n: count() })
        .from(usersTable)
        .where(
          and(eq(usersTable.role, "student"), eq(usersTable.status, "active")),
        );
      const totalVoted = await db
        .selectDistinct({ userId: ballotTokensTable.userId })
        .from(ballotTokensTable)
        .where(eq(ballotTokensTable.pollId, p.id));
      const eligibleN = Number(totalEligible[0]?.n ?? 0);
      const votedN = totalVoted.length;
      return {
        pollId: p.id,
        pollTitle: p.title,
        eligibleVoters: eligibleN,
        votersWhoVoted: votedN,
        turnoutPercent:
          eligibleN > 0 ? Math.round((votedN / eligibleN) * 1000) / 10 : 0,
      };
    }),
  );

  res.json({
    voterRegistration: usersBySchoolRows.map((r) => ({
      schoolId: r.schoolId ?? null,
      schoolName: r.schoolName ?? "Unassigned",
      registeredVoters: Number(r.n ?? 0),
    })),
    candidateRegistration: candidatesByPoll.map((r) => ({
      pollId: r.pollId ?? null,
      pollTitle: r.pollTitle ?? "Unknown",
      candidates: Number(r.n ?? 0),
    })),
    participation,
  });
}

export async function getElectionResultsReport(_req: Request, res: Response) {
  const polls = await db
    .select()
    .from(pollsTable)
    .orderBy(desc(pollsTable.createdAt));
  const now = new Date();
  const results = await Promise.all(
    polls.map(async (p) => {
      const status =
        now < p.startDate ? "upcoming" : now > p.endDate ? "closed" : "active";
      const seats = await db
        .select()
        .from(pollSeatsTable)
        .where(eq(pollSeatsTable.pollId, p.id));
      const seatResults = await Promise.all(
        seats.map(async (s) => {
          const candidates = await db
            .select({ id: candidatesTable.id, name: usersTable.name })
            .from(candidatesTable)
            .leftJoin(usersTable, eq(candidatesTable.userId, usersTable.id))
            .where(
              and(
                eq(candidatesTable.seatId, s.id),
                eq(candidatesTable.status, "approved"),
              ),
            );
          const counts = await Promise.all(
            candidates.map(async (c) => {
              const r = await db
                .select({ n: count() })
                .from(votesTable)
                .where(
                  and(
                    eq(votesTable.seatId, s.id),
                    eq(votesTable.candidateId, c.id),
                  ),
                );
              return {
                id: c.id,
                name: c.name ?? "",
                votes: Number(r[0]?.n ?? 0),
              };
            }),
          );
          const total = counts.reduce((a, c) => a + c.votes, 0);
          const winner = counts.length
            ? counts.reduce(
                (best, c) => (c.votes > best.votes ? c : best),
                counts[0],
              )
            : null;
          return {
            seatId: s.id,
            seatLabel: s.label,
            scope: s.scope,
            totalVotes: total,
            candidates: counts.map((c) => ({
              ...c,
              percentage:
                total > 0 ? Math.round((c.votes / total) * 1000) / 10 : 0,
              rank: counts.filter((x) => x.votes > c.votes).length + 1,
            })),
            winner:
              winner && winner.votes > 0
                ? { id: winner.id, name: winner.name }
                : null,
          };
        }),
      );
      return {
        pollId: p.id,
        pollTitle: p.title,
        pollType: p.pollType,
        status,
        startDate: p.startDate.toISOString(),
        endDate: p.endDate.toISOString(),
        seats: seatResults,
      };
    }),
  );
  res.json({ generatedAt: new Date().toISOString(), results });
}

export async function getVoterTurnoutReport(_req: Request, res: Response) {
  const polls = await db
    .select()
    .from(pollsTable)
    .orderBy(desc(pollsTable.createdAt));
  const now = new Date();
  const allStudents = await db
    .select({
      id: usersTable.id,
      schoolId: schoolsTable.id,
      schoolName: schoolsTable.name,
    })
    .from(usersTable)
    .leftJoin(coursesTable, eq(usersTable.courseId, coursesTable.id))
    .leftJoin(
      departmentsTable,
      eq(coursesTable.departmentId, departmentsTable.id),
    )
    .leftJoin(schoolsTable, eq(departmentsTable.schoolId, schoolsTable.id))
    .where(
      and(eq(usersTable.role, "student"), eq(usersTable.status, "active")),
    );

  const turnout = await Promise.all(
    polls.map(async (p) => {
      const status =
        now < p.startDate ? "upcoming" : now > p.endDate ? "closed" : "active";
      const voterIds = await db
        .selectDistinct({ userId: ballotTokensTable.userId })
        .from(ballotTokensTable)
        .where(
          and(
            eq(ballotTokensTable.pollId, p.id),
            eq(ballotTokensTable.used, true),
          ),
        );
      const votedSet = new Set(voterIds.map((v) => v.userId));
      const totalEligible = allStudents.length;
      const totalVoted = voterIds.length;

      const bySchool: Record<
        string,
        { schoolName: string; eligible: number; voted: number }
      > = {};
      for (const s of allStudents) {
        const key = s.schoolId ?? "unassigned";
        if (!bySchool[key])
          bySchool[key] = {
            schoolName: s.schoolName ?? "Unassigned",
            eligible: 0,
            voted: 0,
          };
        bySchool[key].eligible++;
        if (votedSet.has(s.id)) bySchool[key].voted++;
      }

      return {
        pollId: p.id,
        pollTitle: p.title,
        status,
        startDate: p.startDate.toISOString(),
        endDate: p.endDate.toISOString(),
        totalRegistered: totalEligible,
        totalVoted,
        turnoutPercent:
          totalEligible > 0
            ? Math.round((totalVoted / totalEligible) * 1000) / 10
            : 0,
        bySchool: Object.entries(bySchool).map(([id, v]) => ({
          schoolId: id,
          schoolName: v.schoolName,
          eligible: v.eligible,
          voted: v.voted,
          turnoutPercent:
            v.eligible > 0 ? Math.round((v.voted / v.eligible) * 1000) / 10 : 0,
        })),
      };
    }),
  );
  res.json({ generatedAt: new Date().toISOString(), turnout });
}

export async function getCandidateReport(_req: Request, res: Response) {
  const rows = await db
    .select({
      id: candidatesTable.id,
      pollId: candidatesTable.pollId,
      pollTitle: pollsTable.title,
      seatId: candidatesTable.seatId,
      seatLabel: pollSeatsTable.label,
      userId: candidatesTable.userId,
      name: usersTable.name,
      email: usersTable.email,
      gender: usersTable.gender,
      registrationNumber: usersTable.registrationNumber,
      courseName: coursesTable.name,
      manifesto: candidatesTable.manifesto,
      slogan: candidatesTable.slogan,
      bio: candidatesTable.bio,
      photoUrl: candidatesTable.photoUrl,
      status: candidatesTable.status,
      rejectionReason: candidatesTable.rejectionReason,
      reviewedAt: candidatesTable.reviewedAt,
      createdAt: candidatesTable.createdAt,
    })
    .from(candidatesTable)
    .leftJoin(pollsTable, eq(candidatesTable.pollId, pollsTable.id))
    .leftJoin(pollSeatsTable, eq(candidatesTable.seatId, pollSeatsTable.id))
    .leftJoin(usersTable, eq(candidatesTable.userId, usersTable.id))
    .leftJoin(coursesTable, eq(usersTable.courseId, coursesTable.id))
    .orderBy(desc(candidatesTable.createdAt));

  const withDocs = await Promise.all(
    rows.map(async (r) => {
      const docs = await db
        .select()
        .from(candidateDocumentsTable)
        .where(eq(candidateDocumentsTable.candidateId, r.id));
      return {
        id: r.id,
        pollId: r.pollId,
        pollTitle: r.pollTitle ?? "",
        seatId: r.seatId,
        seatLabel: r.seatLabel ?? "",
        userId: r.userId,
        name: r.name ?? "",
        email: r.email ?? "",
        gender: r.gender ?? null,
        registrationNumber: r.registrationNumber ?? null,
        courseName: r.courseName ?? null,
        manifesto: r.manifesto,
        slogan: r.slogan ?? null,
        bio: r.bio ?? null,
        photoUrl: r.photoUrl ?? null,
        status: r.status,
        rejectionReason: r.rejectionReason ?? null,
        reviewedAt: r.reviewedAt?.toISOString() ?? null,
        submittedAt: r.createdAt.toISOString(),
        documents: docs.map((d) => ({
          id: d.id,
          documentName: d.documentName,
          documentUrl: d.documentUrl,
          documentType: d.documentType,
          uploadedAt: d.uploadedAt.toISOString(),
        })),
      };
    }),
  );
  res.json({ generatedAt: new Date().toISOString(), candidates: withDocs });
}

export async function getVoterParticipationReport(
  _req: Request,
  res: Response,
) {
  const voters = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      registrationNumber: usersTable.registrationNumber,
      gender: usersTable.gender,
      status: usersTable.status,
      feeStatus: usersTable.feeStatus,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.role, "student"))
    .orderBy(desc(usersTable.createdAt));

  const polls = await db.select().from(pollsTable);

  const report = await Promise.all(
    voters.map(async (v) => {
      const votingActivity = await Promise.all(
        polls.map(async (p) => {
          const tokens = await db
            .select()
            .from(ballotTokensTable)
            .where(
              and(
                eq(ballotTokensTable.pollId, p.id),
                eq(ballotTokensTable.userId, v.id),
                eq(ballotTokensTable.used, true),
              ),
            );
          return {
            pollId: p.id,
            pollTitle: p.title,
            voted: tokens.length > 0,
            votedAt: tokens[0]?.usedAt?.toISOString() ?? null,
            seatsVoted: tokens.length,
          };
        }),
      );
      const totalVoted = votingActivity.filter((a) => a.voted).length;
      return {
        id: v.id,
        name: v.name,
        email: v.email,
        registrationNumber: v.registrationNumber ?? null,
        gender: v.gender ?? null,
        status: v.status,
        feeStatus: v.feeStatus ?? null,
        registeredAt: v.createdAt.toISOString(),
        totalPollsVoted: totalVoted,
        totalPolls: polls.length,
        participationRate:
          polls.length > 0
            ? Math.round((totalVoted / polls.length) * 1000) / 10
            : 0,
        votingActivity,
      };
    }),
  );
  res.json({ generatedAt: new Date().toISOString(), voters: report });
}

export async function getRejectedCandidatesReport(
  _req: Request,
  res: Response,
) {
  const rows = await db
    .select({
      id: candidatesTable.id,
      pollId: candidatesTable.pollId,
      pollTitle: pollsTable.title,
      seatId: candidatesTable.seatId,
      seatLabel: pollSeatsTable.label,
      userId: candidatesTable.userId,
      name: usersTable.name,
      email: usersTable.email,
      gender: usersTable.gender,
      registrationNumber: usersTable.registrationNumber,
      manifesto: candidatesTable.manifesto,
      status: candidatesTable.status,
      rejectionReason: candidatesTable.rejectionReason,
      reviewedAt: candidatesTable.reviewedAt,
      createdAt: candidatesTable.createdAt,
    })
    .from(candidatesTable)
    .leftJoin(pollsTable, eq(candidatesTable.pollId, pollsTable.id))
    .leftJoin(pollSeatsTable, eq(candidatesTable.seatId, pollSeatsTable.id))
    .leftJoin(usersTable, eq(candidatesTable.userId, usersTable.id))
    .where(and(eq(candidatesTable.status, "rejected")))
    .orderBy(desc(candidatesTable.createdAt));

  const withDocs = await Promise.all(
    rows.map(async (r) => {
      const docs = await db
        .select()
        .from(candidateDocumentsTable)
        .where(eq(candidateDocumentsTable.candidateId, r.id));
      return {
        id: r.id,
        pollId: r.pollId,
        pollTitle: r.pollTitle ?? "",
        seatId: r.seatId,
        seatLabel: r.seatLabel ?? "",
        name: r.name ?? "",
        email: r.email ?? "",
        gender: r.gender ?? null,
        registrationNumber: r.registrationNumber ?? null,
        positionAppliedFor: r.seatLabel ?? "",
        rejectionReason: r.rejectionReason ?? "No reason provided",
        reviewedAt: r.reviewedAt?.toISOString() ?? null,
        submittedAt: r.createdAt.toISOString(),
        status: r.status,
        documents: docs.map((d) => ({
          id: d.id,
          documentName: d.documentName,
          documentUrl: d.documentUrl,
          documentType: d.documentType,
        })),
      };
    }),
  );
  res.json({ generatedAt: new Date().toISOString(), rejected: withDocs });
}

export async function getAuditLog(_req: Request, res: Response) {
  const rows = await db
    .select()
    .from(auditLogTable)
    .orderBy(desc(auditLogTable.createdAt))
    .limit(500);
  res.json(
    rows.map((r) => ({
      id: r.id,
      action: r.action,
      actorEmail: r.actorEmail ?? null,
      actorRole: r.actorRole ?? null,
      target: r.target ?? null,
      details: r.details ?? null,
      ipAddress: r.ipAddress ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  );
}

export async function resetAdminPassword(req: Request, res: Response) {
  const { userId } = req.params;
  const { newPassword } = (req.body ?? {}) as Record<string, string>;
  if (!newPassword || newPassword.length < 8) {
    res
      .status(400)
      .json({ message: "newPassword must be at least 8 characters" });
    return;
  }
  await db
    .update(usersTable)
    .set({ passwordHash: await hashPassword(newPassword) })
    .where(eq(usersTable.id, userId as string));
  await audit({
    action: "admin.reset_password",
    actorEmail: req.user!.email,
    actorRole: "admin",
    target: userId as string,
  });
  res.json({ message: "Password reset successfully" });
}
