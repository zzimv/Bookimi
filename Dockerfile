# Один образ для web и worker.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build && npm run check:bundle-secrets

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
# chromium — рендер PDF; ffmpeg — «Мультфильм по книге» (libx264, libass, loudnorm); шрифты встраиваются из @fontsource
# и src/lib/gen/fonts (Nunito для субтитров), системные нужны только для запасных символов
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl chromium ffmpeg fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 CHROMIUM_PATH=/usr/bin/chromium
RUN useradd -r -u 1001 app
COPY --from=build --chown=app /app/.next/standalone ./
COPY --from=build --chown=app /app/.next/static ./.next/static
COPY --from=build --chown=app /app/public ./public
COPY --from=build --chown=app /app/prisma ./prisma
COPY --from=build --chown=app /app/src ./src
COPY --from=build --chown=app /app/scripts ./scripts
COPY --from=build --chown=app /app/node_modules ./node_modules
COPY --from=build --chown=app /app/package.json ./package.json
COPY --from=build --chown=app /app/prisma.config.ts ./prisma.config.ts
RUN mkdir -p /app/storage && chown app /app/storage
USER app
EXPOSE 3000
CMD ["node", "server.js"]
