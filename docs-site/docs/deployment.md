---
id: deployment
title: Deployment
sidebar_label: Deployment
---

# Deployment

Sentinel Arena runs in production across **three separate free-tier providers**, not one. That split isn't accidental complexity — every piece landed where it did because of a specific constraint, and working around those constraints surfaced real infrastructure bugs worth documenting alongside the code fixes in [Production Readiness](/production-readiness).

## Why three providers, not one

| Component | Hosted on | Why not somewhere simpler |
|---|---|---|
| `backend-api` + `dashboard` | Render (free web services) | The only two components a human ever visits directly — acceptable to let them sleep on idle |
| Postgres | Supabase (free tier) | Render's free Postgres expires after ~30 days — shorter than the gap between the World Cup ending and judging (July 20–29) |
| `agent-aggressive` + `agent-conservative` | Oracle Cloud (Always Free tier VMs) | Render has no free tier for Background Workers (paid Starter+ only) — and **Autonomous Operation is eliminatory**, so the agents cannot live on a platform that requires a paid plan just to stay alive 24/7 |

The one non-negotiable constraint driving all of this: the two agents must run continuously, with zero human intervention, for the entire judging window — including the ~10 days between the last real match and the day a judge actually opens the dashboard. Anything that sleeps or expires on its own was disqualifying for the agent processes specifically, even though it's a perfectly fine tradeoff for the dashboard.

## Render: `backend-api` + `dashboard`

Both deploy from the same repo as a two-service [Render Blueprint](https://render.com/docs/blueprint-spec) (`render.yaml`), each building its own Dockerfile with the repo root as build context.

- `DATABASE_URL` on `backend-api` is a manually-entered secret pointing at Supabase's pooled connection string — Render never sees or manages the database itself.
- `NEXT_PUBLIC_API_URL` on `dashboard` is baked into the client JS bundle **at Docker build time**, not read at runtime — it has to be the exact public URL Render assigns to `backend-api` (Render appends a random suffix for uniqueness, e.g. `sentinel-backend-api-nqed.onrender.com`, not just the service name), and changing it later means rebuilding the dashboard image, not just restarting it.

### A real build bug: workspace packages compile in the wrong order

`@sentinel/shared-types`, `@sentinel/commit-reveal`, and the other internal packages ship only TypeScript source in git — `dist/` is gitignored, built locally on demand. The first deploy attempt ran `npm run build --workspaces --if-present` inside each Dockerfile after `npm install`, which failed with `Cannot find module '@sentinel/shared-types'`.

The cause: `--workspaces` builds packages in **alphabetical discovery order**, not dependency order. `agent-runtime` and `commit-reveal` (which both import `shared-types`) were compiling before `shared-types` itself had a `dist/` to import. Fixed by listing each workspace's build command explicitly in topological order in all three affected Dockerfiles (`shared-types` → `txline-client` → `commit-reveal` → `market-data-source` → `agent-runtime`), verified with a clean `dist/` wipe before each build to rule out a stale local artifact masking the same bug locally.

### Free-tier sleep and the dashboard's WebSocket

Render's free web services spin down after 15 minutes of no traffic and cold-start on the next request (the free-tier banner in Render's own dashboard warns this can add 50+ seconds). This only affects the two Render-hosted services — opening the dashboard link is enough to wake `backend-api` too, since the wake-up request is the dashboard's own client-side `fetch` call, not something a judge has to trigger separately.

One real gap this surfaced: the dashboard's live-update WebSocket had no reconnect logic. If `backend-api` cold-starts or restarts while someone is actively watching, the socket drops and previously just stayed dropped until a manual page refresh. Fixed with the same exponential-backoff-with-cap pattern already used for the agents' own SSE reconnection (`packages/agent-runtime`) — 1s, 2s, 4s… capped at 30s, resetting on a successful reconnect. Critically, this only affects how quickly the *UI* reflects reality — the agents never talk to Render at all, so no signal, commit, reveal, or grade is ever at risk from Render sleeping.

## Supabase: Postgres

