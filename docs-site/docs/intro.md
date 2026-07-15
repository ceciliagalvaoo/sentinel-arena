---
id: intro
title: Overview
sidebar_label: Overview
---

# Sentinel Arena

<div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'22px',flexWrap:'wrap',margin:'8px 0 22px'}}>
  <img src={require('@site/static/img/judging/rush.gif').default} alt="Rush, the aggressive agent" style={{height:'90px'}} />
  <img src={require('@site/static/img/judging/logo.png').default} alt="Sentinel Arena" style={{height:'68px'}} />
  <img src={require('@site/static/img/judging/sage.gif').default} alt="Sage, the conservative agent" style={{height:'90px'}} />
</div>

**TxODDS World Cup Hackathon · Track: Trading Tools and Agents**

Sentinel Arena is a pair of fully autonomous trading agents that watch TxLINE's live World Cup odds feed, detect sharp market movements, and publish a **cryptographic commitment of the signal on Solana before the match result is known** — revealing the full content only after the final whistle. The result is a trading track record that is **mathematically impossible to forge after the fact**.

## The one-line pitch

> Two agents, the same data, different strategies — and an accuracy track record that not even their own creators can fake after the game.

## The problem

In any algorithmic trading market — sports or otherwise — the question that decides whether anyone trusts an agent's track record is: **"is this win rate real, or was it assembled after the fact by looking at the result?"** This is known as *lookahead bias* / *cherry-picking*, and it's why regulators (the CFTC, for one) require tamper-proof audit trails for prediction-market operators.

Sentinel Arena solves this by construction: every signal an agent produces is **committed on-chain** (a hash is published) at the exact instant of the decision, before the match result exists. After the game, the full content is revealed and compared against the hash — any attempt to alter the signal after the fact breaks verification.

## Two agents, one feed, opposite temperaments

| | **Rush** (aggressive) | **Sage** (conservative) |
|---|---|---|
| Sensitivity multiplier (`k`) | 1.5× | 3.0× |
| Detection window | 60s | 180s |
| Hypothesis | React fast to any market wobble — catch more opportunities | Only move on dramatic swings — fewer false positives |

Both agents read **the exact same live odds stream, at the exact same instant** — neither has an information edge over the other. Any difference in performance comes purely from strategy, not from a head start on the data. That symmetry is what makes the aggressive-vs-conservative comparison scientifically honest, not just a demo gimmick.

## Why this wins, in one sentence

No other submission proves agent reputation with cryptographic guarantees — most will *claim* a win rate; Sentinel Arena *proves* one, on-chain, verifiable by anyone who clicks a Solscan link.

## Where to go next

This documentation is organized into four sections:

- **[Judging Criteria](/judging)**, how Sentinel Arena meets each of the track's five criteria, with on-chain evidence, screenshots and diagrams. **Start here if you're evaluating the project.**
- **How It Works**, the technical deep-dive: [Architecture](/architecture), [The Agents](/agents), [TxLINE Integration](/txline-integration), [Solana & Commit-Reveal](/solana-commit-reveal), [Dashboard & User Flow](/dashboard-user-flow), and the [Hardening & Incidents](/production-readiness) log.
- **Run & Deploy**, [Getting Started](/getting-started) locally and the production [Deployment](/deployment) topology.
- **Reference**, the [TxLINE Feedback Log](/txline-feedback-log) and the [Roadmap](/roadmap).
