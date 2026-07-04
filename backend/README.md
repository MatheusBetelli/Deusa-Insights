# Deusa Analytics Backend

API REST do Deusa Analytics, construída com NestJS, TypeScript, PostgreSQL e Prisma.

## Stack

- NestJS
- TypeScript
- PostgreSQL
- Prisma ORM
- class-validator e class-transformer
- dotenv via `@nestjs/config`
- Docker Compose para banco local

## Setup

Na raiz do projeto:

```bash
docker compose up -d
```

No backend:

```bash
cd backend
npm install
cp .env.example .env
npx prisma migrate dev --name init
npm run seed
npm run start:dev
```

O backend sobe em `http://localhost:3001`.

## Variáveis de ambiente

```env
DATABASE_URL="postgresql://deusa:deusa@localhost:5435/deusa_analytics?schema=public"
PORT=3001
JWT_SECRET="change-me-in-production"
CNPJ_API_BASE_URL="https://example.com"
CNPJ_API_TOKEN=""
```

## Prisma

```bash
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npx prisma studio
```

## Usuários seed

```text
admin@deusa.com.br / admin123
rafael.mendes@deusa.com.br / deusa123
mariana.alves@deusa.com.br / deusa123
camila.rocha@deusa.com.br / deusa123
felipe.lima@deusa.com.br / deusa123
```

O seed também cria dados mockados para visualização do produto: cidades monitoradas, CNAEs alvo, 15 empresas/leads com scores variados, responsáveis comerciais, próximas ações, histórico de contatos, coordenadas para o mapa e jobs de importação.

## Endpoints

Auth:

```http
POST /auth/login
GET /auth/me
```

Dashboard:

```http
GET /dashboard/summary
```

Cities:

```http
GET /cities
POST /cities
PATCH /cities/:id
```

CNAEs:

```http
GET /cnaes
POST /cnaes
PATCH /cnaes/:id
```

Companies:

```http
GET /companies
GET /companies/:id
POST /companies
PATCH /companies/:id
POST /companies/sync/:cnpj
```

Leads:

```http
GET /leads
GET /leads/:id
POST /leads
PATCH /leads/:id
POST /leads/:id/convert
POST /leads/:id/discard
GET /leads/:id/interactions
POST /leads/:id/interactions
```

Imports:

```http
POST /imports/cnpj
GET /imports
GET /imports/:id
```

Map and pipeline:

```http
GET /map/opportunities
GET /pipeline
```

## Filtros

`GET /leads` aceita:

```text
city, uf, cnae, status, potentialLevel, minScore, maxScore, assignedToId, search
```

`GET /companies` aceita:

```text
city, uf, cnae, situacaoCadastral, search
```

## Exemplos

Login:

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"rafael.mendes@deusa.com.br","password":"deusa123"}'
```

Dashboard:

```bash
curl http://localhost:3001/dashboard/summary
```

Leads filtrados:

```bash
curl "http://localhost:3001/leads?city=Tupã&potentialLevel=CRITICAL"
```

Mapa:

```bash
curl http://localhost:3001/map/opportunities
```

Importar CNPJs:

```bash
curl -X POST http://localhost:3001/imports/cnpj \
  -H "Content-Type: application/json" \
  -d '{
    "uf": "SP",
    "cityName": "Tupã",
    "cityIbgeCode": "3555000",
    "cnaeCode": "4712100",
    "limit": 500
  }'
```

## Provider de CNPJ

O módulo `Imports` usa a interface `CnpjProvider`:

```ts
searchCompaniesByCityAndCnae(payload)
getCompanyByCnpj(cnpj)
```

A implementação ativa é `MockCnpjProvider`. Já existem placeholders para:

- `MinhaReceitaProvider`
- `ReceitaFederalProvider`
- `DadosAbertosProvider`

## Regras implementadas

- CNPJ único em `Company`.
- Importação normaliza CNPJ/CNAE e faz upsert de empresas.
- Importação cria leads automaticamente.
- Score inicial:
  - `+30` empresa ativa
  - `+25` CNAE alvo
  - `+15` nome fantasia
  - `+10` ME ou EPP
  - `+10` cidade monitorada
  - `+10` latitude/longitude
- `potentialLevel`:
  - `0-49 LOW`
  - `50-74 MEDIUM`
  - `75-89 HIGH`
  - `90-100 CRITICAL`
