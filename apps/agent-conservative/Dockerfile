# See apps/agent-aggressive/Dockerfile — same monorepo build pattern.
FROM node:24-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/agent-conservative ./apps/agent-conservative

RUN npm install
# @sentinel/shared-types and friends ship only source in git (dist/ is
# gitignored) -- compile them here, since npm install alone doesn't run
# each workspace's own `build` script.
# `--workspaces` builds in alphabetical discovery order, not dependency
# order, so packages that import shared-types/txline-client would compile
# first and fail -- list workspaces explicitly in topological order.
RUN npm run build --workspace=@sentinel/shared-types \
 && npm run build --workspace=@sentinel/txline-client \
 && npm run build --workspace=@sentinel/commit-reveal \
 && npm run build --workspace=@sentinel/market-data-source \
 && npm run build --workspace=@sentinel/agent-runtime

CMD ["npm", "run", "start", "--workspace=@sentinel/agent-conservative"]
