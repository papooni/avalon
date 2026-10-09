# Avalon Night

A real-time web adaptation of a hidden-loyalty quest game for 5–10 players, built for a group sitting together, each player on their own phone.

> Independent fan project with original art, copy and branding. Role and team names live in `src/lib/branding.ts` and can be swapped for fully original names.

## Quick start (no database)

```bash
npm install
npm run dev          # http://localhost:3000, memory-only mode
```

Open `/demo` to play every seat of a 5–10 player table in one window.

## With PostgreSQL

```bash
cp .env.example .env
# set DATABASE_URL and SNAPSHOT_ENCRYPTION_KEY (see the comment in .env.example)
npx prisma migrate deploy
npm run dev
```

Or, all in Docker:

```bash
export SNAPSHOT_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
docker compose up --build
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js and Socket.IO on one port, with reload |
| `npm run build` / `npm start` | Production build and run |
| `npm test` | Vitest unit tests (engine, server, guidance) |
| `npm run test:e2e` | Playwright: the 10 critical scenarios on a mobile viewport |
| `npm run test:engine:offline` | Runs the same unit tests with no `node_modules` except `tsx` |
| `npm run lint` | ESLint and a strict type check |

## Layout

```
src/engine/        Pure game engine: rules tables, roles, FSM, projections (+ tests)
src/server/        Authoritative server: rooms, sockets, Zod protocol, persistence, security
src/client/        Socket hook with idempotent commands and seat storage
src/lib/           Guided-instruction logic (tested) and branding
src/components/    UI: lobby, private reveal, board, actions, recap
src/app/           Routes: /, /create, /join, /room/[code], /rules, /demo
prisma/            Schema, migration, seed
e2e/               Playwright scenarios
docs/              rule-matrix.md, architecture.md, threat-model.md, deployment.md
```

## Rules

Every rule is listed with sources in [`docs/rule-matrix.md`](docs/rule-matrix.md), including the source conflicts found and how each was resolved.

## Known limitations
- A single server instance holds live room state; see `docs/deployment.md` for scaling.
- Seat order is randomised per game rather than mirroring physical seating.
- Optional variants such as Lady of the Lake and Lancelot are not implemented; the role system is designed to accept them as data.
