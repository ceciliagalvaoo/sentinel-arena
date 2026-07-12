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

CMD ["npm", "run", "start", "--workspace=@sentinel/agent-aggressive"]
