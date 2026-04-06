import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const COOKIE_NAME = "buddy_token";

export function signToken(userId) {
  return jwt.sign({ sub: userId }, env.jwtSecret, {
    expiresIn: "7d",
    issuer: "buddy-api",
    audience: "buddy-web",
  });
}

export function verifyToken(token) {
  try {
    const payload = jwt.verify(token, env.jwtSecret, {
      issuer: "buddy-api",
      audience: "buddy-web",
    });
    return payload.sub;
  } catch {
    return null;
  }
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

export { COOKIE_NAME };
