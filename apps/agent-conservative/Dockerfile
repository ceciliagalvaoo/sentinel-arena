# See apps/agent-aggressive/Dockerfile — same monorepo build pattern.
FROM node:24-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/agent-conservative ./apps/agent-conservative

RUN npm install

CMD ["npm", "run", "start", "--workspace=@sentinel/agent-conservative"]
