<div align="center">
  <img src="docs-site/static/img/logo.svg" width="72" height="72" alt="Sentinel Arena logo" />

  # Sentinel Arena

  **Two autonomous trading agents. One live feed. Cryptographic proof neither cherry-picked the result.**

  *TxODDS World Cup Hackathon · Track: Trading Tools and Agents*

  [**📖 Full documentation**](https://ceciliagalvaoo.github.io/sentinel-arena/) · [Architecture](https://ceciliagalvaoo.github.io/sentinel-arena/architecture) · [The Agents](https://ceciliagalvaoo.github.io/sentinel-arena/agents) · [Production Readiness](https://ceciliagalvaoo.github.io/sentinel-arena/production-readiness)
</div>

---

## What this is

`agent-aggressive` and `agent-conservative` watch TxLINE's live World Cup odds feed, detect sharp market movements with a threshold auto-calibrated per match, and publish a **cryptographic commitment of the signal on Solana before the result is known** — revealing the full content only after the final whistle. The result is an accuracy track record that's mathematically impossible to forge after the fact: two independent timestamps (TxLINE's on the data, Solana's on the decision) prove the agent decided before the outcome existed.

Both agents read the exact same feed at the exact same instant — any difference in performance comes from strategy, not information advantage.

| | Agent-Aggressive | Agent-Conservative |
|---|---|---|
| Sensitivity multiplier (`k`) | 1.5× | 3.0× |
| Detection window | 60s | 180s |
| Behavior | Reacts fast to any wobble | Only moves on dramatic swings |

Full write-up — architecture, data model, the TxLINE integration log, and how this maps to the hackathon's judging criteria — lives in **[the docs site](https://ceciliagalvaoo.github.io/sentinel-arena/)**.

## Repository layout

```
sentinel-arena/
├── packages/
│   ├── shared-types/       # canonical SignalPayload + hashing, DB row types
│   ├── txline-client/      # auth, subscribe, streaming, snapshots, Merkle validation
│   ├── market-data-source/ # MarketDataSource interface — LiveTxLineSource / ReplayDataSource
│   ├── commit-reveal/      # SPL Memo commit/reveal + public verifySignalProof
│   └── agent-runtime/      # AutoCalibratedThreshold, AgentLoop, grading engine
├── apps/
│   ├── agent-aggressive/   # thin config shim over agent-runtime (k=1.5)
│   ├── agent-conservative/ # same, k=3.0
│   ├── backend-api/        # Fastify REST + WebSocket for the dashboard
│   └── dashboard/          # Next.js — the read-only judge-facing UI
├── docs-site/               # this README's full expansion — Docusaurus, deployed to GitHub Pages
├── db/migrations/           # Postgres schema
└── scripts/                  # setup-subscription, seed-replay-data, migrate
```

## Running locally

```bash
cp .env.example .env
cp apps/agent-aggressive/.env.example apps/agent-aggressive/.env
cp apps/agent-conservative/.env.example apps/agent-conservative/.env

docker compose up -d --build
```

- Dashboard: [http://localhost:3000](http://localhost:3000)
- Backend API: [http://localhost:4000/health](http://localhost:4000/health)

For the manual (non-Docker) path, replay mode, and a WSL2-specific gotcha, see **[Getting Started](https://ceciliagalvaoo.github.io/sentinel-arena/getting-started)**.

## Tech stack

| Layer | Choice |
|---|---|
| Language | TypeScript (Node.js 24), npm workspaces monorepo |
| Blockchain | Solana devnet · `@solana/web3.js` + `@coral-xyz/anchor` |
| Commit-reveal | SPL Memo Program — zero custom deploy, zero audit surface |
| Database | PostgreSQL |
| Backend | Fastify + WebSocket |
| Dashboard | Next.js (App Router) + Tailwind + Recharts |
| Docs | Docusaurus, deployed to GitHub Pages |

## Validated end-to-end, not just in theory

Every claim in this project has a real devnet transaction behind it, not a unit test against a mock. Against a real World Cup quarterfinal (France vs. Morocco):

- **286 / 932 signals** detected (Aggressive / Conservative), **285 / 924 commits** confirmed on-chain
- **100% of reveals** have a hash that recomputes and matches the original commit
- **100% of graded signals**, for both agents, have their final score *and* their triggering odds tick independently confirmed against TxLINE's on-chain Merkle proofs — not just trusted from a REST response
- The two agents' opposite strategies produce genuinely different, comparable behavior on the same data: Aggressive fires far more often, Conservative is far more selective — exactly the hypothesis being tested

See **[Production Readiness](https://ceciliagalvaoo.github.io/sentinel-arena/production-readiness)** for the full list of real incidents found (and fixed) against live infrastructure, mapped to each of the track's five judging criteria.

## Submission deliverables

- [x] Public repository with this README + full docs site
- [x] Functional app, runnable locally via `docker compose up`
- [x] Technical documentation — [docs site](https://ceciliagalvaoo.github.io/sentinel-arena/)
- [x] [TxLINE API feedback log](https://ceciliagalvaoo.github.io/sentinel-arena/txline-feedback-log), kept since day one
- [X] Demo video (≤5 min)
- [X] Hosted dashboard link

## Authors

Built for the TxODDS World Cup Hackathon by **Pablo Azevedo** ([@zzaved](https://github.com/zzaved)) and **Cecília Galvão** ([@ceciliagalvaoo](https://github.com/ceciliagalvaoo)).
