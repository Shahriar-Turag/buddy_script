import { Suspense } from "react";
import { FeedPageClient } from "./FeedPageClient";

export default function FeedPage() {
  return (
    <Suspense
      fallback={
        <div className="_layout _layout_main_wrapper p-5 text-center">
          <p className="_social_login_content_para">Loading…</p>
        </div>
      }
    >
      <FeedPageClient />
    </Suspense>
  );
}
