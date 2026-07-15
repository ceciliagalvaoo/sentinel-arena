<p align="center">
  <img src="img/rush.gif" alt="Rush, the aggressive agent" height="100" />
  &nbsp;&nbsp;&nbsp;
  <img src="img/logo.png" alt="Sentinel Arena" height="78" />
  &nbsp;&nbsp;&nbsp;
  <img src="img/sage.gif" alt="Sage, the conservative agent" height="100" />
</p>

# 3 · Logic & Code Architecture

> *The decision rule is clear, deterministic and defensible, you can explain why the robot did each thing.*

## A decision rule with no magic numbers

The most common way a trading bot becomes indefensible is a hand-tuned constant: *"fire when the odds move more than 5%."* Where did 5% come from? Nobody can say, and it is wrong for a sleepy group-stage match and a frantic final alike.

Sentinel Arena has **no such constant**. Its trigger threshold is never a human-picked number, it is **calibrated per fixture, from the volatility the agent itself observes** during a short warmup window. The rule is a single, explainable formula:

> **threshold = mean(observed moves) + k × standard-deviation(observed moves)**

During warmup, the agent simply watches how much a given match's odds normally jiggle. Once it has enough readings, it locks a threshold that means *"a move that is `k` standard deviations sharper than this match's own normal chatter."* A signal fires only when a move clears that bar. The threshold is computed once and **never silently recalculated**, so a signal's meaning is stable and auditable.

The only human choice in the entire decision is `k`, the sensitivity multiplier, and that is a **strategy** decision, not an alarm-tuning knob. There is deliberately no way to override the computed threshold directly.

## Two agents, one parameter, opposite temperaments

That single parameter is what creates the two competitors. They share **100% of the detection, commit, and grading code**, only their configuration differs:

<p align="center"><b>Table 1 - The two strategies differ by configuration only</b></p>

| | **Rush** (aggressive) | **Sage** (conservative) |
|---|---|---|
| Sensitivity multiplier `k` | **1.5×** | **3.0×** |
| Detection window | **60 s** | **180 s** |
| Temperament | Reacts fast to any wobble | Only moves on dramatic swings |

<p align="center"><sub>Source: The authors (2026)</sub></p>

Because both agents read the **same feed at the same instant**, the experiment is clean: any difference in their behaviour comes from strategy, never from information. And the hypothesis holds up in the real data. Across the France × Spain match, Rush fired roughly **2.5× as many signals** as Sage, the aggressive agent reacting to far more moves, the conservative one staying selective. That is exactly what `k = 1.5` versus `k = 3.0` is supposed to produce, observed live.

<p align="center"><b>Figure 1 - The two strategies explained in the product's own words, mascots and all</b></p>

<p align="center">
  <img src="img/tutorial-modal.png" alt="The How To Use modal explaining Rush and Sage, the commit-reveal flow, and the accuracy badge" width="620" />
</p>

<p align="center"><sub>Source: The authors (2026)</sub></p>

## Every decision leaves an auditable trail

"Defensible" means more than "explainable in a slide", it means the reasoning is recorded. Each signal freezes a canonical **`SignalPayload`** capturing exactly what the agent saw and decided: the fixture, the outcome, the triggering odds message and its timestamp, the before/after percentages, the computed change, and the moment of detection. That payload is hashed, and the hash is what gets committed on-chain. After the match, the full payload is revealed, and anyone can recompute the hash to confirm the record was never altered.

The upshot: for any signal the agent ever fired, you can answer *"why did it do that, and when?"*, down to the exact market tick that triggered it, cross-checked against TxLINE's own on-chain Merkle proof.

<p align="center"><b>Figure 2 - Cumulative accuracy plotted over real time; each step is a graded, on-chain decision</b></p>

<p align="center">
  <img src="img/chart-hover.png" alt="The cumulative-accuracy chart for Rush and Sage across the full match timeline" width="760" />
</p>

<p align="center"><sub>Source: The authors (2026)</sub></p>

## Architecture: shared logic, thin agents, clean seams

The codebase is a TypeScript monorepo whose structure enforces the "one brain, two configs" principle. The heavy logic lives in shared packages; the two agent apps are thin shims that differ only in their environment file.

<p align="center"><b>Table 2 - The load-bearing packages and what each owns</b></p>

| Package | Responsibility |
|---|---|
| **`shared-types`** | The canonical `SignalPayload`, deterministic hashing, and the database row types, one source of truth for the data contract. |
| **`txline-client`** | Auth, SSE subscription, snapshots, and on-chain Merkle-proof validation. Network config (RPC, program ID, mint, API host) is assembled in exactly one place. |
| **`market-data-source`** | The `MarketDataSource` interface with `LiveTxLineSource` and `ReplayDataSource`. |
| **`commit-reveal`** | The Solana commit/reveal transactions and the public, third-party-usable `verifySignalProof`. |
| **`agent-runtime`** | `AutoCalibratedThreshold`, the moving `Window`, the `AgentLoop`, and the grading engine, the shared brain. |
| **`apps/agent-aggressive` · `apps/agent-conservative`** | Thin config shims. Same loop, different `k`. |

<p align="center"><sub>Source: The authors (2026)</sub></p>

Two architectural rules keep the logic clean and defensible:

- **Network values come from a single assembler.** RPC URL, program ID, token mint, JWT host and API host must all belong to the *same* network; one function builds that bundle and nothing else hardcodes a cluster. This makes "which chain is this decision on?" unambiguous.
- **Optional integrity checks never gate the core.** On-chain proof cross-checking is run for real, but it is an integrity bonus, never a blocker: a commit never waits on a proof being available. The decision pipeline is kept free of anything that could make it stall or behave non-deterministically.

## Why the numbers look the way they do, and why that's honest

A judge glancing at ~40% accuracy might frown. The architecture explains it, and the product says so out loud. Each agent tracks **three outcomes per match**, home win, draw, away win, and fires on whichever one moves sharply. Only one of the three can end up true, so two of the three buckets are *guaranteed* wrong once the match ends, even when the read was sound in the moment. Chance alone sits near 33%, not 50%. Check any signal that bet on the actual final result and it is right almost every time.

We consider it a point of integrity that the system reports this plainly rather than cherry-picking a flattering subset, which is, after all, the entire thesis of the project.

## Why this satisfies the criterion

The decision rule is a **single, transparent formula** with exactly one human input, and that input is a declared strategy choice rather than a mystery constant. The rule is **deterministic**, calibrated once, never silently changed, and **auditable** down to the triggering tick via an on-chain, recomputable record. The architecture makes the logic **shared, thin, and seam-clean**, so the two agents are provably the same brain running two temperaments. You can explain why the robot did each thing, because the robot wrote down its reasoning and signed it.

---

*Previous: [← 2 · Autonomous Operation](./02-autonomous-operation.md) · Next: [4 · Innovation & Novelty →](./04-innovation-and-novelty.md)*
