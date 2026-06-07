# Collis Taxi

Local taxi booking app for Collis in Linden, Guyana.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- Convex (database + auth + realtime + storage)
- Vercel hosting

## Local development

```bash
npm install
npx convex dev          # opens browser to set up your dev deployment; leave running
npx convex run seed:run # in a 2nd terminal, seed default zones + price matrix
npm run dev             # start Next.js
```

Open http://localhost:3000.

See `SETUP.md` for a step-by-step walkthrough.

## Architecture

- `app/` — Next.js App Router pages
- `convex/` — Convex backend (schema, queries, mutations, auth)
- `lib/convex/provider.tsx` — Convex React client
- `middleware.ts` — Convex Auth session refresh on every request
