# Auditoria e Plano Seguro de Migracao React -> Angular + NestJS

Data da auditoria: 2026-07-05

Escopo: documentar o estado atual do projeto Deusa Analytics, mapear equivalencias para Angular e definir um plano incremental. Esta etapa nao implementa migracao, nao remove React, nao altera banco, nao altera dados da Receita Federal, nao altera dashboard, nao altera mapa e nao altera contratos de runtime.

## 1. Stack atual do front-end

- Aplicacao React gerada pelo Lovable em `frontend/`.
- React 19, React DOM 19 e TypeScript 5.8.
- Vite 7 com `@lovable.dev/vite-tanstack-config`.
- TanStack Start, TanStack Router file-based e TanStack React Query configurado no root.
- Tailwind CSS 4 via `@tailwindcss/vite` e `tw-animate-css`.
- Componentes UI no estilo shadcn/Radix em `frontend/src/components/ui`.
- Icones com `lucide-react`.
- Toasts com `sonner`.
- Mapa com `leaflet` e CSS de Leaflet.
- Graficos: `recharts` instalado e wrapper `components/ui/chart.tsx`, mas as telas principais auditadas usam mais cards/tabelas/mapa do que graficos Recharts.
- Scripts legados/auxiliares de dados em Node no `frontend/scripts/data` com `xlsx` e SQLite local em `frontend/data/deusa_analytics.db`.

## 2. Stack atual do back-end

- Backend ja esta em NestJS dentro de `backend/`.
- NestJS 11, TypeScript, `@nestjs/config`, `@nestjs/jwt`.
- PostgreSQL via Docker Compose na porta local `5435`.
- Prisma ORM 6.19 com migrations em `backend/prisma/migrations`.
- Validacao com `class-validator` e `class-transformer`.
- Autenticacao JWT implementada no backend (`/auth/login`, `/auth/me`), mas o front-end atual ainda usa uma sessao local mockada em `frontend/src/lib/auth.ts`.
- Provider ativo de CNPJ: `ReceitaFederalProvider`, injetado em `ImportsModule`.
- Providers placeholder: `MinhaReceitaProvider` e `DadosAbertosProvider`.
- Observacao: `backend/README.md` esta desatualizado ao dizer que o provider ativo e mock; o codigo atual usa `ReceitaFederalProvider`.

## 3. Estrutura de pastas

```text
.
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.ts
│   │   └── migrations/
│   ├── scripts/
│   │   └── generate-quality-report.ts
│   └── src/
│       ├── auth/
│       ├── cities/
│       ├── cnaes/
│       ├── common/
│       ├── companies/
│       ├── dashboard/
│       ├── imports/
│       ├── lead-interactions/
│       ├── leads/
│       ├── map-opportunities/
│       ├── pipeline/
│       ├── prisma/
│       └── users/
├── dadosCNAE/
│   ├── K3241.K03200Y1.D60613.ESTABELE
│   ├── sp_4712100_estabelecimentos.csv
│   ├── filter_cnpjs.py
│   ├── analysis_quality_report.md
│   └── leads_para_validacao_manual.csv
├── frontend/
│   ├── data/
│   ├── scripts/data/
│   └── src/
│       ├── components/app/
│       ├── components/ui/
│       ├── hooks/
│       ├── lib/
│       ├── routes/
│       ├── services/
│       └── types/
└── docs/
```

## 4. Rotas existentes no front-end

As rotas sao definidas por arquivos em `frontend/src/routes` e geradas em `frontend/src/routeTree.gen.ts`.

