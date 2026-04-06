import mongoose from "mongoose";
import { env } from "../config/env.js";

/** Survives cold starts on Vercel serverless (reuse connection across invocations). */
const g = globalThis;

if (!g.__mongooseModule) {
  g.__mongooseModule = { conn: null, promise: null };
}

const cache = g.__mongooseModule;

export async function connectMongoOnce() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (!cache.promise) {
    cache.promise = mongoose.connect(env.mongoUri);
  }
  await cache.promise;
  cache.conn = mongoose.connection;
  return cache.conn;
}
