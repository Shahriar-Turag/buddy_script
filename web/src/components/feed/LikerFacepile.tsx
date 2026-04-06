import type { UserBrief } from "@/types/feed";
import { UserAvatar } from "@/components/feed/UserAvatar";

type Props = {
  users: UserBrief[];
  /** Max overlapping faces (default 5). */
  max?: number;
  size?: number;
};

export function LikerFacepile({ users, max = 5, size = 32 }: Props) {
  const slice = users.slice(0, max);
  if (slice.length === 0) return null;

  return (
    <div className="_liker_facepile align-items-center" aria-hidden>
      {slice.map((u) => (
        <UserAvatar key={u.id} user={u} size={size} />
      ))}
    </div>
  );
}
