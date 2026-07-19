import type { ReactNode } from "react";
import clsx from "clsx";
import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import Heading from "@theme/Heading";

import styles from "./index.module.css";

const SECTIONS = [
  { title: "Judging Criteria", to: "/judging", description: "How Sentinel Arena meets each of the track's five criteria, with on-chain evidence and diagrams." },
  { title: "How It Works", to: "/architecture", description: "The MarketDataSource abstraction, the auto-calibrated agents, TxLINE and the commit-reveal design." },
  { title: "Run & Deploy", to: "/getting-started", description: "Spin up the whole stack locally, then the production topology that keeps the agents awake 24/7." },
  { title: "Reference", to: "/txline-feedback-log", description: "The TxLINE API feedback log kept since day one, and what comes after the hackathon." },
];

// Cecília always before Pablo. Squirrel colour matches each photo's background.
const TEAM = [
  {
    name: "Cecília Galvão",
    role: "Agents · Backend · Blockchain",
    photo: "/img/team/Cecilia.png",
    squirrel: "/img/judging/rush.gif",
    linkedin: "https://www.linkedin.com/in/ceciliagalvaoo/",
    github: "https://github.com/ceciliagalvaoo",
  },
  {
    name: "Pablo Azevedo",
    role: "Full-Stack · Frontend · Product",
    photo: "/img/team/Pablo.png",
    squirrel: "/img/judging/sage.gif",
    linkedin: "https://www.linkedin.com/in/pabloazevedo",
    github: "https://github.com/zzaved",
  },
];

function TeamMember({ member }: { member: (typeof TEAM)[number] }) {
  const photo = useBaseUrl(member.photo);
  const squirrel = useBaseUrl(member.squirrel);
  return (
    <div className={styles.teamCard}>
      <div className={styles.teamPhotoWrap}>
        <img src={photo} alt={member.name} className={styles.teamPhoto} />
        <img src={squirrel} alt="" className={styles.teamSquirrel} />
      </div>
      <p className={styles.teamName}>{member.name}</p>
      <p className={styles.teamRole}>{member.role}</p>
      <p className={styles.teamLinks}>
        <a href={member.linkedin}>LinkedIn</a> · <a href={member.github}>GitHub</a>
      </p>
    </div>
  );
}

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  const rushGif = useBaseUrl("/img/judging/rush.gif");
  const sageGif = useBaseUrl("/img/judging/sage.gif");

  return (
    <header className={clsx("hero", styles.heroBanner)}>
      <div className="container">
        <div className={styles.mascotRow}>
          <img src={rushGif} alt="Rush, the aggressive agent" className={styles.heroMascot} />
          <Heading as="h1" className={clsx("hero__title", styles.heroTitle)}>
            {siteConfig.title}
          </Heading>
          <img src={sageGif} alt="Sage, the conservative agent" className={styles.heroMascot} />
        </div>

        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <p className={styles.pitch}>
          Two autonomous agents watch the same live TxLINE odds feed and publish a cryptographic commitment of every
          signal on Solana <strong>before</strong> the match result is known, revealing it only after the final
          whistle. The result is a trading track record that is mathematically impossible to forge after the fact.
        </p>

        <div className={styles.buttons}>
          <Link className="button button--primary button--lg" href="https://youtu.be/T40LWA3_C-k">
            🎬 Watch the demo
          </Link>
          <Link className="button button--secondary button--lg" to="/judging">
            See the judging criteria →
          </Link>
          <Link className="button button--secondary button--lg" href="https://sentinel-dashboard-fq9r.onrender.com/">
            Open the live dashboard
          </Link>
          <Link className="button button--outline button--lg" href="https://github.com/ceciliagalvaoo/sentinel-arena">
            GitHub
          </Link>
        </div>

        <div className={styles.agentRow}>
          <div className={clsx(styles.agentCard, styles.agentRush)}>
            <img src={rushGif} alt="Rush" className={styles.agentGif} />
            <div>
              <h3>Rush</h3>
              <p className={styles.agentMeta}><code>k = 1.5</code> · the aggressive agent</p>
              <p>Reacts fast to any market wobble. High signal frequency, catches more opportunities, more noise.</p>
            </div>
          </div>
          <div className={clsx(styles.agentCard, styles.agentSage)}>
            <img src={sageGif} alt="Sage" className={styles.agentGif} />
            <div>
              <h3>Sage</h3>
              <p className={styles.agentMeta}><code>k = 3.0</code> · the conservative agent</p>
              <p>Only moves on dramatic swings. Low signal frequency, more selective, fewer false positives.</p>
            </div>
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
      description="Two autonomous trading agents, one live TxLINE feed, cryptographic commit-reveal proof on Solana, built for the TxODDS World Cup Hackathon."
    >
      <HomepageHeader />
      <main className="container">
        <h2 className={styles.startHere}>Watch the demo</h2>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", borderRadius: 8 }}>
            <iframe
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
              src="https://www.youtube.com/embed/T40LWA3_C-k"
              title="Sentinel Arena demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
          <p style={{ textAlign: "center", opacity: 0.8, marginTop: "0.8rem" }}>
            Two agents, one live feed, and a track record you can verify yourself.
          </p>
        </div>

        <h2 className={styles.startHere}>Start here</h2>
        <div className={styles.sectionGrid}>
          {SECTIONS.map((s) => (
            <Link key={s.to} to={s.to} className={styles.sectionCard}>
              <h3>{s.title}</h3>
              <p>{s.description}</p>
            </Link>
          ))}
        </div>

        <h2 className={styles.startHere}>Team</h2>
        <div className={styles.teamRow}>
          {TEAM.map((m) => (
            <TeamMember key={m.name} member={m} />
          ))}
        </div>
      </main>
    </Layout>
  );
}
