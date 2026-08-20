# Checklist de Migracao React -> Angular

Data de criacao: 2026-07-05

Este checklist controla a migracao incremental. O status inicial de todas as fases e `Pendente`. Nenhuma fase autoriza remover React ate a fase de corte final estar validada.

## Fase 1 - Contratos congelados

Status: Pendente

Objetivo:

- Aprovar `docs/api-contracts.md` como fonte de verdade.
- Registrar endpoints confirmados, pendentes e divergentes.
- Garantir que auth, dashboard, leads, companies, imports e mapa estejam cobertos.

Criterios de aceite:

- `docs/api-contracts.md` revisado e aprovado.
- Nenhum endpoint critico sem status.
- Rota `/analytics` tratada como inexistente; contrato atual confirmado em `/dashboard/summary`.
- Campos `origemCoordenada` e `statusVerificacaoEndereco` documentados.

Risco:

- Alto se o Angular for criado consumindo contratos diferentes do React atual.

Comando de verificacao:

```bash
rg -n "Confirmado|Pendente|Divergente|/dashboard/summary|/map/opportunities|origemCoordenada" docs/api-contracts.md
```

## Fase 2 - Smoke tests da API

Status: Pendente

Objetivo:

- Executar a checklist manual de `docs/api-smoke-tests.md`.
- Confirmar que endpoints principais respondem antes de criar Angular.

Criterios de aceite:

- Login real retorna token.
- `/auth/me` valida token.
- `GET /leads`, `GET /companies`, `GET /imports`, `GET /map/opportunities` respondem.
- Importacao real pequena com `ReceitaFederalProvider` validada em banco local/teste.
- Mapa retorna campos de rastreabilidade quando aplicavel.

Risco:

- Alto se a migracao comecar sem saber se o backend atual esta consistente.

Comando de verificacao:

```bash
curl -s http://127.0.0.1:3001/dashboard/summary
```

## Fase 3 - Criacao do `frontend-angular` paralelo

Status: Pendente

Objetivo:

- Criar app Angular separado sem apagar ou mover `frontend/`.
- Configurar env/proxy para consumir o mesmo backend.
- Preservar React como referencia funcional.

Criterios de aceite:

- Pasta `frontend-angular/` criada somente nesta fase.
- Angular roda em porta propria.
- React continua rodando sem alteracao.
- Build inicial do Angular passa.

Risco:

- Medio: conflito de portas, scripts e configuracao de ambiente.

Comando de verificacao:

```bash
cd frontend-angular && npm run build
```

## Fase 4 - Layout base Angular

Status: Pendente

Objetivo:

- Implementar shell Angular com sidebar, topbar, page header e router outlet.
- Migrar design base sem telas de dados complexas.

Criterios de aceite:

- Rotas base criadas.
- Sidebar mostra as mesmas entradas principais.
- Redirecionamentos legados planejados.
- Estados comuns (`loading`, `error`, `empty`) disponiveis.

Risco:

- Medio: regressao visual e perda da navegacao atual.

Comando de verificacao:

```bash
cd frontend-angular && npm run build
```

## Fase 5 - Autenticacao Angular usando backend real

Status: Pendente

Objetivo:

- Implementar login Angular usando `POST /auth/login`.
- Implementar restauracao de sessao usando `GET /auth/me`.
- Adicionar interceptor bearer token e guard de rota.

Criterios de aceite:

- Login com usuario seed funciona.
- Token e enviado em rotas protegidas.
- Logout remove sessao.
- Angular nao usa auth mock local.

Risco:

- Alto: auth e pre-condicao para todas as telas internas.

Comando de verificacao:

```bash
curl -s -X POST http://127.0.0.1:3001/auth/login -H "Content-Type: application/json" -d '{"email":"<email-configurado>","password":"<senha-configurada>"}'
```

## Fase 6 - Dashboard Angular

Status: Pendente

Objetivo:

- Migrar Central Comercial para Angular consumindo `GET /dashboard/summary`.

Criterios de aceite:

- Cards exibem os mesmos valores do React contra o mesmo backend.
- Prioridade da semana preservada.
- Acoes para importar CNPJs e ver leads preservadas.
- Loading e erro tratados.

Risco:

- Medio: indicadores divergentes podem minar confianca no Angular.

Comando de verificacao:

```bash
curl -s http://127.0.0.1:3001/dashboard/summary
```

## Fase 7 - Leads e filtros

Status: Pendente

Objetivo:

- Migrar tabela de leads, filtros, paginacao client-side e acoes rapidas.

Criterios de aceite:

- `GET /leads` com filtros backend funciona.
- Filtros client-side de qualidade preservados ou promovidos ao backend com contrato aprovado.
- Badges de qualidade preservados.
- Acao de contato cria interacao.
- Detalhe abre pela rota correta.

Risco:

- Alto: tabela concentra dados reais, filtros e acoes de escrita.

Comando de verificacao:

```bash
curl -s "http://127.0.0.1:3001/leads?city=Tup%C3%A3&cnae=4712100"
```

## Fase 8 - Mapa de oportunidades

Status: Pendente

Objetivo:

- Migrar mapa Leaflet preservando marcadores, filtros, popups e avisos de coordenada aproximada.

Criterios de aceite:

- `GET /map/opportunities` consumido sem adaptacao de campo.
- Marcadores aparecem no mapa.
- Popup mostra aviso para `origemCoordenada` com `centroide` ou `jitter`.
- Banner de localizacao aproximada preservado.
- Pontos sem coordenada nao sao apresentados como se tivessem localizacao real.

Risco:

- Alto: risco de interpretar coordenada aproximada como endereco real.

Comando de verificacao:

```bash
curl -s http://127.0.0.1:3001/map/opportunities
```

## Fase 9 - Detalhe do lead

Status: Pendente

Objetivo:

- Migrar dados cadastrais, dados comerciais, historico, qualidade e acoes do lead.

Criterios de aceite:

- `GET /leads/:id` carrega dados.
- Historico de interacoes aparece.
- Registrar contato funciona.
- Agendar proxima acao funciona.
- Converter e descartar preservam comportamento atual.
- Aviso de localizacao aproximada aparece quando aplicavel.

Risco:

- Alto: tela executa alteracoes de status e historico.

Comando de verificacao:

```bash
curl -s http://127.0.0.1:3001/leads
```

## Fase 10 - Comparacao React vs Angular

Status: Pendente

Objetivo:

- Rodar React e Angular lado a lado contra o mesmo backend.
- Comparar valores, filtros, rotas e estados de erro.

Criterios de aceite:

- Dashboard com os mesmos valores.
- Tabela com os mesmos leads para os mesmos filtros.
- Mapa com a mesma quantidade de pontos elegiveis.
- Detalhe do mesmo lead com dados equivalentes.
- Fluxos de escrita validados em banco local/teste.

Risco:

- Alto: divergencias podem indicar quebra de contrato ou regra duplicada.

Comando de verificacao:

```bash
cd frontend && npm run build
```

```bash
cd frontend-angular && npm run build
```

## Fase 11 - Corte final

Status: Pendente

Objetivo:

- Remover React somente depois da validacao funcional e visual do Angular.

Criterios de aceite:

- Angular cobre rotas do MVP.
- Smoke tests da API aprovados.
- Build do Angular aprovado.
- Backend aprovado.
- Checklist de comparacao React vs Angular concluida.
- Branch/tag de seguranca criada antes da remocao.

Risco:

- Muito alto se executado antes da paridade real.

Comando de verificacao:

```bash
git status --short
```

```bash
cd frontend-angular && npm run build
```
