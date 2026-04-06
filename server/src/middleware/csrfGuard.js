import { COOKIE_NAME } from "../utils/jwt.js";
import { verifyCsrfRequest } from "../lib/csrf.js";

const EXEMPT_PREFIXES = [
  "/api/auth/register",
  "/api/auth/login",
];

/**
 * For authenticated cookie sessions, require a valid CSRF token on unsafe methods
 * (double-submit via HMAC; secret stays HttpOnly).
 */
export function csrfGuard(req, res, next) {
  const method = req.method;
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return next();
  }
  const path = req.originalUrl.split("?")[0];
  for (const p of EXEMPT_PREFIXES) {
    if (path === p || path.startsWith(`${p}/`)) {
      return next();
    }
  }
  if (!req.cookies?.[COOKIE_NAME]) {
    return next();
  }
  if (!verifyCsrfRequest(req)) {
    return res.status(403).json({ error: "Invalid or missing CSRF token" });
  }
  return next();
}
