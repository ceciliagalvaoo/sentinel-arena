<p align="center">
  <img src="img/rush.gif" alt="Rush, the aggressive agent" height="100" />
  &nbsp;&nbsp;&nbsp;
  <img src="img/logo.png" alt="Sentinel Arena" height="78" />
  &nbsp;&nbsp;&nbsp;
  <img src="img/sage.gif" alt="Sage, the conservative agent" height="100" />
</p>

# 5 · Production Readiness

> *Would a real trading desk use this tomorrow? Does it have metrics, logs and product-grade reliability?*

## What a desk actually needs, and what's already here

A trading desk does not adopt a toy. It adopts something that is deployed, observable, reliable under load, and honest about its own limits. Sentinel Arena is built to that bar, and, unusually for a hackathon entry, it was validated against real infrastructure during a live World Cup match rather than against mocks.

<p align="center"><b>Figure 1 - The operator's view: live metrics, verifiable records and per-agent wallets, all in one screen</b></p>

<p align="center">
  <img src="img/overview.png" alt="The full dashboard showing accuracy metrics, event feeds, wallets and the comparison chart" width="760" />
</p>

<p align="center"><sub>Source: The authors (2026)</sub></p>

## Deployed, for real, on the right infrastructure

Nothing here is a slide. The system runs as three cleanly separated tiers, each hosted where its needs are actually met:

<p align="center"><b>Table 1 - The production topology</b></p>

| Tier | Where it runs | Why there |
|---|---|---|
| **Agents (Rush & Sage)** | Google Cloud `e2-micro` VM, 24/7 | Must stay awake to catch a final whistle at an unpredictable time, no spin-down allowed. |
| **Backend API + dashboard** | Render (Docker) | Occasionally-viewed, read-only surface; fine to cold-start. |
| **Database** | Supabase (PostgreSQL) | Managed, durable Postgres that outlives the judging window. |
| **Chain** | Solana devnet | Real on-chain commits and reveals; SPL Memo has the same address on mainnet, so promotion is a config change. |

<p align="center"><sub>Source: The authors (2026)</sub></p>

The separation is itself a production decision: the always-on component that cannot sleep is isolated from the components that can, so no single hosting constraint compromises the whole.

## Metrics and logs a desk would recognise

- **Accuracy as a first-class metric,** computed over the *full* graded set, never a flattering sample, and shown per agent with a live progress bar. It is sourced from a full-set aggregate, so the "verified on-chain" badge can never claim more than the data supports.
- **A verification status that refuses to overstate.** The badge only turns green once *every* graded signal behind the number has also had its final score cross-checked against TxLINE's own on-chain proof. If even one has not, it shows an honest amber "verify pending" instead. The product would rather admit incompleteness than fake a checkmark.
- **A complete, on-chain audit trail.** Every signal's `SIGNAL → COMMIT → REVEAL` lifecycle is recorded, and every hash in the interface is a real, copyable link to the block explorer. There is no decorative text; everything resolves to something verifiable.
- **Structured operational logging** on the agents, every signal, grade, reconciliation and error is logged with the agent's identity, which is what an operator needs to actually run the thing.

<p align="center"><b>Figure 2 - Cumulative accuracy over real time, with a hover read-out of each agent's record at any moment</b></p>

<p align="center">
  <img src="img/chart-hover.png" alt="The cumulative-accuracy chart with time on the x-axis for both agents" width="760" />
</p>

<p align="center"><sub>Source: The authors (2026)</sub></p>

## Reliability that was earned against live infrastructure

The reliability features are not theoretical; each exists because a real failure mode was hit and fixed against the live feed and the public devnet RPC:

- **Rate-limit safety.** Blockchain publishing is serialized through a single spaced queue, so a volatile burst never fires concurrent transactions and trips the RPC's rate limiter. Settlement runs through the *same* queue as commits, as one unit, so it can never race ahead of not-yet-persisted commits and lose their reveals.
- **Crash self-healing.** Orphaned signals, committed in the database but never landed on-chain because the process died, are found and republished on restart, using the frozen hash, but only where doing so is still honest. (See [§2 Autonomous Operation](./02-autonomous-operation.md).)
- **Wallet safety.** New commits pause automatically when a wallet dips below the fee floor and resume when topped up.
- **A read-only control surface.** The dashboard cannot act on the agents' behalf, a deliberate blast-radius limit that means no operator misclick can corrupt the record.

## Proof it survives real load

The strongest production-readiness evidence is the live settle we observed during **France × Spain** on July 14–15, 2026: the agents committed **over eight thousand signals** during the match, then autonomously published **thousands of reveal transactions** over roughly 3.5 hours after full-time, with the backend answering `200 OK` in under a second throughout. That is a real, multi-hour, high-volume run against real infrastructure, the closest thing to a production shift a hackathon can offer.

## Honest about its limits, which is itself production maturity

A desk trusts a vendor that tells it where the edges are. Two we found during the live run, and would name in any real conversation:

- **Settlement latency scales with signal volume.** Because each reveal is its own paced on-chain transaction, a very aggressive agent on a volatile match produces a long settle tail, Rush's ~6,400 reveals took hours to fully drain. It completes unattended, but batching reveals would be the first hardening step for higher throughput.
- **The read API caps a single fixture fetch at 5,000 signals,** which a full aggressive match can exceed; the dashboard's replay would then load only the most recent slice. Raising the limit or paginating is a small, known fix.
- **This is a signal-and-accountability engine, not an order-execution engine.** It reads, decides, records and self-evaluates, the exact loop the track describes, but it does not place trades or manage P&L. That is a deliberate scope choice: the novel, defensible contribution is the *provable track record*, which is the hard part a desk cannot buy off the shelf. Execution is a well-understood layer to add on top of a signal source it can finally trust.

Naming these plainly is not a weakness in the submission; it is the behaviour of a product built by people who expect it to be used.

## Why this satisfies the criterion

Sentinel Arena is **deployed on production-appropriate infrastructure**, exposes the **metrics and logs an operator needs**, and carries **reliability features that were earned against real failures**, not imagined. It proved it can take a **real, high-volume, multi-hour shift** unattended. And it is **candid about its own edges**, which is exactly the posture a trading desk trusts. It is not a demo that happens to run, it is a product that has already worked a real day.

---

*Previous: [← 4 · Innovation & Novelty](./04-innovation-and-novelty.md) · Back to [documentation index](./README.md)*
