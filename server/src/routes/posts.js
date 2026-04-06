import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { Post } from "../models/Post.js";
import { Comment } from "../models/Comment.js";
import { Like } from "../models/Like.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { validateBody } from "../middleware/validate.js";
import { uploadImage } from "../utils/upload.js";
import { encodePostCursor, decodePostCursor } from "../lib/cursor.js";
import { loadLikeMeta } from "../lib/enrich.js";
import { notifyIfNeeded } from "../lib/notify.js";
import { serializeUser } from "../lib/serializeUser.js";
import { assertAllowedImageFile } from "../utils/verifyUpload.js";

const router = Router();
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

const createPostSchema = z.object({
  text: z.string().trim().min(1).max(10000),
  visibility: z.enum(["public", "private"]).default("public"),
});

const commentSchema = z.object({
  text: z.string().trim().min(1).max(5000),
  parentId: z.string().optional().nullable(),
});

const postLikeReactionSchema = z.object({
  reaction: z.enum(["like", "love", "haha", "sad"]).optional(),
});

const batchCommentThreadsSchema = z.object({
  postIds: z.array(z.string()).min(1).max(30),
});

const emptyReactionCounts = () => ({
  like: 0,
  love: 0,
  haha: 0,
  sad: 0,
});

async function aggregatePostReactionCounts(postId) {
  const oid =
    postId instanceof mongoose.Types.ObjectId
      ? postId
      : new mongoose.Types.ObjectId(postId);
  const rows = await Like.aggregate([
    { $match: { targetType: "post", targetId: oid } },
    { $group: { _id: { $ifNull: ["$reaction", "like"] }, n: { $sum: 1 } } },
  ]);
  const out = emptyReactionCounts();
  for (const r of rows) {
    if (r._id in out) out[r._id] = r.n;
  }
  return out;
}

function buildCommentTree(flat, likeMeta) {
  const byId = new Map();
  for (const c of flat) {
    byId.set(c._id.toString(), { ...c, replies: [] });
  }
  const roots = [];
  for (const c of flat) {
    const node = byId.get(c._id.toString());
    const p = c.parent;
    if (p) {
      const parent = byId.get(p.toString());
      if (parent) parent.replies.push(node);
      else roots.push(node);
    } else {
      roots.push(node);
    }
  }

  function mapNode(n) {
    const id = n._id.toString();
    const { likedByMe, preview } = likeMeta.comment.get(id) || {
      likedByMe: false,
      preview: [],
    };
    return {
      id,
      text: n.text,
      createdAt: n.createdAt,
      author: serializeUser(n.author),
      likeCount: n.likeCount ?? 0,
      likedByMe,
      likedByPreview: preview,
      replies: (n.replies || []).map(mapNode),
    };
  }

  return roots.map(mapNode);
}

/** Bounded comment load per feed batch: max 50 roots/replies-included per post, 600 total. */
async function buildThreadsForPosts(visiblePostObjectIds, currentUserId) {
  if (!visiblePostObjectIds.length) return {};
  const maxTotal = Math.min(50 * visiblePostObjectIds.length, 600);
  const raw = await Comment.find({ post: { $in: visiblePostObjectIds } })
    .sort({ post: 1, createdAt: 1 })
    .limit(maxTotal)
    .populate("author", "firstName lastName avatarUrl")
    .lean();
  const perPost = new Map();
  for (const oid of visiblePostObjectIds) {
    perPost.set(oid.toString(), []);
  }
  for (const c of raw) {
    const k = c.post.toString();
    const arr = perPost.get(k);
    if (arr && arr.length < 50) {
      arr.push(c);
    }
  }
  const flatList = [...perPost.values()].flat();
  const commentLike = await loadLikeMeta(
    "comment",
    flatList.map((c) => c._id),
    currentUserId
  );
  const likeMeta = { comment: new Map() };
  for (const c of flatList) {
    const key = c._id.toString();
    likeMeta.comment.set(key, {
      likedByMe: Boolean(commentLike.likedByMe.get(key)),
      preview: commentLike.preview.get(key) || [],
    });
  }
  const out = {};
  for (const [pid, flat] of perPost.entries()) {
    out[pid] = buildCommentTree(flat, likeMeta);
  }
  return out;
}

router.use(requireAuth);

