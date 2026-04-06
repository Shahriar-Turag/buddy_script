import { Router } from "express";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import { Comment } from "../models/Comment.js";
import { Post } from "../models/Post.js";
import { Like } from "../models/Like.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { notifyIfNeeded } from "../lib/notify.js";
import { serializeUser } from "../lib/serializeUser.js";

const router = Router();
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(requireAuth);

async function canAccessComment(userId, commentId) {
  const comment = await Comment.findById(commentId).lean();
  if (!comment) return null;
  const post = await Post.findById(comment.post).lean();
  if (!post) return null;
  const canSee =
    post.visibility === "public" || post.author.toString() === userId;
  if (!canSee) return null;
  return { comment, post };
}

router.get("/:commentId/likes", async (req, res) => {
  const { commentId } = req.params;
  if (!mongoose.isValidObjectId(commentId)) {
    return res.status(400).json({ error: "Invalid comment id" });
  }
  const ctx = await canAccessComment(req.userId, commentId);
  if (!ctx) return res.status(404).json({ error: "Not found" });

  const skip = Math.min(Number(req.query.skip) || 0, 10_000);
  const limit = Math.min(Number(req.query.limit) || 30, 100);

  const rows = await Like.find({ targetType: "comment", targetId: commentId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("user", "firstName lastName avatarUrl")
    .lean();

  res.json({
    total: ctx.comment.likeCount,
    users: rows.map((r) => ({
      ...serializeUser(r.user),
      reaction: r.reaction || "like",
    })),
  });
});

router.post("/:commentId/like", writeLimiter, async (req, res) => {
  const { commentId } = req.params;
  if (!mongoose.isValidObjectId(commentId)) {
    return res.status(400).json({ error: "Invalid comment id" });
  }
  const ctx = await canAccessComment(req.userId, commentId);
  if (!ctx) return res.status(404).json({ error: "Not found" });

  const comment = await Comment.findById(commentId);
  try {
    await Like.create({
      targetType: "comment",
      targetId: comment._id,
      user: req.userId,
    });
    await Comment.findByIdAndUpdate(comment._id, { $inc: { likeCount: 1 } });
    await notifyIfNeeded({
      recipientId: comment.author,
      actorId: req.userId,
      type: "comment_like",
      postId: ctx.post._id,
      commentId: comment._id,
    });
  } catch (e) {
    if (e.code === 11000) {
      const c = await Comment.findById(commentId).select("likeCount").lean();
      return res.json({ liked: true, likeCount: c?.likeCount ?? comment.likeCount });
    }
    throw e;
  }
  const c = await Comment.findById(commentId).select("likeCount").lean();
  res.json({ liked: true, likeCount: c?.likeCount ?? comment.likeCount });
});

router.delete("/:commentId/like", writeLimiter, async (req, res) => {
  const { commentId } = req.params;
  if (!mongoose.isValidObjectId(commentId)) {
    return res.status(400).json({ error: "Invalid comment id" });
  }
  const ctx = await canAccessComment(req.userId, commentId);
  if (!ctx) return res.status(404).json({ error: "Not found" });

  const del = await Like.findOneAndDelete({
    targetType: "comment",
    targetId: commentId,
    user: req.userId,
  });
  if (del) {
    await Comment.findOneAndUpdate(
      { _id: commentId, likeCount: { $gt: 0 } },
      { $inc: { likeCount: -1 } }
    );
  }
  const comment = await Comment.findById(commentId).select("likeCount").lean();
  res.json({ liked: false, likeCount: comment?.likeCount ?? 0 });
});

export default router;
