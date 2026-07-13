# See apps/agent-aggressive/Dockerfile — same monorepo build pattern.
FROM node:24-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/backend-api ./apps/backend-api

RUN npm install
# @sentinel/shared-types and @sentinel/commit-reveal ship only source in
# git (dist/ is gitignored) -- compile them here, since npm install alone
# only installs deps, it doesn't run each workspace's own `build` script.
# `--workspaces` builds in alphabetical discovery order, not dependency
# order, so commit-reveal (which imports shared-types) would compile first
# and fail -- list workspaces explicitly in topological order instead.
RUN npm run build --workspace=@sentinel/shared-types \
 && npm run build --workspace=@sentinel/commit-reveal
EXPOSE 4000

CMD ["npm", "run", "start", "--workspace=@sentinel/backend-api"]
