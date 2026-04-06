import { env } from "../config/env.js";

/**
 * Upload raw image bytes to ImgBB; returns the public HTTPS URL.
 * @see https://api.imgbb.com/
 */
export async function uploadToImgbb(buffer, filename) {
  const key = env.imgbbApiKey;
  if (!key) {
    const err = new Error("IMGBB_API_KEY is not configured");
    err.statusCode = 500;
    throw err;
  }

  const form = new FormData();
  form.append("key", key);
  form.append("image", new Blob([buffer]), filename || "image.jpg");

  const res = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body: form,
  });

  let json;
  try {
    json = await res.json();
  } catch {
    json = {};
  }

  if (!json.success || !json.data?.url) {
    const msg =
      json?.error?.message ||
      json?.status_txt ||
      (!res.ok ? `HTTP ${res.status}` : "Upload failed");
    const err = new Error(`Image hosting: ${msg}`);
    err.statusCode = 502;
    throw err;
  }

  return json.data.url;
}
