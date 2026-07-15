<p align="center">
  <img src="img/rush.gif" alt="Rush, the aggressive agent" height="100" />
  &nbsp;&nbsp;&nbsp;
  <img src="img/logo.png" alt="Sentinel Arena" height="78" />
  &nbsp;&nbsp;&nbsp;
  <img src="img/sage.gif" alt="Sage, the conservative agent" height="100" />
</p>

# Sentinel Arena, Judging Documentation

> **TxODDS World Cup Hackathon · Track: Trading Tools and Agents**

This folder is written for one purpose: to walk a judge, criterion by criterion, through **why Sentinel Arena is a real autonomous trading agent**, not a slide, not a mock, but a system that reads the market, decides, records its decision on-chain before the result exists, and grades itself, with nobody touching it after deploy.

Everything here is backed by real, on-chain evidence. Where we show a number, it came from the live devnet deployment during real 2026 World Cup fixtures, including a match we watched settle end-to-end while writing this documentation.

<p align="center"><b>Figure 1 - The live Sentinel Arena dashboard (France × Spain, replayed after full-time)</b></p>

<p align="center">
  <img src="img/overview.png" alt="The Sentinel Arena arcade dashboard showing the Rush and Sage agents, their event feeds, and the cumulative-accuracy chart" width="760" />
</p>

<p align="center"><sub>Source: The authors (2026)</sub></p>

---

## What Sentinel Arena is, in one paragraph

Sentinel Arena runs **two autonomous trading agents**, **Rush** (aggressive) and **Sage** (conservative), that watch the exact same live odds feed from **TxLINE**. Whenever an agent detects a sharp market move, it publishes a **cryptographic commitment of its prediction to the Solana blockchain before the outcome is known**, and reveals the full content only after the final whistle. The result is an accuracy track record that is **mathematically impossible to forge after the fact**: two independent timestamps, TxLINE's on the data, Solana's on the decision, prove the agent decided before the result existed. Because both agents read the same feed at the same instant, any difference in performance comes from strategy, never from an information advantage.

## The five judging criteria, one page each

| # | Criterion | The question it answers | Page |
|---|-----------|-------------------------|------|
| 1 | **Core Functionality & Data Ingestion** | Does it run stably, consuming TxLINE's feed without choking? | [01](./01-core-functionality-and-data-ingestion.md) |
| 2 | **Autonomous Operation** | After deploy, does a human ever have to touch it? *(eliminatory)* | [02](./02-autonomous-operation.md) |
| 3 | **Logic & Code Architecture** | Is every decision clear, deterministic and defensible? | [03](./03-logic-and-architecture.md) |
| 4 | **Innovation & Novelty** | Does it bring something genuinely new to algorithmic trading? | [04](./04-innovation-and-novelty.md) |
| 5 | **Production Readiness** | Would a real trading desk use this tomorrow? | [05](./05-production-readiness.md) |

## Try it yourself

- **Live dashboard:** <https://sentinel-dashboard-fq9r.onrender.com/>
- **Independent proof verifier:** <https://sentinel-dashboard-fq9r.onrender.com/verify>
- **Full technical deep-dive:** the [`docs-site/`](../docs-site) Docusaurus documentation.

## Authors

Built for the TxODDS World Cup Hackathon by **Pablo Azevedo** ([@zzaved](https://github.com/zzaved)) and **Cecília Galvão** ([@ceciliagalvaoo](https://github.com/ceciliagalvaoo)).