router.post(
  "/batch/comment-threads",
  readLimiter,
  validateBody(batchCommentThreadsSchema),
  async (req, res) => {
    const rawIds = req.body.postIds.filter((id) => mongoose.isValidObjectId(id)).slice(0, 30);
    if (!rawIds.length) {
      return res.status(400).json({ error: "No valid post ids" });
    }
    const oids = rawIds.map((id) => new mongoose.Types.ObjectId(id));
    const posts = await Post.find({
      _id: { $in: oids },
      $or: [{ visibility: "public" }, { author: req.userId }],
    })
      .select("_id")
      .lean();
    const visible = posts.map((p) => p._id);
    const threads = await buildThreadsForPosts(visible, req.userId);
    return res.json({ threads });
  }
);

router.get("/", readLimiter, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const cursor = decodePostCursor(req.query.cursor);

  const visibilityOr = {
    $or: [{ visibility: "public" }, { author: req.userId }],
  };

  const filter = { ...visibilityOr };
  if (cursor) {
    filter.$and = [
      visibilityOr,
      {
        $or: [
          { createdAt: { $lt: cursor.createdAt } },
          {
            createdAt: cursor.createdAt,
            _id: { $lt: cursor._id },
          },
        ],
      },
    ];
    delete filter.$or;
  }

  const posts = await Post.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .populate("author", "firstName lastName avatarUrl")
    .lean();

  const hasMore = posts.length > limit;
  const slice = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor = hasMore ? encodePostCursor(slice[slice.length - 1]) : null;

  const postIds = slice.map((p) => p._id);
  const postLike = await loadLikeMeta("post", postIds, req.userId);

  const body = slice.map((p) => {
    const pid = p._id.toString();
    const pk = pid;
    return {
      id: pid,
      text: p.text,
      imageUrl: p.imageUrl,
      visibility: p.visibility,
      createdAt: p.createdAt,
      author: serializeUser(p.author),
      likeCount: p.likeCount,
      likedByMe: Boolean(postLike.likedByMe.get(pk)),
      myReaction: postLike.myReaction.get(pk) ?? null,
      reactionCounts: postLike.reactionCounts.get(pk) ?? emptyReactionCounts(),
      likedByPreview: postLike.preview.get(pk) || [],
      commentCount: p.commentCount,
      comments: [],
    };
  });

  res.json({ posts: body, nextCursor });
});

router.post(
  "/",
  writeLimiter,
  uploadImage.single("image"),
  async (req, res, next) => {
    try {
      let text;
      let visibility = "public";
      if (req.is("multipart/form-data")) {
        text = req.body?.text;
        visibility = req.body?.visibility === "private" ? "private" : "public";
      } else {
        const parsed = createPostSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: "Validation failed",
            details: parsed.error.flatten(),
          });
        }
        text = parsed.data.text;
        visibility = parsed.data.visibility;
      }

      if (!text || typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ error: "Text is required" });
      }
      if (text.length > 10000) {
        return res.status(400).json({ error: "Text too long" });
      }

      let imageUrl = null;
      if (req.file?.path) {
        await assertAllowedImageFile(req.file.path);
        imageUrl = `/uploads/${req.file.filename}`;
      }

      const post = await Post.create({
        author: req.userId,
        text: text.trim(),
        imageUrl,
        visibility,
      });
      const populated = await Post.findById(post._id)
        .populate("author", "firstName lastName avatarUrl")
        .lean();

      res.status(201).json({
        post: {
          id: populated._id.toString(),
          text: populated.text,
          imageUrl: populated.imageUrl,
          visibility: populated.visibility,
          createdAt: populated.createdAt,
          author: serializeUser(populated.author),
          likeCount: populated.likeCount,
          likedByMe: false,
          myReaction: null,
          reactionCounts: emptyReactionCounts(),
          likedByPreview: [],
          commentCount: 0,
          comments: [],
        },
      });
    } catch (e) {
      next(e);
    }
  }
);

