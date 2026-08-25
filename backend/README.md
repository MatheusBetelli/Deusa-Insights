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

## Testes Unitários

Para executar a suíte de testes unitários do backend (validação de CNPJ, cálculo de score de leads, qualidade cadastral e regras de negócio):

```bash
npm test
```

## Variáveis de ambiente

```env
DATABASE_URL="postgresql://deusa:deusa@localhost:5435/deusa_analytics?schema=public"
PORT=3001
JWT_SECRET="change-me-in-production"
```

O provider ativo de CNPJ nesta versao le o CSV local da Receita Federal, entao `CNPJ_API_BASE_URL` e `CNPJ_API_TOKEN` nao sao necessarios para o fluxo atual de importacao.

## Prisma

```bash
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npx prisma studio
```

## Usuários seed

O seed requer `RUN_SEED=true`, `SEED_ADMIN_PASSWORD` e `SEED_SALES_PASSWORD`, e é
bloqueado fora de um banco local dedicado. As senhas não possuem valores padrão.

O seed cria usuários, cidades monitoradas e CNAEs alvo. Empresas e leads reais entram pelo fluxo de importação/consulta usando o `ReceitaFederalProvider`.

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
  -d '{"email":"<email-configurado>","password":"<senha-configurada>"}'
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

A implementação ativa é `ReceitaFederalProvider`.

Fonte real atual:

```text
dadosCNAE/sp_4712100_estabelecimentos.csv
```

Esse CSV foi filtrado a partir do layout ESTABELE da Receita Federal para CNAE `4712100` no estado de SP. O provider carrega o arquivo em memória, indexa por código TOM do município e mapeia os registros para o modelo interno `ExternalCompany`.

O provider mock foi removido do fluxo funcional atual. Permanecem apenas placeholders para integrações futuras:

- `MinhaReceitaProvider`
- `DadosAbertosProvider`

### Coordenadas e rastreabilidade

A base ESTABELE da Receita Federal não fornece latitude e longitude dos estabelecimentos. Quando a cidade está mapeada, o sistema gera uma coordenada visual aproximada usando centroide municipal com jitter determinístico por CNPJ.

Campos importantes:

- `origemCoordenada`: identifica a origem da coordenada. Para os dados atuais, o valor mais comum é `municipio_centroide_jitter`.
- `statusVerificacaoEndereco`: indica o status de verificação cadastral/endereço, como `aproximado`, `nao_verificado` ou `confiavel_cadastralmente`.
- `confiancaVerificacao`: pontuação de confiança cadastral de 0 a 100.

Importante: coordenadas com origem em centroide/jitter são apenas aproximações visuais por município. Elas não representam o endereço físico real do estabelecimento.

## Regras implementadas

- CNPJ único em `Company`.
- Importação normaliza CNPJ/CNAE e faz upsert de empresas.
- Importação cria leads automaticamente.
- Importação preserva campos de qualidade cadastral:
  - `origemCoordenada`
  - `statusVerificacaoEndereco`
  - `confiancaVerificacao`
  - `enderecoCompleto`
  - `pendenteValidacao`
  - `motivosPendencia`
  - `pontuacaoOportunidade`
  - `nivelOportunidade`
  - `motivoPontuacao`
- `potentialLevel`:
  - `0-49 LOW`
  - `50-74 MEDIUM`
  - `75-89 HIGH`
  - `90-100 CRITICAL`

## Integração com Google Maps

O backend não expõe descoberta regional nem geocodificação em lote. A base PostgreSQL é a fonte única da verdade e nenhuma coordenada é alterada automaticamente.

A única consulta paga disponível é individual, autenticada e limitada por taxa em `POST /companies/:id/location-candidates`. Ela exige `confirmPaidRequest: true` no corpo e apenas retorna candidatos para revisão humana; a persistência depende de uma ação posterior explicitamente autorizada e permanece bloqueada em produção quando `ENABLE_LEAD_MUTATIONS=false`.
