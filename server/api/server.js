/**
 * Vercel serverless entry: all HTTP traffic is routed here (see vercel.json).
 * Local dev uses src/index.js with app.listen instead.
 */
import { createApp } from "../src/app.js";

export default createApp();
