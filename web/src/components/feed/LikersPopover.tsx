"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiJson } from "@/lib/api";
import type { PostReaction, UserBrief } from "@/types/feed";
import { UserAvatar } from "@/components/feed/UserAvatar";
import { reactionEmoji } from "@/lib/reactions";

type LikesUser = UserBrief & { reaction?: PostReaction };

type LikesResponse = { total: number; users: LikesUser[] };

type Props = {
  listUrl: string;
  total: number;
  label: string;
  children: React.ReactNode;
  className?: string;
  /** Extra classes on the clickable trigger button (e.g. comment chip layout). */
  triggerClassName?: string;
  /** Where the dropdown anchors horizontally (comments use `end` so it opens inward). */
  panelAlign?: "start" | "end";
};

export function LikersPopover({
  listUrl,
  total,
  label,
  children,
  className,
  triggerClassName,
  panelAlign = "start",
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<LikesUser[]>([]);
  const [busy, setBusy] = useState(false);

  const fetchPage = useCallback(
    async (skip: number) => {
      setBusy(true);
      try {
        const data = await apiJson<LikesResponse>(
          `${listUrl}?skip=${skip}&limit=30`
        );
        return data;
      } finally {
        setBusy(false);
      }
    },
    [listUrl]
  );

  useEffect(() => {
    if (!open) {
      setUsers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const data = await fetchPage(0);
      if (!cancelled) setUsers(data.users);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, fetchPage]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [open]);

  if (total <= 0) {
    return <span className={className}>{children}</span>;
  }

  async function loadMore() {
    const data = await fetchPage(users.length);
    setUsers((prev) => [...prev, ...data.users]);
  }

  return (
    <div className={`position-relative d-inline-block ${className ?? ""}`} ref={wrapRef}>
      <button
        type="button"
        className={`border-0 bg-transparent p-0 text-start _likers_popover_trigger${triggerClassName ? ` ${triggerClassName}` : ""}`}
        style={{ textDecoration: open ? "underline" : undefined }}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        {children}
      </button>
      {open ? (
        <div
          className={`_likers_popover_panel border rounded bg-white shadow-sm p-2 position-absolute mt-1 ${panelAlign === "end" ? "end-0" : "start-0"}`}
          style={{ zIndex: 1060, minWidth: 240, maxHeight: 320, overflowY: "auto" }}
          role="dialog"
          aria-label={label}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="small fw-semibold mb-2 px-1">{label}</div>
          <ul className="list-unstyled mb-0 small px-1">
            {users.map((u) => (
              <li key={u.id} className="py-1 d-flex align-items-center gap-2">
                <UserAvatar user={u} size={28} />
                {u.reaction ? (
                  <span className="flex-shrink-0" title={u.reaction} aria-hidden>
                    {reactionEmoji(u.reaction)}
                  </span>
                ) : null}
                <span>
                  {u.firstName} {u.lastName}
                </span>
              </li>
            ))}
          </ul>
          {users.length < total ? (
            <div className="px-1 pt-2">
              <button
                type="button"
                className="btn btn-sm btn-link p-0"
                disabled={busy}
                onClick={() => void loadMore()}
              >
                {busy ? "Loading…" : "Load more"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
