"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiJson } from "@/lib/api";
import type { PostReaction } from "@/types/feed";
import { REACTION_ORDER, reactionEmoji, reactionLabel } from "@/lib/reactions";

type Props = {
  postId: string;
  myReaction: PostReaction | null;
  likedByMe: boolean;
  busy: boolean;
  onBusy: (v: boolean) => void;
  onRefresh: () => Promise<void>;
};

const SHOW_MS = 180;
const HIDE_MS = 220;

export function PostReactionPicker({
  postId,
  myReaction,
  likedByMe,
  busy,
  onBusy,
  onRefresh,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const showT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideT = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (showT.current) clearTimeout(showT.current);
    if (hideT.current) clearTimeout(hideT.current);
    showT.current = null;
    hideT.current = null;
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  function scheduleOpen() {
    clearTimers();
    showT.current = setTimeout(() => setPickerOpen(true), SHOW_MS);
  }

  function scheduleClose() {
    clearTimers();
    hideT.current = setTimeout(() => setPickerOpen(false), HIDE_MS);
  }

  const pick = useCallback(
    async (r: PostReaction) => {
      if (busy) return;
      onBusy(true);
      setPickerOpen(false);
      clearTimers();
      try {
        await apiJson(`/api/posts/${postId}/like`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reaction: r }),
        });
        await onRefresh();
      } finally {
        onBusy(false);
      }
    },
    [postId, busy, onBusy, onRefresh, clearTimers]
  );

  async function mainClick() {
    if (busy) return;
    onBusy(true);
    try {
      if (likedByMe) {
        await apiJson(`/api/posts/${postId}/like`, { method: "DELETE" });
      } else {
        await apiJson(`/api/posts/${postId}/like`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reaction: "like" }),
        });
      }
      await onRefresh();
    } finally {
      onBusy(false);
    }
  }

  const label = myReaction ? reactionLabel(myReaction) : "Like";

  return (
    <div
      className={`_post_reaction_wrap${pickerOpen ? " _post_reaction_wrap_open" : ""}`}
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
    >
      <div
        className="_post_reaction_picker"
        role="group"
        aria-label="Choose a reaction"
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
        onClick={(e) => e.stopPropagation()}
      >
        {REACTION_ORDER.map((r) => (
          <button
            key={r}
            type="button"
            className="_post_reaction_picker_btn"
            title={reactionLabel(r)}
            aria-label={reactionLabel(r)}
            disabled={busy}
            onClick={() => void pick(r)}
          >
            <span className="_post_reaction_picker_emoji" aria-hidden>
              {reactionEmoji(r)}
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className={`_feed_inner_timeline_reaction_emoji _feed_reaction ${likedByMe ? "_feed_reaction_active" : ""}`}
        onClick={() => void mainClick()}
        disabled={busy}
      >
        <span className="_feed_inner_timeline_reaction_link">
          <span className="_post_reaction_main_inner">
            {myReaction ? (
              <span className="_post_reaction_main_emoji" aria-hidden>
                {reactionEmoji(myReaction)}
              </span>
            ) : (
              <svg
                className="_reaction_svg"
                xmlns="http://www.w3.org/2000/svg"
                width="21"
                height="21"
                fill="none"
                viewBox="0 0 19 19"
                aria-hidden
              >
                <circle cx="9.5" cy="9.5" r="8.25" stroke="#000" strokeWidth="1.2" />
                <path
                  fill="#000"
                  d="M6.2 8.1c.45 0 .82-.4.82-.9s-.37-.9-.82-.9-.82.4-.82.9.37.9.82.9zm6.6 0c.45 0 .82-.4.82-.9s-.37-.9-.82-.9-.82.4-.82.9.37.9.82.9z"
                />
                <path
                  stroke="#000"
                  strokeLinecap="round"
                  strokeWidth="1.2"
                  d="M5.4 11.2c.9 1.4 2.3 2.3 4.1 2.3s3.2-.9 4.1-2.3"
                />
              </svg>
            )}
            {label}
          </span>
        </span>
      </button>
    </div>
  );
}
