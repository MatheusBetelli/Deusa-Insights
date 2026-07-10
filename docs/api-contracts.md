# Contratos de API - Deusa Analytics

Data de consolidacao: 2026-07-05

Este arquivo e a fonte de verdade dos contratos entre o frontend atual em React, o futuro frontend Angular e o backend NestJS. Qualquer migracao React -> Angular deve consumir estes contratos sem alterar semantica, nomes de campos ou comportamento esperado.

Base URL atual do frontend: `VITE_API_URL`, com fallback para `http://127.0.0.1:3001`.

Cliente React atual: `frontend/src/services/api.ts`.

## Status dos contratos

- `Confirmado`: rota existe no backend e o contrato esta alinhado com o codigo atual.
- `Pendente`: rota existe ou e necessaria, mas ainda falta integracao, decisao de uso ou teste de contrato antes do Angular.
- `Divergente`: existe diferenca conhecida entre documentacao, codigo, consumo atual ou expectativa de produto.

## Regras globais

- Todas as requisicoes JSON usam `Content-Type: application/json`.
- Query params com valor `undefined`, `null` ou string vazia sao omitidos pelo client React.
- Respostas `2xx` sao parseadas como JSON, exceto `204`.
- Erros HTTP retornam `ApiError` com `message` do payload quando existir.
- Erros de rede retornam mensagem amigavel de API indisponivel.
- O React atual nao envia `Authorization`; ele usa `localStorage` mockado para sessao visual.
- O Angular deve usar o backend real de auth: `POST /auth/login` e `GET /auth/me`.

## Tipos centrais

```ts
type UserRole = "ADMIN" | "MANAGER" | "SALES";

type LeadStatus =
  | "NEW"
  | "NO_CONTACT"
  | "CONTACTED"
  | "INTERESTED"
  | "NEGOTIATION"
  | "CONVERTED"
  | "NOT_INTERESTED"
  | "INACTIVE";

type PotentialLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type ImportStatus = "PENDING" | "RUNNING" | "SUCCESS" | "ERROR";
```

```ts
type UserSummary = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

type CompanyCnae = {
  id: string;
  companyId: string;
  cnaeCode: string;
  isPrimary: boolean;
};

type Company = {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  situacaoCadastral: string;
  porte: string | null;
  matrizFilial: string | null;
  dataAbertura: string | null;
  cnaePrincipal: string | null;
  uf: string;
  cidade: string;
  bairro: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  telefone?: string | null;
  email?: string | null;
  latitude: number | null;
  longitude: number | null;
  source: string;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
  cnaes?: CompanyCnae[];
  lead?: Lead;
  origemCoordenada?: string | null;
  statusVerificacaoEndereco?: string | null;
  confiancaVerificacao?: number | null;
  enderecoCompleto?: boolean;
  pendenteValidacao?: boolean;
  motivosPendencia?: string[] | null;
  pontuacaoOportunidade?: number;
  nivelOportunidade?: string | null;
  motivoPontuacao?: string[] | null;
};

type Lead = {
  id: string;
  companyId: string;
  status: LeadStatus;
  score: number;
  potentialLevel: PotentialLevel;
  assignedToId: string | null;
  notes: string | null;
  lastContactAt: string | null;
  nextActionAt: string | null;
  createdAt: string;
  updatedAt: string;
  company: Company;
  assignedTo?: UserSummary | null;
  interactions?: LeadInteraction[];
};

type LeadInteraction = {
  id: string;
  leadId: string;
  userId: string;
  type: string;
  description: string;
  createdAt: string;
  user?: UserSummary;
};
```

## Regra obrigatoria de coordenadas

Quando `origemCoordenada` contem `centroide` ou `jitter`, a coordenada e apenas uma aproximacao visual por municipio. Ela nao representa o endereco fisico real do estabelecimento. O Angular deve preservar os avisos visuais e textuais atuais:

- marcador diferenciado no mapa;
- popup com aviso de localizacao aproximada;
- banner quando a maioria dos pontos filtrados usa centroide/jitter;
- detalhe do lead com aviso de localizacao aproximada.

## Matriz de contratos

