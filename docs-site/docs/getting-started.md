---
id: getting-started
title: Getting Started
sidebar_label: Getting Started
---

# Getting Started

Sentinel Arena is an npm-workspaces monorepo. Everything below runs against **Solana devnet** and TxLINE's free tier, no mainnet funds required.

## Prerequisites

- Node.js 24+ (native, not the Windows build if you're on WSL, see the [troubleshooting note](#wsl-gotcha) below)
- Docker + Docker Compose (for the one-command full-stack path)
- A Solana devnet wallet with a small SOL balance for each agent (fund via [faucet.solana.com](https://faucet.solana.com))

## One-command path: Docker Compose

```bash
git clone https://github.com/ceciliagalvaoo/sentinel-arena.git
cd sentinel-arena
cp .env.example .env
cp apps/agent-aggressive/.env.example apps/agent-aggressive/.env
cp apps/agent-conservative/.env.example apps/agent-conservative/.env

docker compose up -d --build
```

This brings up five services: `postgres`, `agent-aggressive`, `agent-conservative`, `backend-api`, and `dashboard`. The Postgres schema auto-applies on first init (`db/migrations/*.sql` mounted into `docker-entrypoint-initdb.d`).

- **Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:4000/health](http://localhost:4000/health)

## Manual path (local dev, no Docker)

```bash
npm install
docker run -d --name sentinel-db -e POSTGRES_PASSWORD=devpassword -p 5432:5432 postgres:16
npm run db:migrate
npm run typecheck   # confirms every package/app compiles clean

# One-time on-chain setup per agent (subscribe + activate the free API tier):
npx tsx scripts/setup-subscription.ts agent-aggressive
npx tsx scripts/setup-subscription.ts agent-conservative
```

Then run each app in its own terminal (`npm run dev --workspace=@sentinel/agent-aggressive`, etc.).

## Replay mode, testing without a live match

Since World Cup judging happens after the tournament ends, the agents support a **replay mode** that reproduces a previously-recorded fixture's real odds/score history instead of the live TxLINE stream, same decision code path, same commit-reveal pipeline, just fed from `recorded_events` instead of SSE.

```bash
# Backfill a completed fixture's full history via REST (no live SSE needed):
DATABASE_URL=... npx tsx scripts/seed-replay-data.ts <fixtureId>
```

Then set in the agent's `.env`:

```ini
REPLAY_FIXTURE_ID=18209181
REPLAY_SPEED_MULTIPLIER=60   # play back 60x faster than real time
REPLAY_START_INDEX=26606     # optional: skip straight to a specific point
```

See [Architecture → Replay mode](/architecture#replay-mode) for why this is a first-class design decision, not a testing hack.

## WSL gotcha

If you're developing inside WSL2 with Docker Desktop, two environment issues are worth knowing about up front:

- **Mixed Node.js on `PATH`**: if Windows' own Node.js (`/mnt/c/Program Files/nodejs/`) is on the same `PATH` as WSL's native Node, `npm install` can occasionally resolve native binary dependencies (`esbuild`, `bigint-buffer`) to the wrong platform. Run `which node` and confirm it resolves to `/usr/bin/node` before installing.
- **`node:20-alpine` vs `node:24-alpine` in Docker**: `@coral-xyz/anchor`'s named export (`BN`) resolves differently under Node 20's Alpine CJS/ESM interop than under Node 24, which the rest of this project develops against. All four Dockerfiles pin `node:24-alpine`.

## Running the typecheck

```bash
npm run typecheck
```

This runs `tsc -b` (or `tsc --noEmit` for the dashboard) across all ten packages/apps, the fastest way to confirm nothing is broken after a change, and what this project's own development loop leaned on continuously.


<div style={{textAlign:'center',margin:'2.2rem 0 0.5rem',opacity:0.9}}>
  <img src={require('@site/static/img/squirrels/sage-hop.gif').default} alt="" style={{height:'38px'}} />
</div>