| Rota | Arquivo | Status atual |
|---|---|---|
| `/` | `routes/index.tsx` | Redireciona para `/dashboard` se autenticado ou `/login` se nao autenticado |
| `/login` | `routes/login.tsx` | Login visual com AuthService local/mock |
| `/_app` | `routes/_app.tsx` | Layout protegido com sidebar, topbar e outlet |
| `/dashboard` | `routes/_app/dashboard.tsx` | Central Comercial |
| `/leads-b2b` | `routes/_app/leads-b2b.tsx` | Tabela de leads, filtros e acoes |
| `/leads-b2b/$leadId` | `routes/_app/leads-b2b/$leadId.tsx` | Detalhe do lead |
| `/mapa-oportunidades` | `routes/_app/mapa-oportunidades.tsx` | Mapa efetivo em Leaflet |
| `/mapa-de-calor` | `routes/_app/mapa-de-calor.tsx` | Redireciona para `/mapa-oportunidades` |
| `/importar-cnpjs` | `routes/_app/importar-cnpjs.tsx` | Importacao de CNPJs por cidade/CNAE |
| `/funil-comercial` | `routes/_app/funil-comercial.tsx` | Kanban/funil comercial |
| `/base-de-dados` | `routes/_app/base-de-dados.tsx` | Consulta empresas, cidades e CNAEs |
| `/consulta-cnpj` | `routes/_app/consulta-cnpj.tsx` | Consulta/enriquecimento por CNPJ |
| `/regioes-prioritarias` | `routes/_app/regioes-prioritarias.tsx` | Ranking por cidade derivado de leads |
| `/recomendacoes` | `routes/_app/recomendacoes.tsx` | Tela preservada, temporariamente fora do fluxo principal |
| `/rotas-inteligentes` | `routes/_app/rotas-inteligentes.tsx` | Placeholder de funcionalidade futura |
| `/estabelecimentos` | `routes/_app/estabelecimentos.tsx` | Redireciona para `/leads-b2b` |
| `/configuracoes` | `routes/_app/configuracoes.tsx` | Cards de configuracoes/governanca |

## 5. Paginas principais

- Central Comercial: KPIs, prioridade da semana e acoes recomendadas.
- Leads B2B: filtros, tabela paginada client-side, badges de qualidade, contato rapido.
- Detalhe do lead: dados cadastrais, comerciais, historico, qualidade e acoes de status.
- Mapa: visualizacao territorial de oportunidades com marcadores por score.
- Importar CNPJs: formulario cidade/CNAE/limite, execucao de importacao e historico recente.
- Funil Comercial: colunas por status de lead.
- Base de Dados: abas de empresas, cidades e CNAEs.
- Consulta CNPJ: busca provider por CNPJ e criacao de lead.
- Regioes Prioritarias: agrupamento local por cidade a partir de leads.

## 6. Componentes React principais

- `Sidebar`: navegacao principal e identidade Deusa Analytics.
- `Topbar`: busca visual, notificacoes estaticas, menu de usuario e logout.
- `PageHeader`: cabecalho padrao das telas internas.
- `InterfaceStates`: loading, empty, error e skeletons.
- `QualityBadges`: situacao cadastral, oportunidade, verificacao de endereco, confianca, pendencia e aviso de localizacao aproximada.
- `PriorityBadge`: prioridade regional.
- `Logo`: logo da Deusa.
- `components/ui/*`: biblioteca local baseada em Radix/shadcn.

## 7. Servicos de API existentes no front-end

Todos usam `apiRequest` em `frontend/src/services/api.ts`, com `VITE_API_URL` ou fallback `http://127.0.0.1:3001`.

- `dashboardService`: `GET /dashboard/summary`
- `leadsService`: `GET /leads`, `GET /leads/:id`, `PATCH /leads/:id`, `POST /leads`, `POST /leads/:id/convert`, `POST /leads/:id/discard`, interacoes.
- `companiesService`: `GET /companies`, `GET /companies/:id`, `POST /companies/sync/:cnpj`.
- `importsService`: `POST /imports/cnpj`, `GET /imports`, `GET /imports/:id`.
- `mapService`: `GET /map/opportunities`.
- `pipelineService`: `GET /pipeline`.
- `citiesService`: `GET /cities`.
- `cnaesService`: `GET /cnaes`.

