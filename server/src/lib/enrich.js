import { Like } from "../models/Like.js";
import { User } from "../models/User.js";
import mongoose from "mongoose";
import { serializeUser } from "./serializeUser.js";

const EMPTY_COUNTS = () => ({ like: 0, love: 0, haha: 0, sad: 0 });

/**
 * Per-target like previews (recent likers), whether current user reacted,
 * their reaction type, and reaction breakdown counts.
 */
export async function loadLikeMeta(targetType, targetIds, currentUserId) {
  if (!targetIds.length) {
    return {
      likedByMe: new Map(),
      myReaction: new Map(),
      reactionCounts: new Map(),
      preview: new Map(),
    };
  }

  const ids = targetIds.map((id) =>
    id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id)
  );

  const mine = await Like.find({
    targetType,
    targetId: { $in: ids },
    user: new mongoose.Types.ObjectId(currentUserId),
  })
    .select("targetId reaction")
    .lean();

  const likedByMe = new Map();
  const myReaction = new Map();
  for (const row of mine) {
    const k = row.targetId.toString();
    likedByMe.set(k, true);
    myReaction.set(k, row.reaction || "like");
  }

  const grouped = await Like.aggregate([
    { $match: { targetType, targetId: { $in: ids } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$targetId",
        userIds: { $push: "$user" },
      },
    },
    {
      $project: {
        userIds: { $slice: ["$userIds", 8] },
      },
    },
  ]);

  const countAgg = await Like.aggregate([
    { $match: { targetType, targetId: { $in: ids } } },
    {
      $group: {
        _id: {
          tid: "$targetId",
          r: { $ifNull: ["$reaction", "like"] },
        },
        n: { $sum: 1 },
      },
    },
  ]);

  const reactionCounts = new Map();
  for (const tid of ids) {
    reactionCounts.set(tid.toString(), EMPTY_COUNTS());
  }
  for (const row of countAgg) {
    const tid = row._id.tid.toString();
    const r = row._id.r;
    const cur = reactionCounts.get(tid);
    if (cur && r in cur) {
      cur[r] = row.n;
    }
  }

  const preview = new Map();
  const allUserIds = new Set();
  for (const g of grouped) {
    for (const uid of g.userIds || []) {
      allUserIds.add(uid.toString());
    }
  }

  const users = await User.find({
    _id: { $in: [...allUserIds].map((s) => new mongoose.Types.ObjectId(s)) },
  })
    .select("firstName lastName avatarUrl")
    .lean();

  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  for (const g of grouped) {
    const key = g._id.toString();
    const list = (g.userIds || [])
      .map((uid) => userMap.get(uid.toString()))
      .filter(Boolean)
      .map(serializeUser);
    preview.set(key, list);
  }

  for (const tid of ids) {
    const k = tid.toString();
    if (!preview.has(k)) preview.set(k, []);
  }

  return { likedByMe, myReaction, reactionCounts, preview };
}
