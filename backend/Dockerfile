# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: builder — instala dependências e compila TypeScript
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copia manifestos de dependências primeiro (layer de cache)
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Instala TODAS as dependências (incluindo devDependencies para o build)
RUN npm ci --frozen-lockfile

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
FROM node:20-alpine AS runner

WORKDIR /app

# Cria usuário não-root para segurança
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copia apenas o necessário para produção
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/dist ./dist/
COPY --from=builder /app/prisma ./prisma/
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma/

# Instala apenas dependências de produção (exclui devDependencies)
RUN npm ci --frozen-lockfile --omit=dev && npm cache clean --force

# Usa o usuário não-root
USER nestjs

# Porta do backend NestJS
EXPOSE 3001

ENV NODE_ENV=production

# Inicializa a aplicação NestJS (migrations devem ser executadas no pre-deploy)
CMD ["node", "dist/main.js"]
