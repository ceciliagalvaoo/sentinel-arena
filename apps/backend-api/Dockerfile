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
RUN npm run build --workspaces --if-present
EXPOSE 4000

CMD ["npm", "run", "start", "--workspace=@sentinel/backend-api"]
