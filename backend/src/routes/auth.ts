import { Router, type IRouter } from "express";
import {
  prefillRegistration,
  register,
  verifyOtp,
  resendOtp,
  login,
  adminLogin,
  forgotPassword,
  resetPassword,
  getMe,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter, registrationLimiter } from "../middleware/limiter.js";

const router: IRouter = Router();

router.get("/auth/prefill", prefillRegistration);
router.post("/auth/register", registrationLimiter, register);
router.post("/auth/verify-otp", authLimiter, verifyOtp);
router.post("/auth/resend-otp", resendOtp);
router.post("/auth/login", authLimiter, login);
router.post("/admin/login", authLimiter, adminLogin);
router.post("/auth/forgot-password", registrationLimiter, forgotPassword);
router.post("/auth/reset-password", resetPassword);
router.get("/auth/me", requireAuth, getMe);

export default router;