## 8. Hooks, contextos e estado global

- `use-mobile.tsx`: hook de viewport.
- `QueryClientProvider` no root, mas as paginas principais carregam dados com `useState`, `useEffect` e services diretos.
- Contextos internos existem nos componentes UI (`form`, `chart`, `sidebar`, `carousel`, `toggle-group`), nao como dominio global da aplicacao.
- Auth no front e local: `AuthService` grava `deusa_auth_token` e `deusa_user_data` no `localStorage`.
- Nao ha Redux, Zustand ou contexto global de dominio.

## 9. Bibliotecas de UI usadas

- Radix UI para primitives.
- Tailwind CSS 4.
- `class-variance-authority`, `clsx`, `tailwind-merge`.
- `lucide-react`.
- `sonner`.
- Componentes shadcn-like em `frontend/src/components/ui`.

## 10. Bibliotecas de mapa usadas

- `leaflet`.
- Tiles do OpenStreetMap via `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`.
- CSS customizado em `frontend/src/styles.css`: `deusa-score-marker`, `deusa-map-popup`, estilos antigos de heatmap/cluster.

## 11. Bibliotecas de graficos usadas

- `recharts` esta instalado.
- `components/ui/chart.tsx` encapsula `ResponsiveContainer`, tooltip, legenda e estilos.
- As telas centrais auditadas nao dependem de grafico Recharts para funcionar; usam cards, tabelas, funil e mapa.

## 12. Como o dashboard Deusa Analytics esta estruturado

- Arquivo principal: `frontend/src/routes/_app/dashboard.tsx`.
- Consome `dashboardService.getSummary()`.
- Response esperada: `DashboardSummary`.
- Estrutura visual:
  - `PageHeader` com acoes para importar CNPJs e ver leads.
  - Quatro cards: potenciais clientes, clientes ativos, clientes inativos, oportunidades criticas.
  - Secao "Prioridade da semana" com cidade foco, CNAE foco, oportunidades e proxima acao.
  - Secao "Acoes recomendadas" fixa no front.
- Backend correspondente: `DashboardController` e `DashboardService`, agregando contagens por Prisma.

## 13. Como o mapa de calor/mapa funciona hoje

- A rota historica `/mapa-de-calor` redireciona para `/mapa-oportunidades`.
- Implementacao efetiva: `frontend/src/routes/_app/mapa-oportunidades.tsx`.
- Consome `GET /map/opportunities`.
- Inicializa Leaflet dinamicamente no client (`await import("leaflet")`).
- Cria camada de marcadores com `L.layerGroup()`.
- Cada ponto usa `L.divIcon` com score no marcador.
- Cor do marcador vem da categoria derivada do status:
  - `CONVERTED` => cliente.
  - `NOT_INTERESTED` ou `INACTIVE` => nao cliente.
  - demais status => potencial cliente.
- Filtros atuais: cidade e categoria.
- Popup mostra empresa, CNPJ, cidade/UF, bairro, score e categoria.
- Quando `origemCoordenada` contem `centroide` ou `jitter`, o marcador usa borda tracejada e o popup mostra aviso de localizacao aproximada.
- Ha banner quando mais de 80% dos pontos filtrados usam coordenadas aproximadas.
- Pontos sem latitude/longitude nao sao exibidos e geram alerta.

## 14. Como a tabela de leads funciona hoje

- Arquivo principal: `frontend/src/routes/_app/leads-b2b.tsx`.
- Consome `GET /leads` com filtros de backend para busca, cidade, CNAE, status comercial, potencial e responsavel.
- Aplica filtros adicionais no client para:
  - `statusVerificacaoEndereco`
  - `pendenteValidacao`
  - `nivelOportunidade`
  - `situacaoCadastral`
