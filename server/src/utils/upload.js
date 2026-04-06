import multer from "multer";
import path from "path";
import { randomBytes } from "crypto";
import fs from "fs";

/** Vercel serverless only allows reliable writes under /tmp. */
export function getUploadDir() {
  if (process.env.VERCEL) {
    return path.join("/tmp", "buddy-uploads");
  }
  return path.join(process.cwd(), "uploads");
}

export function ensureUploadDir() {
  const uploadDir = getUploadDir();
  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  } catch {
    /* ignore — some hosts restrict fs; multer may still fail at upload time */
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadDir();
    cb(null, getUploadDir());
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)
      ? ext
      : ".bin";
    cb(null, `${randomBytes(24).toString("hex")}${safeExt}`);
  },
});

function fileFilter(_req, file, cb) {
  const allowed = /^image\/(jpeg|png|webp|gif)$/;
  if (allowed.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("File type not allowed"));
  }
}

export const uploadImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter,
});
