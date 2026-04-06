import path from "path";
import { uploadToImgbb } from "../lib/imgbb.js";
import { assertAllowedImageBuffer, assertAllowedImageFile } from "./verifyUpload.js";

function safeUploadName(originalname) {
  const base = path.basename(originalname || "image.jpg").replace(/[^\w.\-]+/g, "_");
  return base || "image.jpg";
}

/**
 * After multer has accepted the file: verify magic bytes, then either store on ImgBB
 * (returns full URL) or keep local path `/uploads/...` (dev / own server).
 */
export async function urlFromUploadedFile(file) {
  if (!file) return null;

  if (file.buffer) {
    await assertAllowedImageBuffer(file.buffer);
    const name = safeUploadName(file.originalname);
    return uploadToImgbb(file.buffer, name);
  }

  if (file.path) {
    await assertAllowedImageFile(file.path);
    return `/uploads/${file.filename}`;
  }

  return null;
}
