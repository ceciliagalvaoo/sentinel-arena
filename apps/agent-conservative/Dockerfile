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
RUN npm run build --workspaces --if-present

CMD ["npm", "run", "start", "--workspace=@sentinel/agent-conservative"]