Migrations (`scripts/migrate.ts`) ran once against Supabase's pooled connection string before anything was deployed. `resolveDatabaseSsl()` in `packages/shared-types` detects a Supabase hostname automatically and requires TLS — the exact same code path used for local dev's plain Postgres container, just branching on hostname, so nothing about the application code changed to support this.

### Backfilling replay data for production

Judging happens after the tournament ends, so the dashboard's Replay mode needs *some* fixture with a full signal history available at all times — not just whatever the live agents happen to produce between now and the deadline. A real quarterfinal (France vs. Morocco, `fixtureId 18209181`) had already been fully recorded and replayed against the local dev database (34,145 odds events, 1,116 score events, 1,218 signals). That fixture's rows — `tracked_fixtures`, `recorded_events`, `signals`, `commits`, `reveals`, `grades` — were copied directly into Supabase with `COPY ... TO STDOUT | COPY ... FROM STDIN`, in FK-dependency order.

This isn't synthetic demo data: both environments sign with the **same two wallet keypairs**, so every commit/reveal transaction copied into production is still a real, independently verifiable devnet transaction on Solscan — only the database it's queryable from changed, not the underlying proof.

## Oracle Cloud: the two agents

Render Background Workers require a paid plan; a competing free-tier cloud VM was evaluated and rejected first for a non-technical reason — that account's billing setup required a genuine upfront prepayment (not a refundable card-verification hold) before any compute could be provisioned, which isn't a reasonable ask for a hackathon budget. Oracle Cloud's Always Free tier only requires a standard card-verification hold, and unlike a time-boxed trial credit, its Always Free resources never expire.

### What actually shipped: no Docker on the VM

The plan going in was to run `docker-compose.agents.yml` on an Always Free `VM.Standard.E2.1.Micro` instance (1 OCPU, ~1GB RAM), matching the local dev setup exactly. In practice, that shape's memory was too tight for even `dnf install docker-ce` to complete reliably: the OOM killer repeatedly killed the `dnf` transaction — and once, the VM thrashed into total unresponsiveness (SSH timing out, CPU pinned on swap I/O) and needed a reboot from the Oracle console to recover — despite several gigabytes of swap being available. The failure mode was `dnf`'s own dependency-resolution memory spike outpacing how fast the kernel could page to a slow swapfile, not simply running out of memory+swap in total.

Rather than keep fighting a container runtime on a box this constrained, each agent runs as a **native Node.js process under systemd** instead:

- A 3GB swapfile added on each VM as a safety margin (on top of the small default swap).
- Node.js 24 installed from the official prebuilt binary tarball, unpacked straight to `/opt/node` — no package manager involved at all, after `dnf` proved unreliable even for lighter installs on this shape.
- The repository fetched as a GitHub tarball (`archive/refs/heads/master.tar.gz`) rather than `git clone`, avoiding an extra package install just for `git`.
- Only the five packages each agent actually imports (`shared-types`, `txline-client`, `commit-reveal`, `market-data-source`, `agent-runtime`) are compiled, explicitly in dependency order — the same class of bug as the Render Dockerfiles, fixed the same way.
- The wallet keypair and session JSON are copied over `scp` with `600` permissions, never committed to git, matching the same `secrets/` convention as local dev.
- A `systemd` unit per agent (`Restart=always`, `WantedBy=multi-user.target`) keeps the process alive across crashes and VM reboots with zero operator step — the same guarantee Docker's own restart policy would have given, just enforced by the OS instead.

Skipping Docker here also means the agent's own runtime footprint is smaller on an already memory-constrained VM — there's no `dockerd` daemon permanently resident, which matters more on a 1GB box than it would anywhere else in this stack.

## What depends on what

The signal pipeline — detect → commit → wait → reveal → grade — runs entirely between the Oracle VMs, TxLINE, Solana devnet, and Supabase. Render never appears in that path at all. Concretely: if `backend-api` and `dashboard` were both asleep for a week straight, the two agents would keep committing and revealing signals against real matches without missing a beat — the only consequence of Render being asleep is that a human has to wait a bit longer the next time they open the dashboard link, never a gap in the actual track record.
