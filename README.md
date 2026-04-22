# leetcodemr (LeetMastery)

A [Next.js](https://nextjs.org) app for **LeetCode-style interview prep**: curated questions, in-browser coding, spaced repetition, and study modes for DSA, behavioral, and system design.

## Stack

- **Next.js 16** (App Router), **React 19**, **TypeScript**, **Tailwind CSS 4**
- **Supabase** for progress, activity, and reviews
- **CodeMirror** editors (Python/C++), **Resend** for optional daily email notifications

## Features

- **Questions** — Filter by difficulty, tags, and curated lists (e.g. Grind 169, Denny Zhang, Premium 98, CodeSignal); track solved, starred, notes, and streaks
- **Practice** — Daily practice, Speedster, structured Learn paths, mock interviews
- **LeetCode** — API routes to connect session and run/submit/check solutions
- **Study** — Flashcards, quick review, Gems, DSA tutorials and reference
- **Interview prep** — Behavioral and system design sections
- **Stats & reviews** — Activity and spaced-review scheduling

## Getting started

Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in uses a passcode (see environment variables).

### Environment variables

Create `.env.local` with at least:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `APP_PASSCODE` | Passcode for app login (`/login`) |

Optional (for cron-triggered daily notifications and admin Supabase access):

| Variable | Purpose |
|----------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (used where server-side Supabase access is needed) |
| `RESEND_API_KEY` | [Resend](https://resend.com) API key for email |
| `CRON_SECRET` | Shared secret for securing the notify endpoint |
| `NOTIFICATION_EMAIL` | Recipient for daily notifications |
| `NOTIFICATION_EMAIL_SECONDARY` | Optional second recipient (no duplicates if same as primary) |

## Scripts

```bash
npm run dev    # Development server
npm run build  # Production build
npm run start  # Run production server
npm run lint   # ESLint
npm run lc:auth      # (Local) open browser to login to LeetCode
npm run lc:connector # (Local) run the LeetCode connector on 127.0.0.1:8787
npm run lc:import    # (Local) paste Cookie header once (fallback if Cloudflare blocks automation)
```

## Local LeetCode Connector (recommended)

LeetCode sometimes blocks serverless/Vercel requests with Cloudflare/WAF (HTTP 403 HTML),
even with valid cookies. The **Local Connector** runs on your machine and makes the
requests from your own IP/browser fingerprint (similar to the VSCode LeetCode extension).

Steps:

```bash
npm install
npm run lc:auth
npm run lc:connector
```

If Cloudflare blocks the automated login window, use the import fallback:

```bash
npm run lc:import
npm run lc:connector
```

Then use the app normally — it will automatically prefer the local connector when available,
and fall back to the deployed API routes when it isn’t.

## Project layout

- `src/app/(app)/` — Main UI routes (questions, daily, stats, flashcards, etc.)
- `src/app/api/` — Auth, LeetCode proxy, run code, notify
- `src/components/` — Editors, navbar, shared UI
- `src/lib/` — Supabase client, DB helpers, constants

## Deploy

Compatible with [Vercel](https://vercel.com) or any Node host that supports Next.js; set the same environment variables in your hosting dashboard.

---

Bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
