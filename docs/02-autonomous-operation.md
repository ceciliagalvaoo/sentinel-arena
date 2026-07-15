<p align="center">
  <img src="img/rush.gif" alt="Rush, the aggressive agent" height="100" />
  &nbsp;&nbsp;&nbsp;
  <img src="img/logo.png" alt="Sentinel Arena" height="78" />
  &nbsp;&nbsp;&nbsp;
  <img src="img/sage.gif" alt="Sage, the conservative agent" height="100" />
</p>

# 2 · Autonomous Operation

> *After deploy, no human touches anything, a literal, eliminatory criterion.*

## We watched it prove this, live, on a real match

This is the criterion that eliminates entrants, so we will not argue it in the abstract. We will tell you what happened on **July 14–15, 2026**, while we were writing this very documentation.

The World Cup semifinal **France × Spain** kicked off. The two agents, already running on their server, were consuming the pre-match and in-play odds and committing signals on their own. We opened a read-only watchdog against the public API and simply observed, we did not touch the agents, the database, or the chain. Here is the timeline it recorded:

- **During play:** the agents committed continuously. The aggressive agent, Rush, climbed past **5,000 signals** on this fixture alone; the conservative agent, Sage, committed **1,808**. The backend answered every health check `200 OK`, and the newest-signal timestamp advanced in real time, the agents were alive and working.
- **At the final whistle:** the agents received the score stream's `game_finalised` event. With no human involved, the fixture's status flipped to `finished` and the agents **began revealing and grading every pending signal automatically**.
- **Over the following ~3.5 hours:** the agents published **thousands of reveal transactions to Solana, one at a time**, draining the entire backlog. Sage settled to **1,807 of 1,808** signals revealed and graded; Rush ground through its much larger pile of **~6,400**. The backend stayed healthy throughout.
- **The end state:** the match moved from the **Live** tab to the **Replay** tab, now a permanent, fully-graded, on-chain record, assembled without a single human action.

That is the criterion, demonstrated end-to-end, on a real fixture, in front of us. Nobody clicked anything.

<p align="center"><b>Figure 1 - France × Spain after full-time: fully settled and moved to Replay, assembled with zero human input</b></p>

<p align="center">
  <img src="img/overview.png" alt="The dashboard after the match settled, both agents graded, the cumulative-accuracy chart complete" width="760" />
</p>

<p align="center"><sub>Source: The authors (2026)</sub></p>

## The full loop, and why nothing in it needs a human

The agent's `AgentLoop` is the whole employee. Once `start()` is called, it runs this cycle forever, unattended:

> **ingest odds → detect a sharp move → commit the prediction on-chain → ingest scores → detect the final whistle → reveal → grade.**

Each hand-off is automatic. A market move triggers a commit; the final-whistle event triggers settlement; settlement triggers reveal and grade. There is no step that waits for approval, no dashboard button that a human must press to advance the pipeline. The dashboard is **read-only by design**, it can observe what the agents have done, but it cannot act on their behalf, precisely so that "autonomous" is a structural fact and not a promise.

## It doesn't just run, it survives

Autonomy that dies on the first hiccup is not autonomy. Sentinel Arena assumes the world is hostile and keeps itself alive:

- **It heals its own crashes.** If the process dies in the sliver of time between recording a signal and landing its commit, it leaves an orphan, a prediction with no on-chain proof. On restart, the agent finds these and republishes the commit late **using the already-frozen payload hash**, but only for fixtures it hasn't already graded. A commit published after the result is knowable would be a dishonest predictive claim, so those are logged as unrecoverable rather than quietly "fixed." The system would rather leave a gap than fake a record.
- **It protects its own wallet.** A background monitor watches the agent's balance and **pauses new commits** when it drops below the transaction-fee safety floor, resuming automatically when topped up. It never attempts a transaction it can't afford to land.
- **It refuses to trip over its own bursts.** All blockchain publishing is serialized through a single queue with minimum spacing, so a volatile moment, or a fast-forwarded replay, cannot fire dozens of concurrent transactions and get rate-limited by the public RPC. Detection stays synchronous so it never falls behind; only the publishing is paced.
- **It refuses to be killed by a stray error.** Last-resort `unhandledRejection` and `uncaughtException` handlers keep the process from dying because a public RPC hiccuped with a transient error inside a library's own timer callback.

None of these are cosmetic. Each is the difference between "ran during the demo" and "ran through a real, messy, hours-long World Cup match without us."

## An honesty guarantee that also proves autonomy

One detail from the live settle is worth dwelling on: Sage finished at **1,807 of 1,808**, not a clean 1,808. That single un-revealed signal is the orphan-integrity guard doing its job, it was a prediction that could not be revealed honestly, so the agent left it alone rather than fabricating a reveal to round out its own numbers.

This matters for autonomy because it shows the system makes **principled decisions on its own**, including the decision *not* to act. It is not blindly maximizing a completion metric; it is following a defensible rule without supervision. An autonomous employee you can trust is one that will leave a number imperfect rather than lie to make it look finished.

## Where it runs, and why that placement is deliberate

The agents run **24/7 on a free-tier Google Cloud `e2-micro` VM**, launched with a single `docker compose -f docker-compose.agents.yml up -d`. This placement is intentional and documented: web hosts with free tiers spin their services down after minutes of inactivity, which is fatal for a process that must stay awake to catch a final whistle at an unpredictable time. By separating the always-on agents (on the VM) from the occasionally-viewed dashboard (on a web host) and the database (on Supabase), each piece lives where its uptime needs are actually met.

## Why this satisfies the criterion

The criterion asks whether a human ever has to touch the system after deploy. Our answer is a real, observed run: **an entire World Cup match, kickoff, play, final whistle, thousands of on-chain reveals, and settlement into a permanent record, completed with nobody touching anything.** The loop needs no human to advance, the dashboard is structurally incapable of acting for the agents, and the system heals its own crashes, guards its own wallet, and paces its own transactions so that "unattended" holds through real-world turbulence, not just a calm demo.

---

*Previous: [← 1 · Core Functionality & Data Ingestion](./01-core-functionality-and-data-ingestion.md) · Next: [3 · Logic & Code Architecture →](./03-logic-and-architecture.md)*
