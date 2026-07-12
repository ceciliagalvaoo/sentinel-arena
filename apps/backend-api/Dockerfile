# See apps/agent-aggressive/Dockerfile — same monorepo build pattern.
FROM node:24-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/backend-api ./apps/backend-api

RUN npm install
EXPOSE 4000

CMD ["npm", "run", "start", "--workspace=@sentinel/backend-api"]
