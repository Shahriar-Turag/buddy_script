import dotenv from "dotenv";

dotenv.config();

function required(name, fallback = "") {
  const v = process.env[name] ?? fallback;
  if (!v && process.env.NODE_ENV !== "test") {
    console.warn(`[env] Missing ${name}; using empty string`);
  }
  return v;
}

export const env = {
  port: Number(required("PORT", "4000")) || 4000,
  mongoUri: required("MONGODB_URI", "mongodb://127.0.0.1:27017/buddy_social"),
  jwtSecret: required("JWT_SECRET", "dev-only-secret-replace-in-production-min-32"),
  corsOrigin: required("CORS_ORIGIN", "http://localhost:3000"),
  nodeEnv: required("NODE_ENV", "development"),
  /** When set, avatars and post images are stored on ImgBB (recommended on Vercel). */
  imgbbApiKey: process.env.IMGBB_API_KEY ?? "",
};

if (env.nodeEnv === "production" && env.jwtSecret.length < 32) {
  console.error(
    "[env] JWT_SECRET must be at least 32 characters in production — set it in Vercel; login/register will fail until fixed"
  );
}

if (process.env.VERCEL === "1" && !env.imgbbApiKey?.trim()) {
  console.warn(
    "[env] IMGBB_API_KEY is unset — uploads use /tmp on Vercel and disappear between runs. Set IMGBB_API_KEY for persistent images."
  );
}
