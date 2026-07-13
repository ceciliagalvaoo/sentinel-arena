import type { ReactNode } from "react";
import clsx from "clsx";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import Heading from "@theme/Heading";

import styles from "./index.module.css";

const SECTIONS = [
  { title: "Architecture", to: "/architecture", description: "The MarketDataSource abstraction, the data model, and the hardening that keeps it honest." },
  { title: "The Agents", to: "/agents", description: "Auto-calibrated thresholds, the decision loop, and why the accuracy number looks lower than 50%." },
  { title: "TxLINE Integration", to: "/txline-integration", description: "Every endpoint used, the auth flow, and the real surprises found integrating against the live API." },
  { title: "Solana & Commit-Reveal", to: "/solana-commit-reveal", description: "The SPL Memo commitment scheme, on-chain Merkle proof validation, and the public verify tool." },
  { title: "Dashboard & User Flow", to: "/dashboard-user-flow", description: "What a judge actually sees — Live vs. Replay, the replay showcase animation, the in-app tutorial." },
  { title: "Production Readiness", to: "/production-readiness", description: "Mapped directly to the hackathon's five judging criteria, plus real incidents found and fixed." },
];

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx("hero", styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <p className={styles.pitch}>
          Two autonomous agents watch the same live TxLINE odds feed and publish a cryptographic commitment of every
          signal on Solana <strong>before</strong> the match result is known — revealing it only after the final
          whistle. The result is a trading track record that's mathematically impossible to forge after the fact.
        </p>
        <div className={styles.buttons}>
          <Link className="button button--primary button--lg" to="/intro">
            Read the docs →
          </Link>
          <Link className="button button--outline button--lg" href="https://github.com/ceciliagalvaoo/sentinel-arena">
            View on GitHub
          </Link>
        </div>

        <div className={styles.agentRow}>
          <div className={clsx(styles.agentCard, styles["agentCard--aggressive"])}>
            <h3>Agent-Aggressive</h3>
            <p>
              <code>k = 1.5</code> — reacts fast to any market wobble. High signal frequency, catches more
              opportunities, more noise.
            </p>
          </div>
          <div className={clsx(styles.agentCard, styles["agentCard--conservative"])}>
            <h3>Agent-Conservative</h3>
            <p>
              <code>k = 3.0</code> — only moves on dramatic swings. Low signal frequency, more selective, fewer
              false positives.
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="Sentinel Arena"
      description="Two autonomous trading agents, one live TxLINE feed, cryptographic commit-reveal proof on Solana — built for the TxODDS World Cup Hackathon."
    >
      <HomepageHeader />
      <main className="container">
        <div className={styles.sectionGrid}>
          {SECTIONS.map((s) => (
            <Link key={s.to} to={s.to} className={styles.sectionCard}>
              <h3>{s.title}</h3>
              <p>{s.description}</p>
            </Link>
          ))}
        </div>
      </main>
    </Layout>
  );
}
