import express from "express";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import hpp from "hpp";
import { sanitizeBody } from "./middleware/sanitizeBody.js";
import { csrfGuard } from "./middleware/csrfGuard.js";
import multer from "multer";
import { env } from "./config/env.js";
import { ensureUploadDir } from "./utils/upload.js";
import authRoutes from "./routes/auth.js";
import postsRoutes from "./routes/posts.js";
import commentsRoutes from "./routes/comments.js";
import notificationsRoutes from "./routes/notifications.js";

export function createApp() {
  ensureUploadDir();

  const app = express();

  app.set("trust proxy", 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: false,
    })
  );

  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
    })
  );

  app.use(express.json({ limit: "512kb" }));
  app.use(cookieParser());
  app.use(csrfGuard);

  app.use(
    sanitizeBody({
      replaceWith: "_",
      onSanitize: ({ req, key }) => {
        if (env.nodeEnv === "development") {
          console.warn(`[mongo-sanitize] sanitized ${key} on ${req.path}`);
        }
      },
    })
  );

  app.use(hpp());

  const uploadsPath = path.join(process.cwd(), "uploads");
  app.use(
    "/uploads",
    express.static(uploadsPath, {
      maxAge: env.nodeEnv === "production" ? "7d" : 0,
      fallthrough: false,
    })
  );

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/posts", postsRoutes);
  app.use("/api/comments", commentsRoutes);
  app.use("/api/notifications", notificationsRoutes);

  app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "Image must be 5MB or smaller" });
      }
      return res.status(400).json({ error: "Upload error" });
    }
    if (err?.message === "File type not allowed" || err?.code === "INVALID_FILE_TYPE") {
      return res.status(400).json({ error: "Only JPEG, PNG, WebP, or GIF images" });
    }
    console.error(err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
