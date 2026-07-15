<div align="center">
  <img src="docs/img/rush.gif" height="76" alt="Rush, the aggressive agent" />
  &nbsp;&nbsp;
  <img src="docs-site/static/img/logo.svg" width="72" height="72" alt="Sentinel Arena logo" />
  &nbsp;&nbsp;
  <img src="docs/img/sage.gif" height="76" alt="Sage, the conservative agent" />

  # Sentinel Arena

  **Two autonomous trading agents. One live feed. Cryptographic proof neither cherry-picked the result.**

  *TxODDS World Cup Hackathon · Track: Trading Tools and Agents*

  [**📖 Full documentation**](https://ceciliagalvaoo.github.io/sentinel-arena/) · [Architecture](https://ceciliagalvaoo.github.io/sentinel-arena/architecture) · [The Agents](https://ceciliagalvaoo.github.io/sentinel-arena/agents) · [Production Readiness](https://ceciliagalvaoo.github.io/sentinel-arena/production-readiness)

  ### [🚀 Live dashboard](https://sentinel-dashboard-fq9r.onrender.com/)
</div>

---

## What this is

**Rush** (`agent-aggressive`) and **Sage** (`agent-conservative`) watch TxLINE's live World Cup odds feed, detect sharp market movements with a threshold auto-calibrated per match, and publish a **cryptographic commitment of the signal on Solana before the result is known**, revealing the full content only after the final whistle. The result is an accuracy track record that's mathematically impossible to forge after the fact: two independent timestamps (TxLINE's on the data, Solana's on the decision) prove the agent decided before the outcome existed.

Both agents read the exact same feed at the exact same instant, so any difference in performance comes from strategy, not information advantage.

| | **Rush** (aggressive) | **Sage** (conservative) |
|---|---|---|
| Sensitivity multiplier (`k`) | 1.5× | 3.0× |
| Detection window | 60s | 180s |
| Behavior | Reacts fast to any wobble | Only moves on dramatic swings |

### 📖 Documentation

- **[Judging documentation → `docs/`](./docs/README.md)**, a page per hackathon judging criterion (Core Functionality & Data Ingestion · Autonomous Operation · Logic & Architecture · Innovation & Novelty · Production Readiness), each explained and backed by real on-chain evidence and screenshots.
- **[Full technical deep-dive → docs site](https://ceciliagalvaoo.github.io/sentinel-arena/)**, architecture, data model, and the TxLINE integration log (Docusaurus, on GitHub Pages).

## Repository layout

```
sentinel-arena/
├── packages/
│   ├── shared-types/       # canonical SignalPayload + hashing, DB row types
│   ├── txline-client/      # auth, subscribe, streaming, snapshots, Merkle validation
│   ├── market-data-source/ # MarketDataSource interface, LiveTxLineSource / ReplayDataSource
│   ├── commit-reveal/      # SPL Memo commit/reveal + public verifySignalProof
│   └── agent-runtime/      # AutoCalibratedThreshold, AgentLoop, grading engine
├── apps/
│   ├── agent-aggressive/   # thin config shim over agent-runtime (k=1.5)
│   ├── agent-conservative/ # same, k=3.0
│   ├── backend-api/        # Fastify REST + WebSocket for the dashboard
│   └── dashboard/          # Next.js, the read-only judge-facing UI
├── docs/                    # judging documentation, one page per criterion, with screenshots
├── docs-site/               # this README's full expansion, Docusaurus, deployed to GitHub Pages
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
| Commit-reveal | SPL Memo Program, zero custom deploy, zero audit surface |
| Database | PostgreSQL |
| Backend | Fastify + WebSocket |
| Dashboard | Next.js (App Router) + Tailwind, arcade UI with canvas-rendered scene and charts |
| Docs | Docusaurus, deployed to GitHub Pages |

## Validated end-to-end, not just in theory

Every claim here has a real devnet transaction behind it, not a unit test against a mock.

- **Proven live, on a real match.** On July 14–15, 2026 we watched the agents work the World Cup semifinal **France × Spain** from kickoff to full-time without touching anything: the two agents committed **over eight thousand signals** during play, and at the final whistle they autonomously revealed and graded every pending signal on-chain, one transaction at a time, over ~3.5 hours, with the backend staying healthy throughout. The finished match then moved on its own into the dashboard's Replay tab as a permanent, fully-graded record.
- **Cross-checked against TxLINE's own proofs.** On an earlier quarterfinal (France × Morocco): **286 / 932 signals** detected (Rush / Sage), **285 / 924 commits** confirmed on-chain, **100% of reveals** recompute to a hash matching the original commit, and **100% of graded signals** had their final score *and* triggering odds tick independently confirmed against TxLINE's on-chain Merkle proofs, not just trusted from a REST response.
- **The strategies genuinely differ.** Rush fires far more often than Sage (~2.5× the volume on France × Spain), exactly the aggressive-vs-conservative hypothesis being tested.

See the **[judging documentation](./docs/README.md)** for the full criterion-by-criterion write-up, with screenshots and the incidents found (and fixed) against live infrastructure.

## Submission deliverables

- [x] Public repository with this README + full docs site
- [x] Functional app, runnable locally via `docker compose up`
- [x] Technical documentation, [judging docs (`docs/`)](./docs/README.md) + [full docs site](https://ceciliagalvaoo.github.io/sentinel-arena/)
- [x] [TxLINE API feedback log](https://ceciliagalvaoo.github.io/sentinel-arena/txline-feedback-log), kept since day one
- [X] Demo video (≤5 min)
- [x] [Hosted dashboard link](https://sentinel-dashboard-fq9r.onrender.com/), see [Deployment](https://ceciliagalvaoo.github.io/sentinel-arena/deployment) for how it's hosted and why

## Authors

Built for the TxODDS World Cup Hackathon by **Pablo Azevedo** ([@zzaved](https://github.com/zzaved)) and **Cecília Galvão** ([@ceciliagalvaoo](https://github.com/ceciliagalvaoo)).
