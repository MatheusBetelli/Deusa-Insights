# Arquitetura Planejada para o Frontend Angular

Data de criacao: 2026-07-05

Este documento planeja o futuro `frontend-angular/`. Ele nao cria o projeto Angular nem autoriza remover o React atual. O objetivo e orientar a implementacao quando a fase de contratos e smoke tests estiver aprovada.

## Principios

- Criar Angular em paralelo, sem apagar `frontend/`.
- Consumir os mesmos contratos documentados em `docs/api-contracts.md`.
- Usar backend real para autenticacao.
- Nao reimplementar regras de score, qualidade cadastral ou importacao no frontend.
- Preservar o aviso de que coordenadas por centroide/jitter sao aproximadas.
- Migrar tela por tela, comparando com React contra o mesmo backend.

## Estrutura sugerida

```text
frontend-angular/
  src/
    app/
      app.config.ts
      app.routes.ts
      core/
        services/
          api.service.ts
          auth.service.ts
          dashboard-api.service.ts
          leads-api.service.ts
          companies-api.service.ts
          imports-api.service.ts
          map-opportunities-api.service.ts
          pipeline-api.service.ts
          cities-api.service.ts
          cnaes-api.service.ts
        models/
          auth.model.ts
          city.model.ts
          cnae.model.ts
          company.model.ts
          dashboard.model.ts
          import-job.model.ts
          lead.model.ts
          map-opportunity.model.ts
          pipeline.model.ts
        interceptors/
          auth-token.interceptor.ts
          api-error.interceptor.ts
        guards/
          auth.guard.ts
          guest.guard.ts
      shared/
        components/
          app-shell/
          sidebar/
          topbar/
          page-header/
          loading-state/
          empty-state/
          error-state/
          quality-badges/
          priority-badge/
          data-table/
        pipes/
          cnpj.pipe.ts
          cnae.pipe.ts
          date-time.pipe.ts
          lead-status-label.pipe.ts
          potential-level-label.pipe.ts
        utils/
          commercial-formatters.ts
          route-links.ts
      features/
        auth/
          login.page.ts
        dashboard/
          dashboard.page.ts
        leads/
          leads-list.page.ts
          lead-detail.page.ts
        map-opportunities/
          map-opportunities.page.ts
          leaflet-map.component.ts
        imports/
          import-cnpjs.page.ts
        analytics/
          commercial-funnel.page.ts
          database.page.ts
          priority-regions.page.ts
        settings/
          settings.page.ts
```

## Core

### Services

`ApiService`

- Encapsula `HttpClient`.
- Usa `environment.apiUrl`.
- Centraliza montagem de query params.
- Retorna tipos dos models em `core/models`.

Services por dominio:

- `AuthService`: `POST /auth/login`, `GET /auth/me`, logout, estado de usuario.
- `DashboardApiService`: `GET /dashboard/summary`.
- `LeadsApiService`: endpoints `/leads`.
- `CompaniesApiService`: endpoints `/companies`.
- `ImportsApiService`: endpoints `/imports`.
- `MapOpportunitiesApiService`: `GET /map/opportunities`.
- `PipelineApiService`: `GET /pipeline`.
- `CitiesApiService`: `GET /cities`.
- `CnaesApiService`: `GET /cnaes`.

Regra:

- Services Angular nao devem mudar nomes de campos.
- Se for necessario adaptar algo para UI, fazer em camada local da feature e manter model de API intacto.

### Models/interfaces

Os models devem espelhar os tipos atuais de `frontend/src/types`:

- `AuthLoginResponse`
- `UserSummary`
- `City`
- `Cnae`
- `Company`
- `CompanyCnae`
- `DashboardSummary`
- `ImportJob`
- `ImportCnpjPayload`
- `ImportCnpjResponse`
- `Lead`
- `LeadInteraction`
- `LeadQuery`
- `UpdateLeadPayload`
- `CreateLeadInteractionPayload`
- `MapOpportunity`
- `Pipeline`
- `PipelineCard`

Campos criticos que nao podem ser omitidos:

- `origemCoordenada`
- `statusVerificacaoEndereco`
- `confiancaVerificacao`
- `pendenteValidacao`
- `motivosPendencia`
- `pontuacaoOportunidade`
- `nivelOportunidade`
- `motivoPontuacao`

### Guards

`AuthGuard`

- Bloqueia rotas internas quando nao houver token valido.
- Pode chamar `/auth/me` na restauracao de sessao.

`GuestGuard`

- Redireciona usuario autenticado de `/login` para `/dashboard`.

### Interceptors

`auth-token.interceptor.ts`

- Lê token persistido pelo `AuthService`.
- Adiciona `Authorization: Bearer <token>` nas chamadas para a API.

`api-error.interceptor.ts`

- Normaliza erros HTTP para mensagem de UI.
- Preserva mensagens do backend quando o payload tiver `message`.
- Deve diferenciar `401` para logout/redirecionamento.

## Shared

Componentes compartilhados esperados:

- `AppShellComponent`: layout com sidebar, topbar e `router-outlet`.
- `SidebarComponent`: menu interno equivalente ao React.
- `TopbarComponent`: busca, dados do usuario e logout.
- `PageHeaderComponent`: titulo, subtitulo e area de acoes via content projection.
- `LoadingStateComponent`, `EmptyStateComponent`, `ErrorStateComponent`.
- `QualityBadgesComponent` ou conjunto de componentes:
  - situacao cadastral;
  - nivel de oportunidade;
  - status de verificacao de endereco;
  - confianca cadastral;
  - pendente de validacao;
  - aviso de localizacao aproximada.
