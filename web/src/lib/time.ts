const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.round((then - now) / 1000);
  const abs = Math.abs(sec);
  if (abs < 60) return rtf.format(Math.round(sec / 1), "second");
  if (abs < 3600) return rtf.format(Math.round(sec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), "hour");
  if (abs < 604800) return rtf.format(Math.round(sec / 86400), "day");
  if (abs < 2629800) return rtf.format(Math.round(sec / 604800), "week");
  if (abs < 31557600) return rtf.format(Math.round(sec / 2629800), "month");
  return rtf.format(Math.round(sec / 31557600), "year");
}

export function nameList(users: { firstName: string; lastName: string }[]): string {
  return users.map((u) => `${u.firstName} ${u.lastName}`).join(", ");
}

/** Short relative time for comment row (e.g. 21m, 3h) — matches feed.html `.21m` style */
export function formatShortCommentTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const min = Math.floor((now - then) / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(then);
}
