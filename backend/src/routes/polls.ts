import { Router, type IRouter } from "express";
import {
  getActivePublicPolls,
  getPolls,
  getPoll,
  castVote,
  getPollResults,
} from "../controllers/polls.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { requireFeeCleared } from "../middleware/feeStatus.js";

const router: IRouter = Router();

router.get("/polls/active/public", getActivePublicPolls);
router.get("/polls", requireAuth, getPolls);
router.get("/polls/:pollId", requireAuth, getPoll);
router.post(
  "/polls/:pollId/vote",
  requireAuth,
  requireRole("student"),
  requireFeeCleared,
  castVote,
);
router.get("/polls/:pollId/results", requireAuth, getPollResults);

export default router;
