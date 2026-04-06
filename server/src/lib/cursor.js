import mongoose from "mongoose";

export function encodePostCursor(doc) {
  if (!doc) return null;
  const payload = {
    t: doc.createdAt.getTime(),
    id: doc._id.toString(),
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodePostCursor(cursor) {
  if (!cursor || typeof cursor !== "string") return null;
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const { t, id } = JSON.parse(raw);
    if (typeof t !== "number" || typeof id !== "string") return null;
    return {
      createdAt: new Date(t),
      _id: new mongoose.Types.ObjectId(id),
    };
  } catch {
    return null;
  }
}
