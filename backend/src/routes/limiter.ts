import rateLimit from "express-rate-limit";

/**
 * Limiter for authentication-related attempts (Login, MFA, etc.)
 * Prevents brute-force attacks.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 101, // Ensure 100 attempts are allowed before blocking
  message: {
    message:
      "Too many login attempts from this IP, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

/**
 * General limiter for registration or password resets
 */
export const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 101, // Limit each IP to 101 registration attempts per hour
  message: {
    message: "Too many accounts created from this IP, please try again later",
  },
});
