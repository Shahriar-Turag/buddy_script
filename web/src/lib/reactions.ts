import type { PostReaction } from "@/types/feed";

export const REACTION_ORDER: PostReaction[] = ["like", "love", "haha", "sad"];

const EMOJI: Record<PostReaction, string> = {
  like: "👍",
  love: "❤️",
  haha: "😂",
  sad: "😢",
};

const LABEL: Record<PostReaction, string> = {
  like: "Like",
  love: "Love",
  haha: "Haha",
  sad: "Sad",
};

export function reactionEmoji(r: PostReaction): string {
  return EMOJI[r];
}

export function reactionLabel(r: PostReaction): string {
  return LABEL[r];
}
