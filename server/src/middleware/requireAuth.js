import { verifyToken, COOKIE_NAME } from "../utils/jwt.js";

export function requireAuth(req, res, next) {
  const raw =
    req.cookies?.[COOKIE_NAME] ||
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : null);

  const userId = raw ? verifyToken(raw) : null;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.userId = userId;
  next();
}
