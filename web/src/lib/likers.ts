import type { UserBrief } from "@/types/feed";

/**
 * Inline summary for like rows.
 * More than 2 likers: "X, Y and N others" (N = total − 2) when two names exist in preview.
 */
export function likerSummaryText(preview: UserBrief[], total: number): string {
  if (total <= 0) return "";
  const names = preview
    .map((u) => `${u.firstName} ${u.lastName}`.trim())
    .filter(Boolean);

  if (total === 1) {
    return names[0] ?? "1 like";
  }

  if (total === 2) {
    if (names.length >= 2) return `${names[0]} and ${names[1]}`;
    if (names.length === 1) return `${names[0]} and 1 other`;
    return "2 likes";
  }

  const othersCount = total - 2;
  const othersPhrase = othersCount === 1 ? "1 other" : `${othersCount} others`;

  if (names.length >= 2) {
    return `${names[0]}, ${names[1]} and ${othersPhrase}`;
  }
  if (names.length === 1) {
    const rest = total - 1;
    return `${names[0]} and ${rest} other${rest === 1 ? "" : "s"}`;
  }
  return `${total} likes`;
}
