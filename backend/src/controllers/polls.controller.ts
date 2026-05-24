import type { Request, Response } from "express";
import crypto from "node:crypto";
import {
  db,
  pollsTable,
  pollSeatsTable,
  candidatesTable,
  ballotTokensTable,
  votesTable,
  usersTable,
  coursesTable,
  departmentsTable,
  slatesTable,
  slateMembersTable,
} from "@workspace/db";
import { and, asc, count, desc, eq, lt, or } from "drizzle-orm";
import { audit } from "../lib/audit.js";

type PollStatus = "upcoming" | "active" | "closed";

function statusOf(p: { startDate: Date; endDate: Date }): PollStatus {
  // Use EAT (UTC+3) for comparison
  const now = new Date();
  if (now.getTime() < p.startDate.getTime()) return "upcoming";
  if (now.getTime() > p.endDate.getTime()) return "closed";
  return "active";
}

async function userVotedSeats(
  pollId: string,
  userId: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ seatId: ballotTokensTable.seatId })
    .from(ballotTokensTable)
    .where(
      and(
        eq(ballotTokensTable.pollId, pollId),
        eq(ballotTokensTable.userId, userId),
        eq(ballotTokensTable.used, true),
      ),
    );
  return new Set(rows.map((r) => r.seatId));
}

export async function isUserWinnerOfPreviousPoll(
  userId: string,
): Promise<boolean> {
  try {
    const now = new Date();
    const closedPolls = await db
      .select({ id: pollsTable.id, pollType: pollsTable.pollType })
      .from(pollsTable)
      .where(or(eq(pollsTable.locked, true), lt(pollsTable.endDate, now)));

    if (closedPolls.length === 0) return false;

    for (const p of closedPolls) {
      // 1. SGC Slate Winner Check
      if (p.pollType === "sgc") {
        const slates = await db
          .select({ id: slatesTable.id })
          .from(slatesTable)
          .where(eq(slatesTable.pollId, p.id));

        if (slates.length > 0) {
          const counts = await Promise.all(
            slates.map(async (s) => {
              const r = await db
                .select({ n: count() })
                .from(votesTable)
                .where(
                  and(
                    eq(votesTable.pollId, p.id),
                    eq(votesTable.slateId, s.id),
                  ),
                );
              return { id: s.id, votes: Number(r[0]?.n ?? 0) };
            }),
          );

          const winnerSlate = counts.reduce(
            (best, c) => (c.votes > best.votes ? c : best),
            counts[0],
          );

          if (winnerSlate && winnerSlate.votes > 0) {
            const membership = await db
              .select({ id: slateMembersTable.id })
              .from(slateMembersTable)
              .where(
                and(
                  eq(slateMembersTable.slateId, winnerSlate.id),
                  eq(slateMembersTable.userId, userId),
                ),
              )
              .limit(1);
            if (membership.length > 0) return true;
          }
        }
        continue;
      }

      // 2. General/SRC Candidate Winner Check
      const seats = await db
        .select({ id: pollSeatsTable.id })
        .from(pollSeatsTable)
        .where(eq(pollSeatsTable.pollId, p.id));

      for (const s of seats) {
        const candidates = await db
          .select({ id: candidatesTable.id, userId: candidatesTable.userId })
          .from(candidatesTable)
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
            return { id: c.id, userId: c.userId, votes: Number(r[0]?.n ?? 0) };
          }),
        );

        const winner = counts.length
          ? counts.reduce(
              (best, c) => (c.votes > best.votes ? c : best),
              counts[0],
            )
          : null;

        if (winner && winner.votes > 0 && winner.userId === userId) {
          return true;
        }
      }
    }
  } catch (error) {
    console.error("isUserWinnerOfPreviousPoll error:", error);
    return false;
  }
  return false;
}

