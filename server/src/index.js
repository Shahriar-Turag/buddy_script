import mongoose from "mongoose";
import { env } from "./config/env.js";
import { createApp } from "./app.js";

async function main() {
  await mongoose.connect(env.mongoUri);
  console.log("[db] connected");

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`[api] http://localhost:${env.port}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
