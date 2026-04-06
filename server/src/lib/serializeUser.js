/**
 * @param {import("mongoose").Document | import("mongoose").LeanDocument<any> | null} u
 */
export function serializeUser(u) {
  if (!u) return null;
  return {
    id: u._id.toString(),
    firstName: u.firstName,
    lastName: u.lastName,
    avatarUrl: u.avatarUrl ?? null,
  };
}
