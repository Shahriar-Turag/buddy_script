export type PostReaction = "like" | "love" | "haha" | "sad";

export type ReactionCounts = Record<PostReaction, number>;

export type UserBrief = {
  id: string;
  firstName: string;
  lastName: string;
  /** ImgBB HTTPS URL or local `/uploads/...` (proxied via Next rewrite). */
  avatarUrl?: string | null;
  /** Present when listing likers on posts with multi-reactions. */
  reaction?: PostReaction;
};

export type CommentNode = {
  id: string;
  text: string;
  createdAt: string;
  author: UserBrief;
  likeCount: number;
  likedByMe: boolean;
  likedByPreview: UserBrief[];
  replies: CommentNode[];
};

export type Post = {
  id: string;
  text: string;
  /** ImgBB HTTPS URL or `/uploads/...` for legacy/local. */
  imageUrl: string | null;
  visibility: "public" | "private";
  createdAt: string;
  author: UserBrief;
  likeCount: number;
  likedByMe: boolean;
  /** Current user's reaction when they reacted; null otherwise. */
  myReaction: PostReaction | null;
  reactionCounts: ReactionCounts;
  likedByPreview: UserBrief[];
  commentCount: number;
  comments: CommentNode[];
};

export type NotificationItem = {
  id: string;
  type: string;
  read: boolean;
  createdAt: string;
  actor: UserBrief | null;
  postId: string | null;
  commentId: string | null;
  body: string;
};

export type NotificationsResponse = {
  notifications: NotificationItem[];
  nextCursor: string | null;
  unreadCount: number;
};