- Mantem `referenceLeads` para popular opcoes de filtro quando a lista filtrada muda.
- Paginacao e feita no client com `PAGE_SIZE = 10`.
- A tabela exibe empresa, cidade/situacao, CNAE, status comercial, score/oportunidade, confianca/verificacao, responsavel e acoes.
- A acao "Contato" cria interacao via `POST /leads/:id/interactions`.
- A acao "Ver" navega para `/leads-b2b/$leadId`.

## 15. Como os dados reais da Receita Federal entram no sistema

- Arquivo bruto grande em `dadosCNAE/K3241.K03200Y1.D60613.ESTABELE`.
- Script `dadosCNAE/filter_cnpjs.py` filtra registros de SP com CNAE `4712100`.
- CSV filtrado: `dadosCNAE/sp_4712100_estabelecimentos.csv`.
- Backend usa `ReceitaFederalProvider`, que le o CSV real, cria cache em memoria indexado por codigo TOM e mapeia linhas para `ExternalCompany`.
- `ImportsService.importCnpj()` cria `ImportJob`, chama o provider, faz `upsertCompany` e cria/atualiza lead via `upsertLeadForCompany`.
- A Receita Federal nao fornece latitude/longitude no CSV ESTABELE. O sistema gera coordenadas aproximadas por centroide municipal + jitter deterministico por CNPJ.
- A origem dessas coordenadas e marcada como `municipio_centroide_jitter`, e o status deve ser tratado como aproximado, nunca como endereco fisico real.
- Qualidade cadastral e pontuacao sao calculadas em `backend/src/common/cadastral-quality.ts`.

## 16. Arquivos CSV, providers, scripts e relatorios

- CSVs/dados:
  - `dadosCNAE/K3241.K03200Y1.D60613.ESTABELE`
  - `dadosCNAE/sp_4712100_estabelecimentos.csv`
  - `dadosCNAE/leads_para_validacao_manual.csv`
  - `frontend/data/deusa_analytics.db`
  - `frontend/data/processed/import-report.json`
  - `frontend/data/processed/comparison-report.json`
- Providers:
  - `backend/src/imports/providers/receita-federal.provider.ts`
  - `backend/src/imports/providers/minha-receita.provider.ts`
  - `backend/src/imports/providers/dados-abertos.provider.ts`
  - `backend/src/imports/providers/cnpj-provider.interface.ts`
- Scripts:
  - `dadosCNAE/filter_cnpjs.py`
  - `backend/scripts/generate-quality-report.ts`
  - `frontend/scripts/data/import-data.js`
  - `frontend/scripts/data/compare-data.js`
  - `frontend/scripts/data/prepare-data.js`
- Relatorios:
  - `dadosCNAE/analysis_quality_report.md`
  - `dadosCNAE/leads_para_validacao_manual.csv`

## 17. Funcionalidades criticas que nao podem quebrar

- Dashboard/Central Comercial com dados reais do backend.
- Importacao de CNPJs por cidade/CNAE e historico de importacoes.
- Leitura do CSV real da Receita Federal.
- Criacao/upsert de empresas e leads.
- Campos de qualidade cadastral.
- Pontuacao de oportunidade e status comercial.
- Tabela de leads e filtros.
- Detalhe do lead, historico de interacoes e acoes de converter/descartar/agendar.
- Mapa com aviso de coordenadas aproximadas.
- Banco PostgreSQL, Prisma schema e migrations.
- CSVs, relatorios e scripts de qualidade.
- Contratos de API ja consumidos pelo React.

## 18. Arquivos que devem ser preservados