async function eligibleSeatsForUser(pollId: string, userId: string) {
  const pollRows = await db
    .select({ pollType: pollsTable.pollType })
    .from(pollsTable)
    .where(eq(pollsTable.id, pollId))
    .limit(1);
  const poll = pollRows[0];

  // SGC Voting Restriction: Only winners of previous polls can vote in SGC elections
  if (poll?.pollType === "sgc") {
    const isWinner = await isUserWinnerOfPreviousPoll(userId);
    if (!isWinner) return [];

    // For SGC, use the first valid seat in the poll as the representative ID
    const pollSeats = await db
      .select({ id: pollSeatsTable.id })
      .from(pollSeatsTable)
      .where(eq(pollSeatsTable.pollId, pollId))
      .limit(1);

    if (pollSeats.length === 0) return [];
    return [{ id: pollSeats[0].id, label: "SGC Group Vote" }];
  }

  const seats = await db
    .select()
    .from(pollSeatsTable)
    .where(eq(pollSeatsTable.pollId, pollId));
  const userRows = await db
    .select({
      id: usersTable.id,
      gender: usersTable.gender,
      hostelId: usersTable.hostelId,
      courseId: usersTable.courseId,
      departmentId: coursesTable.departmentId,
      schoolId: departmentsTable.schoolId,
    })
    .from(usersTable)
    .leftJoin(coursesTable, eq(usersTable.courseId, coursesTable.id))
    .leftJoin(
      departmentsTable,
      eq(coursesTable.departmentId, departmentsTable.id),
    )
    .where(eq(usersTable.id, userId))
    .limit(1);
  const user = userRows[0];
  if (!user) return [];
  return seats.filter((s) => {
    if (s.gender && user.gender && s.gender !== user.gender) return false;
    if (s.scope === "school" && s.scopeRefId && user.schoolId !== s.scopeRefId)
      return false;
    if (
      s.scope === "department" &&
      s.scopeRefId &&
      user.departmentId !== s.scopeRefId
    )
      return false;
    if (s.scope === "hostel" && s.scopeRefId && user.hostelId !== s.scopeRefId)
      return false;
    // Non-residential: only off-campus students (no hostel assigned) may vote for their leader
    if (s.scope === "non-residential" && user.hostelId !== null) return false;
    // Residential: only students assigned to any hostel may vote for residential leaders
    if (s.scope === "residential" && user.hostelId === null) return false;
    return true;
  });
}

export async function getActivePublicPolls(_req: Request, res: Response) {
  const now = new Date();
  const polls = await db
    .select()
    .from(pollsTable)
    .orderBy(desc(pollsTable.startDate));
  const out = polls
    .filter((p) => p.startDate <= now && p.endDate >= now)
    .map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      startDate: p.startDate.toISOString(),
      endDate: p.endDate.toISOString(),
      status: statusOf(p) as PollStatus,
      locked: p.locked,
    }));
  res.json(out);
}

