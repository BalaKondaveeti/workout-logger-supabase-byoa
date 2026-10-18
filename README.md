# Workout Logger (Supabase, bring your own account)

A mobile-first gym log: check-in/out, pre-workout, day rating, exercises with sets
(weight, kg/lb, reps, each arm / left / right), "last time" prefill, activity calendars,
per-exercise and per-muscle stats. Vite + React + TypeScript, plain CSS, Supabase for
auth and storage, deployed to GitHub Pages.

Live: https://balakondaveeti.github.io/workout-logger-supabase-byoa/

## Setup

1. **Create the tables.** In Supabase → SQL Editor, paste and run `supabase/schema.sql`.
   It is idempotent (safe to re-run) and only creates `gym_*` tables, each with Row Level
   Security so every user sees only their own rows. Existing tables are not touched.
2. **(Optional) Import history.** Run `supabase/seed.sql` once in the SQL Editor. It finds
   the user by email, and does nothing if that user already has gym data.
   (This file is generated from a private log and is not committed.)
3. **Sign in** with an existing Supabase Auth email + password for that project.

The default project is set in `src/lib/config.ts` (`DEFAULT_CONFIG`). The sign-in screen
and Menu → Supabase connection let you switch to another project; that choice is saved in
the browser only. The publishable key is public by design — data is protected by RLS.

## Deploy (GitHub Pages)

Repo → Settings → Pages → Source: **GitHub Actions**. Every push to `main` runs
`.github/workflows/deploy.yml` (Node 22, `npm ci`, `npm run build`, deploy `dist`).
`vite.config.ts` uses `base: './'` and the app uses hash routes (`#/log/2026-10-18`), so it
works under any repo name.

## Develop

```sh
npm install
npm run dev
npm run build
```

## How data loads

All of a user's gym rows are fetched (paged 1000 rows per request) and cached in
localStorage per user + project. Cached data shows instantly; it refreshes after any
write, when older than 6 hours, or with the refresh button. Edits apply on screen at once
and are saved through an ordered queue. If Supabase can't be reached (free projects pause
after about a week idle), a notice links to the dashboard to restore it, with a Retry.

## Restyling

Every color, font, size, spacing and radius is a CSS variable in `src/theme.css`
(light + dark via `prefers-color-scheme`).
