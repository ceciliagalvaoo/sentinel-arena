# Build context is the repo root (see docker-compose.yml) for npm-workspaces
# resolution consistency with the other Dockerfiles — even though this app
# has zero @sentinel/* package dependencies today.
FROM node:24-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/dashboard ./apps/dashboard

RUN npm install

# NEXT_PUBLIC_* vars are inlined into the client bundle at BUILD time, so
# they need to be ARGs (not just runtime `environment:` in docker-compose,
# which only affects `next start`, too late for what already got baked in).
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_SOLANA_CLUSTER=devnet
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOLANA_CLUSTER=$NEXT_PUBLIC_SOLANA_CLUSTER

RUN npm run build --workspace=@sentinel/dashboard

EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=@sentinel/dashboard"]
