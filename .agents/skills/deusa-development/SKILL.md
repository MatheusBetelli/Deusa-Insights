---
name: deusa-development
description: Implementar ou refatorar módulos do Deusa Insights seguindo a organização por domínio, os contratos e os testes locais.
---

Leia `AGENTS.md` e `docs/architecture.md` antes de escolher o módulo. Confira o diff para preservar trabalho existente.

No frontend, coloque páginas, componentes, regras, serviços HTTP, contratos e specs em `frontend/src/features/<dominio>/{pages,components,model,api,types}` conforme a responsabilidade realmente existir. Não crie pastas vazias. Rotas TanStack ficam em `src/routes`, com registro, validação de busca, metadados e guardas. Páginas usam `getRouteApi` para hooks tipados; não importam o objeto Route. Contratos pertencem ao domínio. Use `services/api.ts` para transporte compartilhado e `components/ui`, `components/common` e `components/layout` para infraestrutura visual.

No backend, preserve os módulos NestJS existentes. Controllers validam entrada e aplicam guardas; services coordenam persistência; regras sem acesso ao banco podem ficar em `domain/`, com specs próximos. Não mova módulos só para criar mais um nível de pasta. Preserve DTOs, endpoints, providers e injeção de dependências.

Para cada mudança, siga os consumidores e atualize imports e testes juntos. Evite barrels que ocultem ciclos, extrações baseadas apenas em tamanho e serviços genéricos sem reutilização real. Remova código apenas depois de verificar consumidores, rotas geradas, scripts e testes.

Preserve autenticação, autorização por carteira e os guardas de congelamento. Leia as skills locais `dataset-freeze` e `api-cost-commercial-scope` quando tocar dados comerciais. Uma refatoração não autoriza seed, migração, sincronização, API paga ou deploy.

Execute os checks pertinentes descritos em `docs/architecture.md`; ao mover módulos, inclua typecheck, lint, testes, deadcode e build. Relate comandos e resultados reais, distinguindo mocks de integração e execução local de produção.
