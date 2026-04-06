import { Router } from "express";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import { Notification } from "../models/Notification.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { serializeUser } from "../lib/serializeUser.js";

const router = Router();
const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(requireAuth);

function bodyForType(type, actor) {
  const name = actor ? `${actor.firstName} ${actor.lastName}` : "Someone";
  switch (type) {
    case "post_like":
      return `${name} liked your post.`;
    case "post_comment":
      return `${name} commented on your post.`;
    case "comment_reply":
      return `${name} replied to your comment.`;
    case "comment_like":
      return `${name} liked your comment.`;
    default:
      return "New notification.";
  }
}

function encodeCursor(doc) {
  if (!doc) return null;
  return Buffer.from(
    JSON.stringify({ t: doc.createdAt.getTime(), id: doc._id.toString() }),
    "utf8"
  ).toString("base64url");
}

function decodeCursor(s) {
  if (!s || typeof s !== "string") return null;
  try {
    const raw = Buffer.from(s, "base64url").toString("utf8");
    const { t, id } = JSON.parse(raw);
    if (!Number.isFinite(t) || !mongoose.isValidObjectId(id)) return null;
    return { createdAt: new Date(t), _id: new mongoose.Types.ObjectId(id) };
  } catch {
    return null;
  }
}

router.get("/", readLimiter, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const unreadOnly = req.query.unread === "1" || req.query.unread === "true";
  const cursor = decodeCursor(req.query.cursor);

  const filter = { recipient: req.userId };
  if (unreadOnly) filter.read = false;
  if (cursor) {
    filter.$or = [
      { createdAt: { $lt: cursor.createdAt } },
      {
        createdAt: cursor.createdAt,
        _id: { $lt: cursor._id },
      },
    ];
  }

  const rows = await Notification.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .populate("actor", "firstName lastName avatarUrl")
    .lean();

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? encodeCursor(slice[slice.length - 1]) : null;

  const unreadCount = await Notification.countDocuments({
    recipient: req.userId,
    read: false,
  });

  const notifications = slice.map((n) => {
    const actor = n.actor;
    return {
      id: n._id.toString(),
      type: n.type,
      read: n.read,
      createdAt: n.createdAt,
      actor: serializeUser(actor),
      postId: n.post ? n.post.toString() : null,
      commentId: n.comment ? n.comment.toString() : null,
      body: bodyForType(n.type, actor || null),
    };
  });

  res.json({ notifications, nextCursor, unreadCount });
});

router.patch("/read-all", writeLimiter, async (req, res) => {
  const r = await Notification.updateMany(
    { recipient: req.userId, read: false },
    { $set: { read: true } }
  );
  res.json({ ok: true, modified: r.modifiedCount });
});

router.patch("/:id/read", writeLimiter, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }
  const n = await Notification.findOneAndUpdate(
    { _id: id, recipient: req.userId },
    { $set: { read: true } },
    { new: true }
  );
  if (!n) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

export default router;
