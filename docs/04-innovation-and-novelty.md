<p align="center">
  <img src="img/rush.gif" alt="Rush, the aggressive agent" height="100" />
  &nbsp;&nbsp;&nbsp;
  <img src="img/logo.png" alt="Sentinel Arena" height="78" />
  &nbsp;&nbsp;&nbsp;
  <img src="img/sage.gif" alt="Sage, the conservative agent" height="100" />
</p>

# 4 · Innovation & Novelty

> *Does the approach bring something new to analysis or algorithmic trading, or is it the pattern everyone does?*

## The idea everyone else skips: prove you're not lying

Almost every trading bot ever demoed makes the same claim, *"it has an X% hit rate"*, and asks you to trust it. You cannot. A backtest can be overfit. A live track record can be quietly curated: keep the winners, forget the losers, and the numbers look great. The dirty secret of algorithmic trading is that **a performance claim is only as good as your trust in the person making it.**

Sentinel Arena's core innovation is to **remove that trust from the equation entirely.** The agents do not ask you to believe their track record, they make it **cryptographically impossible to fake**.

The mechanism is **commit–reveal on a public blockchain**:

1. The instant an agent detects a signal, it hashes its full prediction and **publishes that hash to Solana, before the match result exists.** The prediction is now locked in a box the agent itself cannot open or edit.
2. Only after the final whistle does the agent **reveal** the full prediction. Anyone can hash the revealed content and confirm it matches the fingerprint committed hours earlier.

The proof is airtight because it rests on **two independent clocks**: TxLINE timestamps the data, and Solana timestamps the decision. Since the commit provably lands before the outcome is knowable, the agent cannot have cherry-picked with hindsight. A verifiable, un-forgeable accuracy record is the thing this project contributes that the standard "a bot that trades" does not.

<p align="center"><b>Figure 1 - The commit → reveal flow, told to a first-time visitor in plain language</b></p>

<p align="center">
  <img src="img/tutorial-modal.png" alt="The How To Use modal, with the SIGNAL to COMMIT to REVEAL flow diagram" width="620" />
</p>

<p align="center"><sub>Source: The authors (2026)</sub></p>

## "Don't trust us, verify it yourself"

Novelty that only the authors can check is a parlour trick. So the verification is **public and third-party-usable.** Sentinel Arena ships a standalone tool where anyone, a judge, a skeptic, a stranger, pastes any commit/reveal transaction pair and gets an independent yes/no, re-derived from the Solana blockchain itself, with no need to trust our servers.

The verifier runs four checks, each reading straight from chain:

- the signal IDs match between the commit and the reveal;
- the reveal references the correct commit;
- the revealed hash matches the committed hash;
- and, the crux, the **commit happened before the reveal**.

Crucially, it works for **any** commit/reveal pair using the Sentinel memo format, not only the ones our two agents produced. The trust model is *"here is the math, run it yourself,"* which is precisely the property that makes the track record novel.

<p align="center"><b>Figure 2 - The public proof verifier: independent, on-chain, works for any pair using the format</b></p>

<p align="center">
  <img src="img/verify.png" alt="The Verify a Proof page with commit and reveal transaction signature inputs" width="700" />
</p>

<p align="center"><sub>Source: The authors (2026)</sub></p>

## The second novel move: a controlled two-agent experiment

Most bots run alone, so their results are anecdotes, was it a good strategy, or a good week? Sentinel Arena runs **two agents on the same feed at the same instant**, differing only in one strategy parameter. This turns a demo into a **controlled experiment**: because the inputs are identical, any difference in outcome is attributable to strategy alone, with no information-advantage confound.

It also makes the product legible. The abstract question *"is aggressive or conservative better on this match?"* becomes something you can literally watch play out between two named characters, **Rush** and **Sage**, reacting to the market in real time. The arcade presentation is not decoration; it is a way to make a rigorous, on-chain experiment immediately readable to a non-expert, without hiding any of the underlying proof.

<p align="center"><b>Figure 3 - Each feed row is a locked-then-revealed prediction, its hashes linking straight to the block explorer</b></p>

<p align="center">
  <img src="img/agent-card-rush.png" alt="Rush's card with a feed of commit-to-reveal rows, each hash copyable and linked on-chain" width="380" />
</p>

<p align="center"><sub>Source: The authors (2026)</sub></p>

## Innovation without a new attack surface

There is a quiet engineering elegance worth naming. The commitments are anchored using Solana's **SPL Memo program**, a standard, audited, pre-deployed program with the same address on mainnet and devnet. Sentinel Arena therefore introduces its novel accountability layer with **zero custom on-chain code to deploy, and zero new audit surface**. The innovation lives entirely in *how* a standard primitive is used, not in a risky bespoke contract. That is the mature way to be novel: new capability, old dependable foundations.

## Why this satisfies the criterion

The standard entry is *"an agent that trades and claims a hit rate."* Sentinel Arena's contribution is a category shift: **an agent whose honesty about its own track record is mathematically provable by anyone, on-chain, before the result exists**, delivered as a controlled two-agent experiment and built on an audited primitive rather than a bespoke contract. It is not a prettier version of the pattern everyone does. It answers a question the pattern everyone does cannot: *why should I believe your numbers?*

---

*Previous: [← 3 · Logic & Code Architecture](./03-logic-and-architecture.md) · Next: [5 · Production Readiness →](./05-production-readiness.md)*