| Status | Metodo | Rota | Query params | Body | Response esperada | Tela atual que consome | Observacoes |
|---|---|---|---|---|---|---|---|
| Confirmado | POST | `/auth/login` | none | `{ email: string; password: string }` | `{ accessToken: string; user: UserSummary }` | Nao consumido pelo React atual | Backend real existe; Angular deve usar este endpoint em vez do auth mock local |
| Confirmado | GET | `/auth/me` | none | none | usuario autenticado | Nao consumido pelo React atual | Requer `Authorization: Bearer <token>`; Angular deve validar sessao aqui |
| Confirmado | GET | `/dashboard/summary` | none | none | `DashboardSummary` | `/dashboard` | Contrato atual de dashboard/analytics; nao existe rota `/analytics` separada |
| Confirmado | GET | `/leads` | `city`, `uf`, `cnae`, `status`, `potentialLevel`, `minScore`, `maxScore`, `assignedToId`, `search` | none | `Lead[]` | `/leads-b2b`, `/regioes-prioritarias` | Backend retorna ate 250, ordenado por score desc e createdAt desc |
| Confirmado | GET | `/leads/:id` | none | none | `Lead` com `company`, `assignedTo`, `interactions` | `/leads-b2b/$leadId` | O detalhe tambem chama `/leads/:id/interactions`, gerando duplicacao conhecida |
| Confirmado | POST | `/leads` | none | `{ companyId: string }` no React atual | `Lead` | `/consulta-cnpj` | Backend aceita campos opcionais adicionais via `CreateLeadDto` |
| Confirmado | PATCH | `/leads/:id` | none | `UpdateLeadPayload` | `Lead` | `/leads-b2b/$leadId` | Usado para agendar proxima acao; tambem aceita status, score, responsavel e notas |
| Confirmado | POST | `/leads/:id/convert` | none | none | `Lead` | `/leads-b2b/$leadId` | Marca lead como `CONVERTED` e atualiza `lastContactAt` |
| Confirmado | POST | `/leads/:id/discard` | none | none | `Lead` | `/leads-b2b/$leadId` | Marca lead como `NOT_INTERESTED` e atualiza `lastContactAt` |
| Confirmado | GET | `/leads/:id/interactions` | none | none | `LeadInteraction[]` | `/leads-b2b/$leadId` | Historico de contato do lead |
| Confirmado | POST | `/leads/:id/interactions` | none | `{ userId: string; type: string; description: string }` | `LeadInteraction` | `/leads-b2b`, `/leads-b2b/$leadId` | UI atual bloqueia quando o lead nao tem `assignedToId` |
| Confirmado | GET | `/companies` | `city`, `uf`, `cnae`, `situacaoCadastral`, `search` | none | `Company[]` | `/base-de-dados` | Backend retorna ate 200 com `cnaes` e `lead` |
| Confirmado | GET | `/companies/:id` | none | none | `Company` | Nao identificado em tela principal | Service existe no React, mas o uso atual e baixo |
| Confirmado | POST | `/companies/sync/:cnpj` | none | none | `Company` | `/consulta-cnpj` | Busca no provider ativo e faz upsert |
| Confirmado | GET | `/cities` | none | none | `City[]` | `/importar-cnpjs`, `/base-de-dados` | Usado em combos e aba cidades |
| Confirmado | POST | `/cities` | none | `CreateCityDto` | `City` | Nao consumido pelo React atual | Endpoint administrativo futuro |
| Confirmado | PATCH | `/cities/:id` | none | `UpdateCityDto` | `City` | Nao consumido pelo React atual | Endpoint administrativo futuro |
| Confirmado | GET | `/cnaes` | none | none | `Cnae[]` | `/importar-cnpjs`, `/base-de-dados` | Usado em combo CNAE e aba CNAEs |
| Confirmado | POST | `/cnaes` | none | `CreateCnaeDto` | `Cnae` | Nao consumido pelo React atual | Endpoint administrativo futuro |
| Confirmado | PATCH | `/cnaes/:id` | none | `UpdateCnaeDto` | `Cnae` | Nao consumido pelo React atual | Endpoint administrativo futuro |
| Confirmado | GET | `/imports` | none | none | `ImportJob[]` | `/importar-cnpjs` | Historico recente, backend limita a 100 |
| Confirmado | GET | `/imports/:id` | none | none | `ImportJob` | Nao identificado em tela principal | Service existe no React |
| Confirmado | POST | `/imports/cnpj` | none | `ImportCnpjPayload` | `{ job: ImportJob; companies: Company[] }` | `/importar-cnpjs` | Escreve no banco; usa `ReceitaFederalProvider` e CSV real |
| Confirmado | GET | `/map/opportunities` | none | none | `MapOpportunity[]` | `/mapa-oportunidades` | Rota efetiva do mapa de oportunidades; `/mapa-de-calor` redireciona para esta tela |
| Confirmado | GET | `/pipeline` | none | none | `Pipeline` | `/funil-comercial` | Agrupa leads por status do funil |
| Confirmado | GET | `/users` | none | none | `UserSummary[]` | Nao consumido pelo React atual | Pode apoiar filtros/responsaveis no Angular futuro |
| Confirmado | GET | `/users/:id` | none | none | `UserSummary` | Nao consumido pelo React atual | Endpoint auxiliar |
| Pendente | GET | `/analytics` ou `/analytics/*` | indefinido | indefinido | indefinido | Nenhuma | Nao existe no backend atual; usar `/dashboard/summary` para dashboard/analytics ate nova decisao |

