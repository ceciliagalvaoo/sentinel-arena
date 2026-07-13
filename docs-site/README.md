# Sentinel Arena docs site

Built with [Docusaurus](https://docusaurus.io/). Deployed automatically to GitHub Pages by `.github/workflows/deploy-docs.yml` on every push to `main`/`master` that touches this directory — no manual deploy command needed.

## Local development

```bash
npm install
npm run start
```

Starts a dev server with live reload at `http://localhost:3000`.

## Build

```bash
npm run build
```

Generates static files into `build/`. Sanity-check the production build locally with `npm run serve` before pushing.

## First-time GitHub Pages setup

The workflow handles the build and publish automatically, but GitHub Pages itself needs to be pointed at it once, manually, in the repo's settings:

1. Push this repo to GitHub (`main`/`master` branch).
2. Repo → **Settings → Pages → Source** → select **GitHub Actions**.
3. Push (or re-run) the `Deploy docs to GitHub Pages` workflow from the **Actions** tab.
4. The site publishes to `https://ceciliagalvaoo.github.io/sentinel-arena/`.

If the GitHub username/repo ever changes, update `ORG`/`REPO` at the top of `docusaurus.config.ts` to match — everything else (`url`, `baseUrl`, footer links) derives from those two constants.
