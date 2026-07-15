import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const ORG = "ceciliagalvaoo";
const REPO = "sentinel-arena";

const config: Config = {
  title: "Sentinel Arena",
  tagline: "Two autonomous trading agents, one live feed, cryptographic proof neither cherry-picked the result.",
  favicon: "img/favicon.svg",

  future: {
    v4: true,
  },

  url: `https://${ORG}.github.io`,
  baseUrl: `/${REPO}/`,

  organizationName: ORG,
  projectName: REPO,
  deploymentBranch: "gh-pages",
  trailingSlash: false,

  onBrokenLinks: "warn",
  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: "warn",
    },
  },

  themes: ["@docusaurus/theme-mermaid"],

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          routeBasePath: "/",
          sidebarPath: "./sidebars.ts",
          editUrl: `https://github.com/${ORG}/${REPO}/tree/main/docs-site/`,
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: "img/logo.svg",
    colorMode: {
      defaultMode: "dark",
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: "Sentinel Arena",
      logo: {
        alt: "Sentinel Arena logo",
        src: "img/logo.svg",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "docsSidebar",
          position: "left",
          label: "Docs",
        },
        {
          href: "https://github.com/ceciliagalvaoo/sentinel-arena",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            { label: "Overview", to: "/intro" },
            { label: "Architecture", to: "/architecture" },
            { label: "The Agents", to: "/agents" },
            { label: "Roadmap", to: "/roadmap" },
          ],
        },
        {
          title: "Project",
          items: [
            { label: "GitHub repository", href: `https://github.com/${ORG}/${REPO}` },
            { label: "TxODDS World Cup Hackathon", href: "https://earn.superteam.fun" },
          ],
        },
        {
          title: "Authors",
          items: [
            { label: "Pablo Azevedo", href: "https://github.com/zzaved" },
            { label: "Cecília Galvão", href: "https://github.com/ceciliagalvaoo" },
          ],
        },
      ],
      copyright: `Built for the TxODDS World Cup Hackathon (Track: Trading Tools and Agents) · Sentinel Arena, ${new Date().getFullYear()}.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["bash", "sql", "typescript", "rust"],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