## Detalhes por dominio

### Auth

#### POST `/auth/login`

Body:

```json
{
  "email": "rafael.mendes@deusa.com.br",
  "password": "deusa123"
}
```

Response:

```ts
type AuthLoginResponse = {
  accessToken: string;
  user: UserSummary;
};
```

Status: Confirmado.

Observacoes:

- O backend valida senha com bcrypt e emite JWT.
- O React atual nao consome este endpoint.
- O Angular deve persistir o token e enviar `Authorization: Bearer <token>` via interceptor.

#### GET `/auth/me`

Headers:

```http
Authorization: Bearer <token>
```

Response:

```ts
type AuthMeResponse = UserSummary & {
  createdAt: string;
  updatedAt: string;
};
```

Status: Confirmado.

Observacoes:

- Protegido por `AuthGuard`.
- Deve ser usado pelo Angular para restaurar sessao e validar token.

### Dashboard / analytics

#### GET `/dashboard/summary`

Response:

```ts
type DashboardSummary = {
  potentialClients: number;
  activeClients: number;
  inactiveClients: number;
  criticalOpportunities: number;
  monitoredCities: number;
  monitoredCnaes: number;
  priorityCity: string | null;
  priorityCnae: string | null;
};
```

Status: Confirmado.

Tela atual:

- `/dashboard`
- `frontend/src/routes/_app/dashboard.tsx`

Observacoes:

- Este e o contrato atual para o dashboard Deusa Analytics.
- Nao existe rota `/analytics` ou controller `analytics` no backend atual.

### Leads

#### GET `/leads`

Query params:

```ts
type LeadQuery = {
  city?: string;
  uf?: string;
  cnae?: string;
  status?: LeadStatus;
  potentialLevel?: PotentialLevel;
  minScore?: number;
  maxScore?: number;
  assignedToId?: string;
  search?: string;
};
```

Response: `Lead[]`.

Status: Confirmado.

Telas atuais:

- `/leads-b2b`
- `/regioes-prioritarias`

Observacoes:

- A tela `/leads-b2b` ainda filtra localmente alguns campos de qualidade: `statusVerificacaoEndereco`, `pendenteValidacao`, `nivelOportunidade`, `situacaoCadastral`.
- Se a base crescer, esses filtros devem virar query params antes ou durante a migracao da tabela para Angular.

#### GET `/leads/:id`

Response: `Lead`.

Status: Confirmado.

Tela atual: `/leads-b2b/$leadId`.

Observacoes:

- Inclui `interactions`, mas o detalhe atual tambem chama `/leads/:id/interactions`.
- Antes de migrar a tela de detalhe, escolher se a chamada duplicada sera preservada ou simplificada.

#### POST `/leads`

Body atual do React:

```ts
{
  companyId: string;
}
```

Response: `Lead`.

Status: Confirmado.

Tela atual: `/consulta-cnpj`.

#### PATCH `/leads/:id`

Body:

```ts
type UpdateLeadPayload = Partial<{
  status: LeadStatus;
  score: number;
  potentialLevel: PotentialLevel;
  assignedToId: string;
  notes: string;
  lastContactAt: string;
  nextActionAt: string;
}>;
```

Response: `Lead`.

Status: Confirmado.

Tela atual: `/leads-b2b/$leadId`.

#### POST `/leads/:id/convert`

Body: vazio.

Response: `Lead`.

Status: Confirmado.

Tela atual: `/leads-b2b/$leadId`.

#### POST `/leads/:id/discard`

