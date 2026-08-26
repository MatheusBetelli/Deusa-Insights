# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: builder — instala dependências e compila TypeScript
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS builder

WORKDIR /app

# Copia manifestos de dependências primeiro (layer de cache)
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Instala TODAS as dependências (incluindo devDependencies para o build)
RUN npm ci

# Gera o Prisma Client
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    DIRECT_URL="postgresql://build:build@localhost:5432/build" \
    npx prisma generate

# Copia o código-fonte e compila
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src/
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: runner — imagem mínima de produção (sem devDependencies)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS runner

WORKDIR /app

# Cria usuário não-root para segurança
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copia apenas o necessário para produção
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/dist ./dist/
COPY --from=builder /app/prisma ./prisma/

# Instala apenas dependências de produção (exclui devDependencies)
RUN npm ci --omit=dev && npm cache clean --force

# `npm ci` limpa node_modules; copie o client gerado somente depois da instalação.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma/

# Usa o usuário não-root
USER nestjs

# Porta do backend NestJS
EXPOSE 3001

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

# Inicializa a aplicação NestJS (migrations devem ser executadas no pre-deploy)
CMD ["node", "dist/main.js"]
