# syntax=docker/dockerfile:1

# --- build -------------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /repo

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    CI=1

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/signalr-client/package.json packages/signalr-client/package.json

RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY apps/web/ apps/web/
COPY packages/ packages/

# Относительный адрес: nginx проксирует /hubs/ в server, worker резолвит путь от location.href.
ARG VITE_SIGNALR_URL=/hubs/chat
ENV VITE_SIGNALR_URL=${VITE_SIGNALR_URL}

RUN pnpm --filter @chat/web build

# --- runtime -----------------------------------------------------------------
FROM nginx:stable-alpine AS runtime

COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /repo/apps/web/dist/ /usr/share/nginx/html/

ENV SIGNALR_BACKEND=server:8080

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