Body: vazio.

Response: `Lead`.

Status: Confirmado.

Tela atual: `/leads-b2b/$leadId`.

#### GET `/leads/:id/interactions`

Response: `LeadInteraction[]`.

Status: Confirmado.

Tela atual: `/leads-b2b/$leadId`.

#### POST `/leads/:id/interactions`

Body:

```ts
{
  userId: string;
  type: string;
  description: string;
}
```

Response: `LeadInteraction`.

Status: Confirmado.

Telas atuais:

- `/leads-b2b`
- `/leads-b2b/$leadId`

### Companies

#### GET `/companies`

Query params:

```ts
type CompanyQuery = {
  city?: string;
  uf?: string;
  cnae?: string;
  situacaoCadastral?: string;
  search?: string;
};
```

Response: `Company[]`.

Status: Confirmado.

Tela atual: `/base-de-dados`.

#### GET `/companies/:id`

Response: `Company`.

Status: Confirmado.

Tela atual: nao identificado em tela principal.

#### POST `/companies/sync/:cnpj`

Path param:

- `cnpj`: CNPJ com ou sem mascara. Backend normaliza antes de consultar o provider.

Body: vazio.

Response: `Company`.

Status: Confirmado.

Tela atual: `/consulta-cnpj`.

Observacoes:

- Usa `ReceitaFederalProvider`.
- Faz upsert de empresa.
- Retorna `404` quando o CNPJ nao existe no provider configurado.

### Imports

#### POST `/imports/cnpj`

Body:

```ts
type ImportCnpjPayload = {
  uf: string;
  cityName: string;
  cityIbgeCode?: string;
  cnaeCode: string;
  limit: number; // 1..5000
};
```

Response:

```ts
type ImportCnpjResponse = {
  job: ImportJob;
  companies: Company[];
};
```

Status: Confirmado.

Tela atual: `/importar-cnpjs`.

Observacoes:

- Este endpoint escreve no banco.
- Cria `ImportJob`.
- Busca dados reais no CSV `dadosCNAE/sp_4712100_estabelecimentos.csv` via `ReceitaFederalProvider`.
- Faz upsert de empresas e cria/atualiza leads.

#### GET `/imports`

Response: `ImportJob[]`.

Status: Confirmado.

Tela atual: `/importar-cnpjs`.

#### GET `/imports/:id`

Response: `ImportJob`.

Status: Confirmado.

Tela atual: nao identificado em tela principal.

### Mapa de oportunidades

#### GET `/map/opportunities`

Response:

```ts
type MapOpportunity = {
  id: string;
  companyName: string;
  cnpj: string;
  city: string;
  uf: string;
  bairro: string | null;
  latitude: number | null;
  longitude: number | null;
  score: number;
  status: LeadStatus;
  potentialLevel: PotentialLevel;
  origemCoordenada?: string | null;
  statusVerificacaoEndereco?: string | null;
  confiancaVerificacao?: number | null;
};
```

Status: Confirmado.

Tela atual:

- `/mapa-oportunidades`
- `/mapa-de-calor` redireciona para `/mapa-oportunidades`

Observacoes:

- Backend retorna apenas leads com `latitude` e `longitude`.
- O Angular deve preservar popup, marcador por score, filtros, top oportunidades e avisos de localizacao aproximada.

### Pipeline

#### GET `/pipeline`

Response:

```ts
type PipelineCard = {
  id: string;
  companyName: string;
  city: string;
  score: number;
  potentialLevel: PotentialLevel;
  assignedTo: string | null;
};

type Pipeline = {
  NEW: PipelineCard[];
  CONTACTED: PipelineCard[];
  INTERESTED: PipelineCard[];
  NEGOTIATION: PipelineCard[];
  CONVERTED: PipelineCard[];
};
```

Status: Confirmado.

Tela atual: `/funil-comercial`.

## Divergencias e pendencias antes do Angular

1. Divergencia documental corrigida em `backend/README.md`: o provider ativo nao e mock; e `ReceitaFederalProvider`.
2. Pendente: React ainda usa auth mock local, mas Angular deve usar auth real do backend.
3. Pendente: decidir se filtros de qualidade de leads continuam client-side ou sobem para `GET /leads`.
4. Pendente: decidir se o detalhe do lead usa uma ou duas chamadas para interacoes.
5. Pendente: criar e executar smoke tests de API antes de criar `frontend-angular/`.
