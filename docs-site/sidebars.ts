import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  docsSidebar: [
    "intro",
    "getting-started",
    {
      type: "category",
      label: "Judging Criteria",
      link: { type: "doc", id: "judging" },
      items: [
        "criteria-core-functionality",
        "criteria-autonomous-operation",
        "criteria-logic-architecture",
        "criteria-innovation",
        "criteria-production-readiness",
      ],
    },
    "architecture",
    "agents",
    "txline-integration",
    "solana-commit-reveal",
    "dashboard-user-flow",
    "production-readiness",
    "deployment",
    "txline-feedback-log",
    "roadmap",
  ],
};

export default sidebars;
