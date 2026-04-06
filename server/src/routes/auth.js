import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { User } from "../models/User.js";
import { validateBody } from "../middleware/validate.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { uploadImage } from "../utils/upload.js";
import { signToken, verifyToken, cookieOptions, COOKIE_NAME } from "../utils/jwt.js";
import {
  issueCsrfCookie,
  csrfTokenFromSecret,
  ensureCsrfToken,
  CSRF_COOKIE_NAME,
  csrfCookieOptions,
} from "../lib/csrf.js";
import { urlFromUploadedFile } from "../utils/persistUpload.js";

const router = Router();

const registerSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().email().max(320).toLowerCase(),
  password: z
    .string()
    .min(10)
    .max(128)
    .regex(
      /^(?=.*[A-Za-z])(?=.*\d).+$/,
      "Password must include at least one letter and one number"
    ),
});

const loginSchema = z.object({
  email: z.string().email().max(320).toLowerCase(),
  password: z.string().min(1).max(128),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, try again later" },
});

function userPublic(u) {
  return {
    id: u._id.toString(),
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    avatarUrl: u.avatarUrl ?? null,
  };
}

router.post(
  "/register",
  authLimiter,
  validateBody(registerSchema),
  async (req, res) => {
    const { firstName, lastName, email, password } = req.body;
    const existing = await User.findOne({ email }).lean();
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      firstName,
      lastName,
      email,
      passwordHash,
    });
    const token = signToken(user._id.toString());
    res.cookie(COOKIE_NAME, token, cookieOptions());
    const csrfSecret = issueCsrfCookie(res);
    return res.status(201).json({
      user: userPublic(user),
      csrfToken: csrfTokenFromSecret(csrfSecret),
    });
  }
);

router.post("/login", authLimiter, validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const token = signToken(user._id.toString());
  res.cookie(COOKIE_NAME, token, cookieOptions());
  const csrfSecret = issueCsrfCookie(res);
  return res.json({
    user: userPublic(user),
    csrfToken: csrfTokenFromSecret(csrfSecret),
  });
});

router.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: 0 });
  res.clearCookie(CSRF_COOKIE_NAME, { ...csrfCookieOptions(), maxAge: 0 });
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).lean();
  if (!user) {
    res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: 0 });
    res.clearCookie(CSRF_COOKIE_NAME, { ...csrfCookieOptions(), maxAge: 0 });
    return res.status(401).json({ error: "Unauthorized" });
  }
  const csrfToken = ensureCsrfToken(req, res);
  return res.json({ user: userPublic(user), csrfToken });
});

router.patch(
  "/me",
  requireAuth,
  uploadImage.single("avatar"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Image required (form field name: avatar)" });
      }
      const avatarUrl = await urlFromUploadedFile(req.file);
      if (!avatarUrl) {
        return res.status(400).json({ error: "Could not process image" });
      }
      const user = await User.findByIdAndUpdate(req.userId, { avatarUrl }, { new: true }).lean();
      if (!user) {
        res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: 0 });
        return res.status(401).json({ error: "Unauthorized" });
      }
      return res.json({ user: userPublic(user) });
    } catch (e) {
      next(e);
    }
  }
);

/** Optional: validate cookie without full user fetch */
router.get("/session", (req, res) => {
  const raw = req.cookies?.[COOKIE_NAME];
  const uid = raw ? verifyToken(raw) : null;
  return res.json({ authenticated: Boolean(uid) });
});

export default router;
