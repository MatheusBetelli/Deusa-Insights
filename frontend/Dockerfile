FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts ./
COPY src ./src

ARG VITE_API_URL=/api
ENV NODE_ENV=production
ENV VITE_API_URL=${VITE_API_URL}

RUN CI=1 npm run build:gcp

FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS runner

WORKDIR /app

RUN addgroup -S -g 1001 nodejs && \
    adduser -S -D -H -u 1001 -G nodejs nodejs

ENV NODE_ENV=production
ENV PORT=8080

COPY --from=builder --chown=nodejs:nodejs /app/.output ./.output

USER nodejs

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
