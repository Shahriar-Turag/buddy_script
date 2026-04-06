import crypto from "crypto";
import { env } from "../config/env.js";

/** HttpOnly secret; HMAC becomes the token the SPA sends in X-CSRF-Token. */
export const CSRF_COOKIE_NAME = "buddy_csrf";

export function csrfCookieOptions() {
  return {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

export function issueCsrfCookie(res) {
  const secret = crypto.randomBytes(32).toString("hex");
  res.cookie(CSRF_COOKIE_NAME, secret, csrfCookieOptions());
  return secret;
}

/** Token derived from secret (client never sees the secret). */
export function csrfTokenFromSecret(secret) {
  return crypto.createHmac("sha256", env.jwtSecret).update(`csrf:${secret}`).digest("base64url");
}

export function ensureCsrfToken(req, res) {
  let secret = req.cookies?.[CSRF_COOKIE_NAME];
  if (!secret || typeof secret !== "string") {
    secret = issueCsrfCookie(res);
  }
  return csrfTokenFromSecret(secret);
}

export function verifyCsrfRequest(req) {
  const secret = req.cookies?.[CSRF_COOKIE_NAME];
  const token = req.get("x-csrf-token");
  if (!secret || typeof secret !== "string" || !token || typeof token !== "string") {
    return false;
  }
  const expected = csrfTokenFromSecret(secret);
  const a = Buffer.from(token, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
