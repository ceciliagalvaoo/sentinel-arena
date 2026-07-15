import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  docsSidebar: [
    "intro",
    {
      type: "category",
      label: "Judging Criteria",
      link: { type: "doc", id: "judging" },
      collapsed: false,
      items: [
        "criteria-core-functionality",
        "criteria-autonomous-operation",
        "criteria-logic-architecture",
        "criteria-innovation",
        "criteria-production-readiness",
      ],
    },
    {
      type: "category",
      label: "How It Works",
      items: [
        "architecture",
        "agents",
        "txline-integration",
        "solana-commit-reveal",
        "dashboard-user-flow",
        "production-readiness",
      ],
    },
    {
      type: "category",
      label: "Run & Deploy",
      items: ["getting-started", "deployment"],
    },
    {
      type: "category",
      label: "Reference",
      items: ["txline-feedback-log", "roadmap"],
    },
  ],
};

export default sidebars;
