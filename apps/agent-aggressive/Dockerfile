# Build context is the repo root (see docker-compose.yml) because this is an
# npm-workspaces monorepo: installing @sentinel/agent-aggressive needs the
# root package.json/lockfile plus every workspace package it depends on.
FROM node:24-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/agent-aggressive ./apps/agent-aggressive

RUN npm install
# @sentinel/shared-types and friends ship only source in git (dist/ is
# gitignored) -- compile them here, since npm install alone doesn't run
# each workspace's own `build` script.
RUN npm run build --workspaces --if-present

CMD ["npm", "run", "start", "--workspace=@sentinel/agent-aggressive"]