- `PriorityBadgeComponent`.
- `DataTableComponent` somente se reduzir repeticao real; nao criar abstracao pesada antes de migrar a tabela de leads.

Pipes:

- `cnpj`
- `cnae`
- `dateTime`
- `leadStatusLabel`
- `potentialLevelLabel`

## Features

### Auth

Rota:

- `/login`

Responsabilidades:

- Login real via `POST /auth/login`.
- Persistir token.
- Redirecionar para `/dashboard`.
- Nao copiar o mock atual de `frontend/src/lib/auth.ts`.

### Dashboard

Rota:

- `/dashboard`

Contrato:

- `GET /dashboard/summary`

Responsabilidades:

- Cards de indicadores.
- Prioridade da semana.
- Acoes para importar CNPJs e ver leads.

### Leads

Rotas:

- `/leads-b2b`
- `/leads-b2b/:leadId`

Contratos:

- `GET /leads`
- `GET /leads/:id`
- `PATCH /leads/:id`
- `POST /leads/:id/convert`
- `POST /leads/:id/discard`
- `GET /leads/:id/interactions`
- `POST /leads/:id/interactions`

Responsabilidades:

- Tabela de leads.
- Filtros backend e filtros client-side de qualidade.
- Paginacao.
- Badges.
- Acoes de contato, proxima acao, converter e descartar.

### Map opportunities

Rotas:

- `/mapa-oportunidades`
- `/mapa-de-calor` como redirect para `/mapa-oportunidades`

Contrato:

- `GET /map/opportunities`

Responsabilidades:

- Mapa Leaflet.
- Filtros de cidade e categoria.
- Top oportunidades.
- Popup com detalhes.
- Avisos de localizacao aproximada.

### Imports

Rota:

- `/importar-cnpjs`

Contratos:

- `GET /cities`
- `GET /cnaes`
- `GET /imports`
- `POST /imports/cnpj`

Responsabilidades:

- Formulario de importacao.
- Historico recente.
- Resultado da importacao.
- Chamar endpoint real com limite controlado.

### Analytics

Rotas agrupadas sugeridas:

- `/funil-comercial`
- `/base-de-dados`
- `/regioes-prioritarias`

Contratos:

- `GET /pipeline`
- `GET /companies`
- `GET /cities`
- `GET /cnaes`
- `GET /leads`

Observacao:

- Nao existe backend `/analytics` hoje. O nome da feature Angular pode ser organizacional, mas os contratos reais continuam sendo os endpoints documentados.

## Rotas Angular sugeridas

```ts
export const routes: Routes = [
  { path: "", pathMatch: "full", redirectTo: "dashboard" },
  { path: "login", canActivate: [GuestGuard], component: LoginPage },
  {
    path: "",
    canActivate: [AuthGuard],
    component: AppShellComponent,
    children: [
      { path: "dashboard", component: DashboardPage },
      { path: "leads-b2b", component: LeadsListPage },
      { path: "leads-b2b/:leadId", component: LeadDetailPage },
      { path: "mapa-oportunidades", component: MapOpportunitiesPage },
      { path: "mapa-de-calor", redirectTo: "mapa-oportunidades" },
      { path: "importar-cnpjs", component: ImportCnpjsPage },
      { path: "funil-comercial", component: CommercialFunnelPage },
      { path: "base-de-dados", component: DatabasePage },
      { path: "regioes-prioritarias", component: PriorityRegionsPage },
      { path: "configuracoes", component: SettingsPage },
    ],
  },
  { path: "**", redirectTo: "dashboard" },
];
```

## Estrategia para Leaflet no Angular

- Importar Leaflet apenas no browser, dentro do componente de mapa.
- Inicializar mapa em `ngAfterViewInit`.
- Remover mapa em `ngOnDestroy` para evitar vazamento de listeners.
- Usar `ViewChild` para o container.
- Manter uma `LayerGroup` para marcadores.
- Recriar marcadores quando filtros ou dados mudarem.
- Preservar estilos de marcador do React em CSS global ou stylesheet do componente.
- Nunca usar coordenada aproximada como endereco real.

Campos obrigatorios para renderizacao segura:

- `latitude`
- `longitude`
- `score`
- `status`
- `origemCoordenada`
- `statusVerificacaoEndereco`
- `confiancaVerificacao`

## Estrategia para autenticacao real

- Login chama `POST /auth/login`.
- Token armazenado pelo `AuthService`.
- Interceptor adiciona bearer token.
- `AuthGuard` bloqueia rotas internas.
- `GET /auth/me` restaura usuario ao recarregar pagina.
- `401` limpa sessao e redireciona para `/login`.
- Nao migrar o mock local do React.

## Estrategia para consumir os mesmos contratos

- Gerar models manualmente a partir de `docs/api-contracts.md` no inicio.
- Evitar renomear campos para camelCase diferente do backend; os campos ja estao em camelCase/portugues conforme contrato.
- Manter services Angular 1:1 com services React atuais.
- Criar testes simples de service para garantir rota, metodo e query params.
- Rodar `docs/api-smoke-tests.md` antes de migrar cada feature com escrita.
- Comparar React vs Angular usando o mesmo backend e o mesmo banco local/teste.

## Ordem recomendada de implementacao futura

1. Auth real.
2. Shell/layout.
3. Dashboard.
4. Leads list.
5. Lead detail.
6. Imports.
7. Map opportunities.
8. Pipeline/base/regioes.
9. Comparacao final.
10. Corte final somente depois de aceite.
