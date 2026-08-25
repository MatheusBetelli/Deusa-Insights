# Repository Guidelines

## Project Structure & Module Organization

This npm monorepo has two main packages:

- `backend/`: NestJS REST API. Source lives in `backend/src`, organized by modules such as `auth`, `dashboard`, `leads`, `companies`, `map-opportunities`, and `users`. Prisma files and migrations are in `backend/prisma`.
- `frontend/`: React 19, Vite, TanStack Start/Router app. Routes are in `frontend/src/routes`, API clients in `frontend/src/services`, UI in `frontend/src/components`, and assets in `frontend/src/assets`.
- `docs/`, `scripts/`, `supabase/`, `.agents/`, and `.codex/` contain project docs, automation, deployment/database support, and agent-specific instructions.

## Build, Test, and Development Commands

- `npm run setup`: prepare local environment files and prerequisites.
- `npm run doctor`: check Node, Docker, ports, and required environment variables.
- `npm run db:start` / `npm run db:stop`: start or stop the local PostgreSQL container.
- `npm run dev`: run backend and frontend together.
- `npm run build`: build both packages for production.
- `npm run lint` and `npm run typecheck`: run static checks across packages.
- `npm run test`, `npm run test:backend`, `npm run test:frontend`: run all tests or one package only.
- `npm run db:migrate`, `npm run db:generate`, `npm run db:seed`: Prisma migration, client generation, and guarded local seed flow.

## Coding Style & Naming Conventions

Use Node `^22.13` or `>=24` and npm `>=10`. Code is TypeScript-first. Prettier uses `printWidth: 100`, semicolons, double quotes, and trailing commas. Backend files follow Nest conventions: `*.module.ts`, `*.controller.ts`, `*.service.ts`, with DTOs under `dto/`. Frontend components use `PascalCase`, hooks use `useX`, services use `camelCase`, and route files follow TanStack Router conventions.

## Testing Guidelines

Backend tests use Node's test runner with `ts-node` and live beside source as `backend/src/**/*.spec.ts`. Frontend tests use `tsx --test` with `frontend/src/**/*.spec.ts`; `frontend/src/e2e.test.ts` covers end-to-end behavior. Add focused tests for business rules, API contracts, formatting, and security-sensitive HTML/data handling.

## Commit & Pull Request Guidelines

Git history uses Conventional Commit-style prefixes, usually `feat:` or `fix:` with optional scopes such as `fix(dashboard): ...`. Keep summaries imperative and specific. Pull requests should include purpose, test commands, linked issue when applicable, screenshots for UI/dashboard changes, and notes for migrations, seeds, or environment variables.

## Security & Agent-Specific Data Rules

Do not commit `.env` files or secrets. Seeds require explicit local variables such as `RUN_SEED=true`. For commercial data, preserve the frozen dataset unless the user explicitly requests a change. Reuse PostgreSQL/cache before paid APIs; broad Google Places/Geocoding discovery or batch enrichment requires prior approval with volume and cost context.
