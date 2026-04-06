# Buddy Social (Appifylab full-stack task)

Full-stack social feed with **Next.js** (App Router) frontend, **Express** API, and **MongoDB**. The UI reuses the provided HTML/CSS (Bootstrap + custom styles). Original static pages remain in the repo root (`login.html`, `registration.html`, `feed.html`); the app lives in `web/` and `server/`.

## What we built & design decisions

- **Auth model**: **Stateless JWT** (`jsonwebtoken`), not server-side sessions. The token is issued on login/register and stored in an **`httpOnly`** cookie (`buddy_token`) so JavaScript cannot read it; the client sends `credentials: "include"`. Optional `Authorization: Bearer` is supported for non-browser clients. **Rationale**: simple to scale horizontally; trade-off is no instant server-side revoke without a blocklist or short TTL.

- **CSRF**: For cookie-authenticated **mutating** requests, the API expects **`X-CSRF-Token`** matching an HMAC derived from a separate **`buddy_csrf`** HttpOnly secret (issued with login/register and refreshed via `GET /api/auth/me`). Register/login are exempt. **Rationale**: mitigates cross-site POSTs while keeping the JWT out of `localStorage`.

- **Feed API shape (scalability)**: `GET /api/posts` returns posts **without** embedded comment trees (empty `comments` arrays). The client loads comment threads in **one bounded batch** via `POST /api/posts/batch/comment-threads`. After interactions, **`GET /api/posts/:postId/hydrate`** refreshes a single post (counts, reactions, comments) without re-fetching the whole feed. **Rationale**: avoids unbounded “all comments for N posts” reads as data grows.

- **Counters**: `likeCount` / `commentCount` are **denormalized** on `Post` and `Comment` and updated with MongoDB **`$inc`** where possible. **Rationale**: fast feed reads; occasional drift would need a reconciliation job if you require strict accounting.

- **Post reactions**: Likes on posts support **like / love / haha / sad** (stored on the `Like` document). Comments use a simple like. **Rationale**: matches common social UX; one `Like` collection with `targetType` keeps the model small.

- **Uploads**: Multer to disk in dev; **magic-byte** check (`file-type`) after upload in addition to MIME allowlist. **Rationale**: reduces spoofed `Content-Type` uploads.

- **UI / hydration**: Root `html`/`body` use **`suppressHydrationWarning`** because some browser extensions inject attributes (e.g. on `<body>`) and cause harmless React hydration noise in dev.

- **Local MongoDB**: `docker-compose.yml` runs **MongoDB 7** only (not the Node apps). **Rationale**: one-command DB for contributors without a local `mongod` install.

## Features

- **Auth**: Register (first name, last name, email, password), login, logout. Passwords hashed with **bcrypt** (cost 12). **JWT** stored in an **httpOnly**, **SameSite=Lax** cookie (`buddy_token`).
- **Feed (protected)**: Cursor-paginated posts, newest first. **Public** posts visible to everyone; **private** posts only to the author.
- **Posts**: Text + optional image (multer, 5MB max, JPEG/PNG/WebP/GIF). Denormalized `likeCount` / `commentCount` for read scalability.
- **Likes & reactions**: Separate `likes` collection with a unique compound index on `(targetType, targetId, user)`; aggregation for recent liker previews. Posts: multi-type reactions + “who liked” (facepile, name summary, full list). Comments: like + same “who liked” pattern.
- **Comments & replies**: Threaded comments (`parent` ref); likes on comments with the same pattern as posts.
- **Notifications**: In-app notifications for post likes, comments, replies, and comment likes; mark read / read-all; header badge and list UI.

## Security & hardening

- `helmet` (CSP disabled so legacy CSS assets behave; adjust for production), `express-mongo-sanitize`, `hpp`, strict JSON body size.
- Rate limiting on **auth**, **writes**, and **read-heavy** list routes (feed, notifications, hydrate, etc.).
- **CSRF** for authenticated unsafe methods (see “What we built & design decisions”).
- Input validation with **Zod** on auth and comments; email normalized to lowercase; duplicate registration returns 409.
- CORS locked to `CORS_ORIGIN` with credentials.
- `JWT_SECRET` minimum length enforced in production.
- Uploads: MIME whitelist, random filenames, no original names in URLs.

## Prerequisites

- Node.js 20+
- MongoDB 6+ (local or Atlas)

### If you see `ECONNREFUSED 127.0.0.1:27017`

Nothing is listening on the MongoDB port. **MongoDB Compass does not start the server** — you need `mongod` running (or Atlas).

**Docker (easiest):** from the project root:

```bash
docker compose up -d
```

Keep `MONGODB_URI=mongodb://127.0.0.1:27017/buddy_social` in `server/.env`, then restart `npm run dev` in `server/`.

**Or** install [MongoDB Community Server](https://www.mongodb.com/try/download/community) and start it, **or** use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and set `MONGODB_URI` to your Atlas connection string.

## Setup

### 1. API (`server/`)

```bash
cd server
cp .env.example .env
# Edit .env — set JWT_SECRET (32+ chars in production) and MONGODB_URI
npm install
npm run dev
```

API default: `http://127.0.0.1:4000`

### 2. Web (`web/`)

```bash
cd web
cp .env.example .env.local
# Optional: API_PROXY_TARGET if the API is not on 127.0.0.1:4000
npm install
npm run dev
```

App default: `http://localhost:3000`

Next.js **rewrites** proxy `/api/*` and `/uploads/*` to the Express server so the browser stays same-origin for cookies and static uploads.

## Production notes

- Set `NODE_ENV=production`, `secure` cookies, strong `JWT_SECRET`, HTTPS.
- Serve behind a reverse proxy; `trust proxy` is enabled for one hop.
- Point `CORS_ORIGIN` and `API_PROXY_TARGET` at your real web origin.
- Consider moving uploads to object storage (S3, etc.) and tightening CSP.

### Vercel (split frontend + API)

- **API project** (e.g. `buddy-script-eta`): set **Root Directory** to `server` if the repo is monorepo-style. The repo includes `server/vercel.json` and `server/api/server.js` so Express runs as a serverless function (long-running `app.listen` alone is not enough on Vercel). Uploads use `/tmp` when `VERCEL` is set (files are ephemeral).
- **Web project** (e.g. `buddyscriptfrontend`): set **`API_PROXY_TARGET`** to your API origin (no trailing slash), e.g. `https://buddy-script-eta.vercel.app`. The build **fails** if `VERCEL=1` and this var is missing, so you catch misconfiguration before deploy.
- After changing env vars on either project, **redeploy** so Next picks up `API_PROXY_TARGET` at build time.

## Repository layout

| Path                     | Role                                                                         |
| ------------------------ | ---------------------------------------------------------------------------- |
| `web/`                   | Next.js frontend                                                             |
| `server/`                | Express + Mongoose API                                                       |
| `assets/`                | Original static assets (also copied under `web/public/assets` for images/JS) |
| `web/src/styles/design/` | Bundled copy of theme CSS (Next bundler requirement)                         |

## Deliverables checklist (for your submission)

- Push this project to **GitHub** and share the link.
- Record a **YouTube** walkthrough (unlisted/private) covering register, login, feed, public/private posts, likes, comments/replies.
- Optional: deploy API + web (e.g. Railway + Vercel) and set env vars to match the deployment URLs.