export async function getPolls(req: Request, res: Response) {
  try {
    const polls = await db
      .select()
      .from(pollsTable)
      .orderBy(desc(pollsTable.startDate));
    const out = await Promise.all(
      polls.map(async (p) => {
        const status = statusOf(p);
        let voted = false;
        let totalSeats = 0;
        let votedSeats = 0;
        if (req.user!.role === "student") {
          // Optimization: Pre-fetch eligibility to avoid redundant winner checks
          const eligibleSeats = await eligibleSeatsForUser(p.id, req.user!.id);
          totalSeats = eligibleSeats.length;
          const votedSet = await userVotedSeats(p.id, req.user!.id);
          votedSeats = eligibleSeats.filter((s) => votedSet.has(s.id)).length;
          voted = totalSeats > 0 && votedSeats === totalSeats;
        }
        return {
          id: p.id,
          title: p.title,
          description: p.description,
          startDate: p.startDate.toISOString(),
          endDate: p.endDate.toISOString(),
          status: status as PollStatus,
          locked: p.locked,
          eligibleSeats: totalSeats,
          votedSeats,
          voted,
        };
      }),
    );
    res.json(out);
  } catch (error) {
    console.error("getPolls error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getPoll(req: Request, res: Response) {
  try {
    const pollId = req.params.pollId as string;
    const pollRows = await db
      .select()
      .from(pollsTable)
      .where(eq(pollsTable.id, pollId))
      .limit(1);
    const poll = pollRows[0];
    if (!poll) {
      res.status(404).json({ message: "Poll not found" });
      return;
    }
    const status = statusOf(poll);
    const eligibleSeats =
      req.user!.role === "student"
        ? await eligibleSeatsForUser(pollId, req.user!.id)
        : await db
            .select()
            .from(pollSeatsTable)
            .where(eq(pollSeatsTable.pollId, pollId));
    const votedSet =
      req.user!.role === "student"
        ? await userVotedSeats(pollId, req.user!.id)
        : new Set<string>();
    const allSeats = await db
      .select()
      .from(pollSeatsTable)
      .where(eq(pollSeatsTable.pollId, pollId))
      .orderBy(asc(pollSeatsTable.position));

    const seatsWithCandidates = await Promise.all(
      allSeats.map(async (s) => {
        const isEligible = eligibleSeats.some((es) => es.id === s.id);
        const candidateRows = await db
          .select({
            id: candidatesTable.id,
            name: usersTable.name,
            manifesto: candidatesTable.manifesto,
            photoUrl: candidatesTable.photoUrl,
            status: candidatesTable.status,
          })
          .from(candidatesTable)
          .leftJoin(usersTable, eq(candidatesTable.userId, usersTable.id))
          .where(
            and(
              eq(candidatesTable.seatId, s.id),
              eq(candidatesTable.status, "approved"),
            ),
          );
        return {
          id: s.id,
          code: s.code,
          label: s.label,
          scope: s.scope as
            | "school"
            | "department"
            | "hostel"
            | "src"
            | "university",
          scopeRefId: s.scopeRefId ?? null,
          gender: (s.gender as "male" | "female" | null) ?? null,
          eligible: isEligible,
          voted: votedSet.has(s.id),
          candidates: candidateRows.map((c) => ({
            id: c.id,
            name: c.name ?? "",
            manifesto: c.manifesto ?? "",
            photoUrl: c.photoUrl ?? null,
          })),
        };
      }),
    );
    if (poll.pollType === "sgc") {
      const slates = await db
        .select()
        .from(slatesTable)
        .where(eq(slatesTable.pollId, pollId));

      const slatesWithMembers = await Promise.all(
        slates.map(async (slate) => {
          const members = await db
            .select({
              userId: slateMembersTable.userId,
              name: usersTable.name,
              role: slateMembersTable.role,
              seatId: slateMembersTable.seatId,
            })
            .from(slateMembersTable)
            .leftJoin(usersTable, eq(slateMembersTable.userId, usersTable.id))
            .where(eq(slateMembersTable.slateId, slate.id));

          const membersWithSeatLabel = members.map((m) => {
            const seat = allSeats.find((s) => s.id === m.seatId);
            return {
              ...m,
              seatLabel: seat?.label ?? m.role,
            };
          });

          return {
            id: slate.id,
            name: slate.name,
            slogan: slate.slogan,
            manifesto: slate.manifesto,
            members: membersWithSeatLabel,
          };
        }),
      );

      res.json({
        id: poll.id,
        title: poll.title,
        description: poll.description,
        startDate: poll.startDate.toISOString(),
        endDate: poll.endDate.toISOString(),
        status: status as PollStatus,
        locked: poll.locked,
        pollType: "sgc",
        slates: slatesWithMembers,
        voted: votedSet.size > 0,
        seats: seatsWithCandidates, // Include seats for admin view
      });
      return;
    }

    res.json({
      id: poll.id,
      title: poll.title,
      description: poll.description,
      startDate: poll.startDate.toISOString(),
      endDate: poll.endDate.toISOString(),
      status: status as PollStatus,
      locked: poll.locked,
      pollType: poll.pollType,
      seats: seatsWithCandidates,
    });
  } catch (error) {
    console.error("getPoll error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function castVote(req: Request, res: Response) {
  try {
    const { pollId } = req.params;
    const { selections, slateId } = (req.body ?? {}) as {
      selections?: Array<{
        seatId: string;
        candidateId: string;
        encryptedPayload: string;
      }>;
      slateId?: string;
    };

    const pollRows = await db
      .select()
      .from(pollsTable)
      .where(eq(pollsTable.id, pollId as string))
      .limit(1);
    const poll = pollRows[0];
    if (!poll) {
      res.status(404).json({ message: "Poll not found" });
      return;
    }
    if (statusOf(poll) !== "active" || poll.locked) {
      res
        .status(400)
        .json({ message: "Voting is not currently open for this poll" });
      return;
    }

    if (poll.pollType === "sgc") {
      if (!slateId) {
        res.status(400).json({ message: "slateId is required for SGC polls" });
        return;
      }

      // Strict Winner Check: Only winners of previous polls can vote in SGC elections
      const isWinner = await isUserWinnerOfPreviousPoll(req.user!.id);
      if (!isWinner) {
        res.status(403).json({
          message:
            "Only winners of previous polls are eligible to vote in SGC elections.",
        });
        return;
      }

      const pollSeats = await db
        .select({ id: pollSeatsTable.id })
        .from(pollSeatsTable)
        .where(eq(pollSeatsTable.pollId, pollId as string))
        .limit(1);

      if (!pollSeats[0]) {
        res.status(400).json({ message: "No seats defined for this SGC poll" });
        return;
      }
      const sgcSeatId = pollSeats[0].id;

      const existingToken = await db
        .select()
        .from(ballotTokensTable)
        .where(
          and(
            eq(ballotTokensTable.pollId, pollId as string),
            eq(ballotTokensTable.userId, req.user!.id),
            eq(ballotTokensTable.used, true),
          ),
        )
        .limit(1);

      if (existingToken[0]) {
        res
          .status(409)
          .json({ message: "You have already voted in this poll" });
        return;
      }

      const tokenRaw = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto
        .createHash("sha256")
        .update(tokenRaw)
        .digest("hex");

      await db.transaction(async (tx) => {
        await tx.insert(ballotTokensTable).values({
          pollId: pollId as string,
          seatId: sgcSeatId,
          userId: req.user!.id,
          tokenHash,
          used: true,
          usedAt: new Date(),
        });

        await tx.insert(votesTable).values({
          pollId: pollId as string,
          seatId: sgcSeatId,
          slateId: slateId,
          candidateId: null,
          encryptedPayload: "SGC_GROUP_VOTE",
          ballotHash: crypto
            .createHash("sha256")
            .update(`${tokenRaw}|${slateId}|${pollId}`)
            .digest("hex"),
          tokenHash,
        });
      });

      await audit({
        action: "vote.cast_sgc",
        actorEmail: req.user!.email,
        actorRole: "student",
        target: pollId as string,
        details: `slateId=${slateId}`,
      });

      res.json({
        message: "Your SGC group vote has been recorded successfully",
      });
      return;
    }

    if (!Array.isArray(selections) || selections.length === 0) {
      res.status(400).json({ message: "At least one selection is required" });
      return;
    }

    const eligibleSeats = await eligibleSeatsForUser(
      pollId as string,
      req.user!.id,
    );
    const eligibleIds = new Set(eligibleSeats.map((s) => s.id));

    for (const sel of selections) {
      if (!eligibleIds.has(sel.seatId)) {
        res
          .status(403)
          .json({ message: "Not eligible for one of the selected seats" });
        return;
      }
      const existingToken = await db
        .select()
        .from(ballotTokensTable)
        .where(
          and(
            eq(ballotTokensTable.pollId, pollId as string),
            eq(ballotTokensTable.seatId, sel.seatId),
            eq(ballotTokensTable.userId, req.user!.id),
            eq(ballotTokensTable.used, true),
          ),
        )
        .limit(1);
      if (existingToken[0]) {
        res.status(409).json({
          message: "You have already voted for one of the seats in this poll",
        });
        return;
      }
      const candRows = await db
        .select()
        .from(candidatesTable)
        .where(
          and(
            eq(candidatesTable.id, sel.candidateId),
            eq(candidatesTable.seatId, sel.seatId),
            eq(candidatesTable.status, "approved"),
          ),
        )
        .limit(1);
      if (!candRows[0]) {
        res
          .status(400)
          .json({ message: "Selected candidate is not valid for this seat" });
        return;
      }
    }

    const recorded: string[] = [];
    for (const sel of selections) {
      const tokenRaw = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto
        .createHash("sha256")
        .update(tokenRaw)
        .digest("hex");
      const ballotHash = crypto
        .createHash("sha256")
        .update(`${tokenRaw}|${sel.candidateId}|${sel.seatId}|${pollId}`)
        .digest("hex");
      await db.insert(ballotTokensTable).values({
        pollId: pollId as string,
        seatId: sel.seatId,
        userId: req.user!.id,
        tokenHash,
        used: true,
        usedAt: new Date(),
      });
      await db.insert(votesTable).values({
        pollId: pollId as string,
        seatId: sel.seatId,
        candidateId: sel.candidateId,
        encryptedPayload: sel.encryptedPayload,
        ballotHash,
        tokenHash,
      });
      recorded.push(sel.seatId);
    }
    await audit({
      action: "vote.cast",
      actorEmail: req.user!.email,
      actorRole: "student",
      target: pollId as string,
      details: `seats=${recorded.length}`,
    });
    res.json({
      message: "Your vote has been recorded successfully",
      recordedSeats: recorded,
    });
  } catch (error) {
    console.error("castVote error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getPollResults(req: Request, res: Response) {
  const pollId = req.params.pollId as string;
  const pollRows = await db
    .select()
    .from(pollsTable)
    .where(eq(pollsTable.id, pollId))
    .limit(1);
  const poll = pollRows[0];
  if (!poll) {
    res.status(404).json({ message: "Poll not found" });
    return;
  }
  const status = statusOf(poll);
  if (status !== "closed" && req.user!.role !== "admin") {
    res.status(403).json({ message: "Results are not yet available" });
    return;
  }

  if (poll.pollType === "sgc") {
    const slates = await db
      .select()
      .from(slatesTable)
      .where(eq(slatesTable.pollId, pollId));

    const slateResults = await Promise.all(
      slates.map(async (s) => {
        const r = await db
          .select({ n: count() })
          .from(votesTable)
          .where(
            and(eq(votesTable.pollId, pollId), eq(votesTable.slateId, s.id)),
          );
        return { id: s.id, name: s.name, votes: Number(r[0]?.n ?? 0) };
      }),
    );

    const totalVotes = slateResults.reduce((acc, s) => acc + s.votes, 0);
    const winner = slateResults.length
      ? slateResults.reduce(
          (b, c) => (c.votes > b.votes ? c : b),
          slateResults[0],
        )
      : null;

    res.json({
      pollId: poll.id,
      title: poll.title,
      startDate: poll.startDate.toISOString(),
      endDate: poll.endDate.toISOString(),
      status: status as PollStatus,
      pollType: "sgc",
      totalVotes,
      results: slateResults,
      winnerId: winner && winner.votes > 0 ? winner.id : null,
    });
    return;
  }

  const seats = await db
    .select()
    .from(pollSeatsTable)
    .where(eq(pollSeatsTable.pollId, pollId as string))
    .orderBy(asc(pollSeatsTable.position));
  const seatResults = await Promise.all(
    seats.map(async (s) => {
      const candidates = await db
        .select({
          id: candidatesTable.id,
          name: usersTable.name,
        })
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
          return { id: c.id, name: c.name ?? "", votes: Number(r[0]?.n ?? 0) };
        }),
      );
      const totalForSeat = counts.reduce((acc, c) => acc + c.votes, 0);
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
        totalVotes: totalForSeat,
        candidates: counts,
        winnerId: winner && winner.votes > 0 ? winner.id : null,
      };
    }),
  );
  res.json({
    pollId: poll.id,
    title: poll.title,
    startDate: poll.startDate.toISOString(),
    endDate: poll.endDate.toISOString(),
    status: status as PollStatus,
    seats: seatResults,
  });
}