- `frontend/src/routes/_app/dashboard.tsx`
- `frontend/src/routes/_app/leads-b2b.tsx`
- `frontend/src/routes/_app/leads-b2b/$leadId.tsx`
- `frontend/src/routes/_app/mapa-oportunidades.tsx`
- `frontend/src/routes/_app/importar-cnpjs.tsx`
- `frontend/src/routes/_app/base-de-dados.tsx`
- `frontend/src/routes/_app/funil-comercial.tsx`
- `frontend/src/services/*`
- `frontend/src/types/*`
- `frontend/src/components/app/*`
- `frontend/src/styles.css`
- `backend/src/**/*`
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/**/*`
- `backend/prisma/seed.ts`
- `backend/scripts/generate-quality-report.ts`
- `dadosCNAE/**/*`
- `docker-compose.yml`

## 19. Riscos de migrar para Angular

- Risco de regressao visual ao tentar recriar o design Lovable sem tokens/componentes equivalentes.
- Risco de quebrar a integracao real ao copiar dados mockados ou placeholders para Angular.
- Risco de perder semantica critica de coordenada aproximada no mapa.
- Risco de mudar nomes de campos usados pelo Prisma/front (`cidade`, `cnaePrincipal`, `origemCoordenada`, `statusVerificacaoEndereco`, `confiancaVerificacao`, `nivelOportunidade`).
- Risco de reimplementar filtros de leads de forma diferente entre backend e client.
- Risco de duplicar regras de score no front, quando a regra deve permanecer no backend.
- Risco de autenticar Angular contra mock local e ignorar JWT ja existente no backend.
- Risco de tentar substituir o backend apesar de ele ja estar em NestJS.
- Risco de apagar rotas legadas/redirecionamentos que preservam navegacao atual.
- Risco operacional do CSV grande e cache em memoria no backend.
- Risco de documentacao divergente: `backend/README.md` ainda fala em provider mock, mas o codigo injeta `ReceitaFederalProvider`.

## 20. Mapa de equivalencia React -> Angular

| React atual | Funcao | Dependencias | Dados consumidos | Angular equivalente | Dificuldade | Risco |
|---|---|---|---|---|---|---|
| `routes/_app.tsx` | Layout protegido | TanStack Router, `AuthService`, `Sidebar`, `Topbar` | localStorage auth | `AppShellComponent` + `RouterOutlet` + `AuthGuard` | Media | Alto: auth mock vs JWT real |
| `routes/login.tsx` | Login visual | AuthService local, lucide | email/senha local | `LoginComponent` + `AuthService.login()` HTTP | Media | Alto se copiar mock local |
| `Sidebar` | Navegacao lateral | TanStack Link, lucide | pathname | `SidebarComponent` + `RouterLinkActive` | Baixa | Baixo |
| `Topbar` | Busca, notificacoes, usuario | AuthService, Radix dropdown, sonner | user local | `TopbarComponent` + Angular Material/CDK ou componentes proprios | Media | Medio: notificacoes estaticas |
| `PageHeader` | Cabecalho padrao | props React | titulo/subtitulo/acoes | `PageHeaderComponent` com content projection | Baixa | Baixo |
| `InterfaceStates` | Loading/error/empty/skeleton | CSS/Tailwind | mensagens | `LoadingStateComponent`, `ErrorStateComponent`, `EmptyStateComponent` | Baixa | Baixo |
| `QualityBadges` | Badges de qualidade | lucide, campos company | situacao, confianca, verificacao, pendencia | `quality-badges` standalone components/pipes | Media | Alto: nao perder avisos de localizacao aproximada |
| `dashboard.tsx` | Central Comercial | dashboardService, PageHeader | `DashboardSummary` | `DashboardPageComponent` + `DashboardApiService` | Media | Medio: preservar indicadores |
| `leads-b2b.tsx` | Tabela, filtros, paginacao | leadsService, QualityBadges, sonner | `Lead[]` e filtros | `LeadsListPageComponent` + reactive forms + table component | Alta | Alto: filtros mistos backend/client |
| `leads-b2b/$leadId.tsx` | Detalhe e acoes | leadsService, QualityBadges | `Lead`, `LeadInteraction[]` | `LeadDetailPageComponent` | Alta | Alto: acoes alteram dados |
| `mapa-oportunidades.tsx` | Mapa Leaflet | Leaflet, OpenStreetMap, mapService | `MapOpportunity[]` | `OpportunityMapPageComponent` + `LeafletMapComponent` | Alta | Alto: mapa, cleanup, popups e aproximacao |
| `mapa-de-calor.tsx` | Redirecionamento legado | TanStack redirect | none | route redirect Angular | Baixa | Baixo |
| `importar-cnpjs.tsx` | Importacao Receita | imports, cities, cnaes services | `City[]`, `Cnae[]`, `ImportJob[]`, `Company[]` | `ImportCnpjsPageComponent` + reactive form | Alta | Alto: dispara importacao real |
| `base-de-dados.tsx` | Consulta tabulada | companies/cities/cnaes services | empresas, cidades, CNAEs | `DatabasePageComponent` + tabs/table | Media | Medio |
| `funil-comercial.tsx` | Funil por status | pipelineService | `Pipeline` | `CommercialFunnelPageComponent` | Media | Medio |
| `consulta-cnpj.tsx` | Sync CNPJ e cria lead | companiesService, leadsService | `Company`, `Lead` | `CnpjLookupPageComponent` | Alta | Alto: provider real e criacao de lead |
| `regioes-prioritarias.tsx` | Ranking local por cidade | leadsService | `Lead[]` | `PriorityRegionsPageComponent` | Media | Medio: regra local deve ser preservada/documentada |
| `recomendacoes.tsx` | Tela preservada fora do MVP | dados estaticos | arrays locais | `RecommendationsPageComponent` ou manter backlog | Baixa | Medio: usa mock/placeholder |
| `rotas-inteligentes.tsx` | Placeholder de rotas | Link | none | `RoutesPlaceholderComponent` | Baixa | Baixo |
| `configuracoes.tsx` | Cards de configuracao | lucide | arrays locais | `SettingsPageComponent` | Baixa | Baixo |
| `api.ts` | Cliente HTTP | fetch, env | JSON API | `ApiHttpService` + interceptors | Media | Alto: headers/auth/error handling |
| `commercial-formatters.ts` | Formatadores | Intl | CNPJ/CNAE/datas/status | pipes Angular (`cnpj`, `cnae`, `dateTime`) | Baixa | Medio |
| `types/*` | Contratos TS do front | TypeScript | DTOs atuais | `core/models/*.model.ts` | Media | Alto se divergir do backend |

## 21. Contratos de API

Os contratos detalhados foram separados em `docs/api-contracts.md`. Essa documentacao deve virar a fonte de verdade antes de criar o Angular paralelo.

## 22. Plano incremental de migracao

### Fase 1 - Auditoria e documentacao

- Congelar este inventario.
- Validar com o usuario quais telas entram no MVP Angular inicial.
- Documentar divergencias encontradas, especialmente auth mock no front e README desatualizado sobre provider.

### Fase 2 - Congelamento dos contratos de API

- Revisar e aprovar `docs/api-contracts.md`.
- Garantir que os campos de qualidade e coordenadas aproximadas estao explicitamente contratados.
- Definir se Angular usara JWT real do backend desde o inicio.
- Adicionar testes/smoke de contrato antes de migrar telas.

### Fase 3 - Criacao de Angular paralelo sem apagar React

- Criar um app Angular em pasta separada, por exemplo `frontend-angular/`.
- Manter React em `frontend/` intacto.
- Configurar proxy/env para o mesmo backend.
- Nao compartilhar build ou deploy ate existir paridade minima.

### Fase 4 - Migracao do layout base

- Criar shell Angular com sidebar, topbar, header, estados comuns e tokens visuais.
- Recriar rotas e redirects sem telas de dados primeiro.
- Implementar auth guard alinhado com decisao da Fase 2.

### Fase 5 - Migracao dos componentes compartilhados

- Migrar `PageHeader`, estados, badges, pipes de formatacao, botao/link padrao, tabela base e cards.
- Criar modelos TypeScript espelhando `frontend/src/types`.
- Criar `ApiHttpService` e services por dominio.

### Fase 6 - Migracao do dashboard

- Implementar Central Comercial consumindo `GET /dashboard/summary`.
- Comparar valores com React usando o mesmo backend.
- Validar estados loading/error/empty.

### Fase 7 - Migracao da tabela de leads e filtros

- Implementar `LeadsListPageComponent`.
- Preservar filtros backend e filtros client-side.
- Conferir paginacao, badges, contato rapido e link de detalhe.

### Fase 8 - Migracao do mapa de calor/mapa

- Implementar Leaflet em Angular com lifecycle correto.
- Preservar filtros, popup, top oportunidades, banners e avisos de localizacao aproximada.
- Validar que coordenada aproximada nunca aparece como endereco real.

### Fase 9 - Migracao do detalhe do lead

- Migrar dados cadastrais/comerciais, historico, qualidade e acoes.
- Validar `PATCH`, `POST convert`, `POST discard` e `POST interactions`.

### Fase 10 - Integracao com backend/NestJS

- Como o backend ja e NestJS, nao recriar.
- Organizar somente se necessario: docs, DTOs, testes, OpenAPI/Swagger e guards.
- Avaliar provider/csv/cache sem alterar banco nesta fase.

### Fase 11 - Comparacao React vs Angular

- Rodar React e Angular em paralelo contra o mesmo backend.
- Comparar dashboard, leads, mapa, importacao, detalhe e funil.
- Criar checklist de paridade por rota, contrato e estado de erro.

### Fase 12 - Remocao do React somente depois da validacao

- Remover React apenas depois de build Angular aprovado, rotas equivalentes, contratos congelados e aceite visual/funcional.
- Manter backup/branch/tag antes do corte.
- Atualizar docs, scripts e deploy.

## 23. Recomendacao tecnica

Opcao recomendada: C) criar Angular em paralelo e migrar tela por tela.

Motivo: o projeto ja tem valor funcional real no React: dashboard, leads, mapa, importacao real da Receita Federal, qualidade cadastral e backend NestJS/Prisma em andamento. Migrar tudo agora aumenta muito o risco de perder regra de negocio e reintroduzir mocks. Manter apenas React tambem nao atende ao objetivo de manutencao futura em Angular. Separar NestJS primeiro nao e o melhor caminho principal porque o backend ja esta em NestJS; o trabalho de backend agora deve ser organizacao, contratos e testes, nao recriacao.

Ranking para este projeto:

1. C) Angular paralelo e migracao tela por tela - melhor equilibrio entre seguranca e objetivo futuro.
2. D) endurecer NestJS/contratos antes ou junto da primeira tela Angular - bom como complemento, nao como substituicao do plano.
3. B) manter React e organizar melhor - aceitavel temporariamente, mas nao resolve a preferencia de manutencao.
4. A) migrar tudo agora - nao recomendado; alto risco de regressao.

## 24. Primeira etapa segura

Primeiro passo seguro: aprovar e congelar `docs/api-contracts.md`, corrigindo apenas documentacao divergente se necessario, e criar uma checklist de smoke tests de contrato para os endpoints que o React ja consome. So depois disso criar o Angular paralelo.

Esse passo nao mexe no dashboard, mapa, tabela, CSV, banco ou backend de runtime, mas reduz o maior risco da migracao: o Angular nascer consumindo contratos diferentes do React atual.

## 25. Arquivos recomendados para criar na proxima etapa

- `docs/api-contracts.md` - ja criado nesta auditoria.
- `docs/react-angular-nest-migration-audit.md` - este documento.
- `docs/migration-checklist.md` - checklist operacional por rota, contrato e evidencia de paridade.
- `docs/angular-architecture.md` - arquitetura alvo do app Angular paralelo.
- `docs/api-smoke-tests.md` - comandos/criterios de validacao dos endpoints antes de migrar cada tela.
- Futuro, somente apos aprovacao: `frontend-angular/` como projeto Angular paralelo.
