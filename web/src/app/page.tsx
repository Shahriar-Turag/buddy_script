import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function Home() {
  const token = (await cookies()).get("buddy_token")?.value;
  redirect(token ? "/feed" : "/login");
}
