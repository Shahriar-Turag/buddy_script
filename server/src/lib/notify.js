import mongoose from "mongoose";
import { Notification } from "../models/Notification.js";

/**
 * @param {object} opts
 * @param {string|mongoose.Types.ObjectId} opts.recipientId
 * @param {string|mongoose.Types.ObjectId} opts.actorId
 * @param {'post_like'|'post_comment'|'comment_reply'|'comment_like'} opts.type
 * @param {string|mongoose.Types.ObjectId|null} [opts.postId]
 * @param {string|mongoose.Types.ObjectId|null} [opts.commentId]
 */
export async function notifyIfNeeded({ recipientId, actorId, type, postId, commentId }) {
  if (!recipientId || !actorId) return;
  const r = recipientId.toString();
  const a = actorId.toString();
  if (r === a) return;

  await Notification.create({
    recipient: recipientId,
    actor: actorId,
    type,
    post: postId || undefined,
    comment: commentId || undefined,
    read: false,
  });
}
