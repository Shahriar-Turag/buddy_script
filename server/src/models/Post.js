import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    text: { type: String, required: true, trim: true, maxlength: 10000 },
    imageUrl: { type: String, default: null },
    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "public",
      index: true,
    },
    likeCount: { type: Number, default: 0, min: 0 },
    commentCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

postSchema.index({ createdAt: -1 });
postSchema.index({ visibility: 1, createdAt: -1 });
postSchema.index({ author: 1, createdAt: -1 });
/** Feed-style visibility + time-ordered scans (pairs with cursor pagination). */
postSchema.index({ visibility: 1, author: 1, createdAt: -1, _id: -1 });

export const Post = mongoose.model("Post", postSchema);
