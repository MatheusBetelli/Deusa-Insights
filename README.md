# 🥑 Deusa Analytics — Dashboard Interno de Inteligência Comercial

Dashboard interno de geolocalização e inteligência comercial exclusivo para os integrantes da Deusa Alimentos.

---

## ⚡ Início Rápido

```bash
# 1. Instalar dependências e preparar ambiente (idempotente)
npm install && npm run setup

# 2. Iniciar banco de dados e aplicação (Frontend + Backend)
npm run db:start
npm run dev
```

- **Frontend:** `http://localhost:8080` (ou `http://localhost:5173`)
- **Backend API:** `http://localhost:3001` (Healthcheck: `/health`)

---

## 🔑 Usuários de desenvolvimento

O seed é opt-in e aceita somente banco local dedicado. Antes de executá-lo, defina
`RUN_SEED=true`, `SEED_ADMIN_PASSWORD` e `SEED_SALES_PASSWORD`; não existem senhas padrão.

---

## 🧪 Testes Unitários

```bash
npm run test          # Executa todos os testes (Backend + Frontend em paralelo)
npm run test:backend  # Apenas testes do Backend (NestJS / Node test)
npm run test:frontend # Apenas testes do Frontend (Vite / TSX test)
```

---

## 🛠️ Comandos Principais

| Comando | Descrição |
| :--- | :--- |
| `npm run setup` | Prepara ambiente (.env, Docker, Prisma, Seed). |
| `npm run doctor` | Valida portas, Node, Docker e variáveis de ambiente. |
| `npm run dev` | Inicia Frontend (`3001`) e Backend (`8080`) juntos. |
| `npm run test` | Roda a suíte completa de testes unitários. |
| `npm run db:start` | Sobe o container PostgreSQL (`docker compose up -d`). |
| `npm run db:stop` | Para o container PostgreSQL (`docker compose down`). |
| `npm run db:migrate` | Aplica as migrações do Prisma ORM. |
| `npm run build` | Compila Backend e Frontend para produção. |

---

## 🩺 Requisitos & Solução de Problemas

- **Requisitos:** Node.js `>= 20.0.0`, npm `>= 9.0.0`, Docker Engine / Desktop ativo.
- **Diagnóstico:** Execute `npm run doctor` para detectar conflitos de porta ou variáveis ausentes.
- **Banco Inacessível (`localhost:5435`):** Certifique-se de que o Docker está rodando e execute `npm run db:start`.