/** Full card + comments for one post (keeps feed UI in sync without re-pagination). */
router.get("/:postId/hydrate", readLimiter, async (req, res) => {
  const { postId } = req.params;
  if (!mongoose.isValidObjectId(postId)) {
    return res.status(400).json({ error: "Invalid post id" });
  }
  const post = await Post.findById(postId).populate("author", "firstName lastName avatarUrl").lean();
  if (!post) return res.status(404).json({ error: "Not found" });
  const canSee =
    post.visibility === "public" || post.author._id.toString() === req.userId;
  if (!canSee) return res.status(404).json({ error: "Not found" });

  const pk = post._id.toString();
  const postLike = await loadLikeMeta("post", [post._id], req.userId);

  const flat = await Comment.find({ post: post._id })
    .sort({ createdAt: 1 })
    .limit(400)
    .populate("author", "firstName lastName avatarUrl")
    .lean();
  const commentIds = flat.map((c) => c._id);
  const commentLike = await loadLikeMeta("comment", commentIds, req.userId);
  const likeMeta = { comment: new Map() };
  for (const cid of commentIds) {
    const key = cid.toString();
    likeMeta.comment.set(key, {
      likedByMe: Boolean(commentLike.likedByMe.get(key)),
      preview: commentLike.preview.get(key) || [],
    });
  }
  const tree = buildCommentTree(flat, likeMeta);

  res.json({
    post: {
      id: pk,
      text: post.text,
      imageUrl: post.imageUrl,
      visibility: post.visibility,
      createdAt: post.createdAt,
      author: serializeUser(post.author),
      likeCount: post.likeCount,
      likedByMe: Boolean(postLike.likedByMe.get(pk)),
      myReaction: postLike.myReaction.get(pk) ?? null,
      reactionCounts: postLike.reactionCounts.get(pk) ?? emptyReactionCounts(),
      likedByPreview: postLike.preview.get(pk) || [],
      commentCount: post.commentCount,
      comments: tree,
    },
  });
});

router.get("/:postId/likes", readLimiter, async (req, res) => {
  const { postId } = req.params;
  if (!mongoose.isValidObjectId(postId)) {
    return res.status(400).json({ error: "Invalid post id" });
  }
  const post = await Post.findById(postId).lean();
  if (!post) return res.status(404).json({ error: "Not found" });
  const canSee =
    post.visibility === "public" || post.author.toString() === req.userId;
  if (!canSee) return res.status(404).json({ error: "Not found" });

  const skip = Math.min(Number(req.query.skip) || 0, 10_000);
  const limit = Math.min(Number(req.query.limit) || 30, 100);

  const rows = await Like.find({ targetType: "post", targetId: postId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("user", "firstName lastName avatarUrl")
    .lean();

  res.json({
    total: post.likeCount,
    users: rows.map((r) => ({
      ...serializeUser(r.user),
      reaction: r.reaction || "like",
    })),
  });
});

router.post(
  "/:postId/like",
  writeLimiter,
  validateBody(postLikeReactionSchema),
  async (req, res) => {
    const { postId } = req.params;
    if (!mongoose.isValidObjectId(postId)) {
      return res.status(400).json({ error: "Invalid post id" });
    }
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: "Not found" });
    const canSee =
      post.visibility === "public" || post.author.toString() === req.userId;
    if (!canSee) return res.status(404).json({ error: "Not found" });

    const reaction = req.body.reaction ?? "like";

    const existing = await Like.findOne({
      targetType: "post",
      targetId: post._id,
      user: req.userId,
    });

    if (!existing) {
      await Like.create({
        targetType: "post",
        targetId: post._id,
        user: req.userId,
        reaction,
      });
      const updated = await Post.findByIdAndUpdate(
        post._id,
        { $inc: { likeCount: 1 } },
        { new: true }
      ).lean();
      await notifyIfNeeded({
        recipientId: post.author,
        actorId: req.userId,
        type: "post_like",
        postId: post._id,
      });
      post.likeCount = updated?.likeCount ?? post.likeCount + 1;
    } else {
      const prev = existing.reaction || "like";
      if (prev !== reaction) {
        existing.reaction = reaction;
        await existing.save();
      }
    }

    const counts = await aggregatePostReactionCounts(post._id);
    const latest = await Post.findById(post._id).select("likeCount").lean();
    res.json({
      liked: true,
      likeCount: latest?.likeCount ?? post.likeCount,
      myReaction: reaction,
      reactionCounts: counts,
    });
  }
);

