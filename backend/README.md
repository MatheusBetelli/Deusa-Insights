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

## Integração e Validação com Google Maps API

Implementamos uma rotina de validação e enriquecimento em lote para leads prioritários que cruza os dados cadastrais da Receita Federal com a **Google Geocoding API** e a **Google Places API** de maneira controlada.

### Como configurar a Chave

Adicione a chave da API no seu arquivo `.env` do backend:

```env
GOOGLE_MAPS_API_KEY="SUA_CHAVE_AQUI"
```

Se a chave não estiver configurada, o endpoint de validação informará que a funcionalidade está desativada, e o sistema continuará rodando de forma estável com coordenadas aproximadas (centroide + jitter).

### Como Rodar a Validação em Lote

Envie uma requisição HTTP POST para o endpoint administrativo:

`POST /companies/verify-google-batch`

**Parâmetros de Query:**
- `limit`: Quantidade de leads a serem processados (padrão: `50`, máximo: `100`).
- `city`: Filtro por cidade específica monitorada (ex: `Tupã`). Se omitido, processa todas as cidades ativas.
- `minScore`: Nota de corte mínima de oportunidade para filtrar (padrão: `70`).
- `dryRun`: Se definido como `true`, apenas simula a execução listando os leads qualificados e o custo estimado sem chamar a API do Google ou salvar no banco de dados.

#### Exemplos de chamadas:

* **Simulação (Recomendado antes de rodar lote real):**
  ```bash
  curl -X POST "http://127.0.0.1:3001/companies/verify-google-batch?limit=10&city=Tupã&minScore=70&dryRun=true"
  ```

* **Execução Real:**
  ```bash
  curl -X POST "http://127.0.0.1:3001/companies/verify-google-batch?limit=50&city=Tupã&minScore=70&dryRun=false"
  ```

### ⚠️ Alerta de Custo e Melhores Práticas

A API do Google é cobrada por uso:
- **Geocoding API**: $5.00 por 1.000 chamadas.
- **Places API (Text Search)**: $32.00 por 1.000 chamadas.
- **Places API (Details)**: $17.00 por 1.000 chamadas.

**Recomendações:**
1. Rode sempre um `dryRun` primeiro para conferir a contagem de leads prioritários.
2. Limite a verificação real a lotes de **50 ou 100 leads** por execução para controle orçamentário.
3. A rotina possui rate limit automático de **500ms** entre chamadas para evitar estouro de quotas.
