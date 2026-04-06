"use client";

import type { UserBrief } from "@/types/feed";
import { likerSummaryText } from "@/lib/likers";
import { LikerFacepile } from "@/components/feed/LikerFacepile";
import { LikersPopover } from "@/components/feed/LikersPopover";

type Props = {
  commentId: string;
  likeCount: number;
  likedByPreview: UserBrief[];
  /** Shown in the liker list dialog (reply vs top-level comment). */
  likersLabel?: string;
};

/**
 * Who liked this comment or reply: facepile + name summary (same pattern as posts).
 * Click the names to open the full list from the API.
 */
export function CommentLikeBadge({
  commentId,
  likeCount,
  likedByPreview,
  likersLabel = "People who liked this comment",
}: Props) {
  if (likeCount <= 0) return null;

  return (
    <div className="_comment_likers_row">
      <LikerFacepile users={likedByPreview} max={4} size={26} />
      <div className="_feed_likers_summary _comment_likers_summary">
        <LikersPopover
          listUrl={`/api/comments/${commentId}/likes`}
          total={likeCount}
          label={likersLabel}
          panelAlign="end"
        >
          {likerSummaryText(likedByPreview, likeCount)}
        </LikersPopover>
      </div>
    </div>
  );
}
