# syntax=docker/dockerfile:1

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-slim AS base
ARG PNPM_VERSION=12.9.0
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install --global --allow-scripts=pnpm pnpm@${PNPM_VERSION}
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=tasrif-pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile --store-dir=/pnpm-store

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG SITE_URL
RUN PGHOST=build PGUSER=build PGDATABASE=build AUTH_PASSWORD=build-only-password AUTH_SECRET=build-only-secret-build-only-secret pnpm build

FROM node:${NODE_VERSION}-slim AS runtime
ARG SITE_URL
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    SITE_URL=${SITE_URL}
WORKDIR /app
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]