# Один образ для web и worker. Многоэтапная сборка: в итоговом образе — только зависимости для работы
# (npm ci --omit=dev), без TypeScript, vitest, esbuild, Prisma CLI и embedded-postgres.
FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Все зависимости — для сборки
FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build && npm run check:bundle-secrets

# Только production-зависимости. Скрипты установки не нужны: sharp берёт готовые @img/*, клиент Prisma
# генерируется на этапе build (Prisma CLI — dev-зависимость) и копируется оттуда.
FROM base AS prod-deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
# chromium — рендер PDF; ffmpeg — «Мультфильм по книге» (libx264, libass, loudnorm); шрифты встраиваются из @fontsource
# и src/lib/gen/fonts (Nunito для субтитров), системные нужны только для запасных символов
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl chromium ffmpeg fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 CHROMIUM_PATH=/usr/bin/chromium
RUN useradd -r -u 1001 app
# node_modules: production-зависимости (воркер — tsx src/worker/index.ts, миграции — pg, seed — tsx);
# поверх — standalone-сборка Next (server.js и отобранные им модули тех же версий)
COPY --from=prod-deps --chown=app /app/node_modules ./node_modules
COPY --from=build --chown=app /app/.next/standalone ./
COPY --from=build --chown=app /app/.next/static ./.next/static
COPY --from=build --chown=app /app/public ./public
COPY --from=build --chown=app /app/prisma ./prisma
COPY --from=build --chown=app /app/src ./src
COPY --from=build --chown=app /app/scripts ./scripts
COPY --from=build --chown=app /app/package.json /app/tsconfig.json /app/prisma.config.ts ./
RUN mkdir -p /app/storage && chown app /app/storage
USER app
EXPOSE 3000
CMD ["node", "server.js"]
