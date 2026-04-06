import fs from "fs";
import { fileTypeFromFile, fileTypeFromBuffer } from "file-type";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/**
 * Confirms on-disk bytes match an allowed image type (not just multipart Content-Type).
 */
export async function assertAllowedImageFile(filePath) {
  const type = await fileTypeFromFile(filePath);
  if (!type || !ALLOWED.has(type.mime)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      /* ignore */
    }
    const err = new Error("File type not allowed");
    err.code = "INVALID_FILE_TYPE";
    throw err;
  }
}

/** Same checks for in-memory multipart (e.g. ImgBB path). */
export async function assertAllowedImageBuffer(buffer) {
  const type = await fileTypeFromBuffer(buffer);
  if (!type || !ALLOWED.has(type.mime)) {
    const err = new Error("File type not allowed");
    err.code = "INVALID_FILE_TYPE";
    throw err;
  }
}
