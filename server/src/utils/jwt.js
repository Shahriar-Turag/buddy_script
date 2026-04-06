import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const COOKIE_NAME = "buddy_token";

function assertJwtReadyForSigning() {
  if (env.nodeEnv === "production" && env.jwtSecret.length < 32) {
    const err = new Error("JWT_SECRET must be at least 32 characters in production");
    err.statusCode = 503;
    throw err;
  }
}

export function signToken(userId) {
  assertJwtReadyForSigning();
  return jwt.sign({ sub: userId }, env.jwtSecret, {
    expiresIn: "7d",
    issuer: "buddy-api",
    audience: "buddy-web",
  });
}

export function verifyToken(token) {
  if (env.nodeEnv === "production" && env.jwtSecret.length < 32) {
    return null;
  }
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