router.delete("/:postId", writeLimiter, async (req, res) => {
  const { postId } = req.params;
  if (!mongoose.isValidObjectId(postId)) {
    return res.status(400).json({ error: "Invalid post id" });
  }
  const post = await Post.findById(postId);
  if (!post) return res.status(404).json({ error: "Not found" });
  if (post.author.toString() !== req.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const commentIds = await Comment.find({ post: post._id }).distinct("_id");
  await Like.deleteMany({
    $or: [
      { targetType: "post", targetId: post._id },
      { targetType: "comment", targetId: { $in: commentIds } },
    ],
  });
  await Comment.deleteMany({ post: post._id });
  await Post.deleteOne({ _id: post._id });
  res.json({ ok: true });
});

router.delete("/:postId/like", writeLimiter, async (req, res) => {
  const { postId } = req.params;
  if (!mongoose.isValidObjectId(postId)) {
    return res.status(400).json({ error: "Invalid post id" });
  }
  const post = await Post.findById(postId);
  if (!post) return res.status(404).json({ error: "Not found" });

  const del = await Like.findOneAndDelete({
    targetType: "post",
    targetId: postId,
    user: req.userId,
  });
  let likeCount = post.likeCount;
  if (del) {
    const updated = await Post.findOneAndUpdate(
      { _id: post._id, likeCount: { $gt: 0 } },
      { $inc: { likeCount: -1 } },
      { new: true }
    ).lean();
    if (updated) likeCount = updated.likeCount;
  }
  const counts = await aggregatePostReactionCounts(post._id);
  res.json({
    liked: false,
    likeCount,
    myReaction: null,
    reactionCounts: counts,
  });
});

router.get("/:postId/comments", readLimiter, async (req, res) => {
  const { postId } = req.params;
  if (!mongoose.isValidObjectId(postId)) {
    return res.status(400).json({ error: "Invalid post id" });
  }
  const post = await Post.findById(postId).lean();
  if (!post) return res.status(404).json({ error: "Not found" });
  const canSee =
    post.visibility === "public" || post.author.toString() === req.userId;
  if (!canSee) return res.status(404).json({ error: "Not found" });

  const flat = await Comment.find({ post: postId })
    .sort({ createdAt: 1 })
    .populate("author", "firstName lastName avatarUrl")
    .lean();

  const commentIds = flat.map((c) => c._id);
  const commentLike = await loadLikeMeta("comment", commentIds, req.userId);
  const likeMeta = { comment: new Map() };
  for (const cid of commentIds) {
    const key = cid.toString();
    likeMeta.comment.set(key, {
      likedByMe: Boolean(commentLike.likedByMe.get(key)),
      preview: commentLike.preview.get(key) || [],
    });
  }

  res.json({ comments: buildCommentTree(flat, likeMeta) });
});

router.post(
  "/:postId/comments",
  writeLimiter,
  validateBody(commentSchema),
  async (req, res) => {
    const { postId } = req.params;
    if (!mongoose.isValidObjectId(postId)) {
      return res.status(400).json({ error: "Invalid post id" });
    }
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: "Not found" });
    const canSee =
      post.visibility === "public" || post.author.toString() === req.userId;
    if (!canSee) return res.status(404).json({ error: "Not found" });

    const { text, parentId } = req.body;
    let parent = null;
    if (parentId) {
      if (!mongoose.isValidObjectId(parentId)) {
        return res.status(400).json({ error: "Invalid parent comment" });
      }
      parent = await Comment.findOne({ _id: parentId, post: postId });
      if (!parent) {
        return res.status(400).json({ error: "Parent comment not on this post" });
      }
    }

    const comment = await Comment.create({
      post: postId,
      author: req.userId,
      parent: parent?._id ?? null,
      text,
    });
    await Post.findByIdAndUpdate(post._id, { $inc: { commentCount: 1 } });

    if (parent) {
      await notifyIfNeeded({
        recipientId: parent.author,
        actorId: req.userId,
        type: "comment_reply",
        postId: post._id,
        commentId: parent._id,
      });
    } else {
      await notifyIfNeeded({
        recipientId: post.author,
        actorId: req.userId,
        type: "post_comment",
        postId: post._id,
        commentId: comment._id,
      });
    }

    const populated = await Comment.findById(comment._id)
      .populate("author", "firstName lastName avatarUrl")
      .lean();

    const meta = await loadLikeMeta("comment", [comment._id], req.userId);
    const key = comment._id.toString();

    res.status(201).json({
      comment: {
        id: populated._id.toString(),
        text: populated.text,
        createdAt: populated.createdAt,
        author: serializeUser(populated.author),
        likeCount: 0,
        likedByMe: Boolean(meta.likedByMe.get(key)),
        likedByPreview: meta.preview.get(key) || [],
        replies: [],
        parentId: parent?._id?.toString() ?? null,
      },
    });
  }
);

export default router;
