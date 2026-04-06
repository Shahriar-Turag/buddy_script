import mongoose from "mongoose";

const likeSchema = new mongoose.Schema(
  {
    targetType: {
      type: String,
      enum: ["post", "comment"],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reaction: {
      type: String,
      enum: ["like", "love", "haha", "sad"],
      default: "like",
    },
  },
  { timestamps: true }
);

likeSchema.index({ targetType: 1, targetId: 1, user: 1 }, { unique: true });
likeSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

export const Like = mongoose.model("Like", likeSchema);
