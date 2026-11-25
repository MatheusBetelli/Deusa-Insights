# Arquitetura e manutenção do Deusa Insights

## Organização

O projeto mantém dois pacotes: frontend React/TanStack e API NestJS/Prisma. Não há necessidade de introduzir outro framework ou pacote compartilhado para organizar os domínios atuais.

No frontend, `src/features/` agrupa os domínios activities, classification, companies, dashboard, imports, leads, map, notifications, pipeline, settings, territories e users. Cada domínio contém somente as responsabilidades existentes:

- `pages/`: composição da tela e coordenação do estado da jornada.
- `components/`: unidades visuais específicas do domínio.
- `model/`: cálculos, transformação de dados e regras sem renderização.
- `api/`: cliente HTTP do domínio e respectivos specs.
- `types/`: contratos do domínio, incluindo parâmetros de busca.

`src/routes/` registra URLs, parâmetros, metadados, redirecionamentos e guardas do TanStack. Não editar `routeTree.gen.ts` manualmente. Páginas acessam hooks tipados via `getRouteApi`, sem importar o objeto Route. Componentes compartilhados permanecem em `components/ui`, `components/common` e `components/layout`. Transporte HTTP fica em `services/api.ts`; utilitários transversais em `lib/`; paginação e extensões de bibliotecas em `types/`.

Importe diretamente o módulo necessário. Uma feature pode consumir contratos e APIs de outro domínio; não deve importar sua página para reutilizar uma função. Não crie uma nova abstração apenas por quantidade de linhas. Separe quando houver responsabilidades distintas ou reutilização verificável.

O backend já usa módulos por domínio. Preserve essa organização, os módulos Nest e seus providers. Em empresas, `domain/company-contacts.ts` concentra normalização de contatos e `domain/company-location.ts` concentra validação e correspondência de localização; `companies.service.ts` coordena acesso e persistência. Novas extrações devem seguir responsabilidades e manter testes junto às regras.

## Invariantes de produção

Autorização permanece no servidor: autenticação, roles e escopo de carteira. Não substitua guardas por controles da interface. Preserve DTOs, cookies, endpoints, tratamento de HTML e respostas sem detalhes internos. Preserve o congelamento dos dados e o controle de APIs pagas; refatorar não autoriza mudar dados. A carteira usa `ClientAccount.isCurrentClient`, sem inferência por rede ou raiz de CNPJ.

Não versionar segredos. Use os engines dos manifests (Node 22.13 ou superior compatível e npm 10+). Não instalar ou atualizar dependências como efeito colateral de uma reorganização.

## Verificação

Na raiz: `npm run typecheck`, `npm run lint`, `npm test`, `npm run deadcode`, `npm run hygiene` e `npm run build`. O build da raiz também verifica o artefato Node do frontend. Para mudanças localizadas, comece pelos specs afetados. A suíte HTTP de serviços pode usar mocks; isso não prova banco nem sessão real. `test:e2e` é separado e deve ter pré-requisitos inspecionados antes da execução.

Para mudanças visuais, valide desktop, tablet e mobile com foco, overflow e estados de erro. Para uma entrega, valide também ambiente, banco, migrações, backup/restauração, HTTPS, observabilidade e fluxos autenticados; checks locais não substituem essa evidência.

## Verificação desta reorganização — 24/11/2026

Executados com sucesso: `npm run typecheck`, `npm run lint`, `npm run test` (158 backend e 27 frontend), `npm run deadcode`, `npm run hygiene`, `npm run build` (inclui `check:node-artifact`) e `git diff --check`. O artefato Node contém entrada do servidor e assets, sem arquivos de ambiente. O build emitiu aviso de depreciação de `punycode`.

A execução local usou Node 22.12.0, abaixo do mínimo declarado na raiz (22.13.0). A pipeline deve repetir os checks com a versão suportada antes da publicação.

Não foram executados E2E contra serviços reais, navegação autenticada, inspeção visual responsiva, auditoria atualizada de dependências, migrações ou deploy. Não houve alteração de banco nem chamada paga. Esses checks não constituem uma auditoria completa de segurança ou aprovação do ambiente de produção.

A organização por domínio está implantada nas páginas comerciais principais e nos clientes/contratos HTTP. Páginas ainda coordenam estado e jornadas complexas, especialmente mapa e detalhe de lead; novas extrações devem acompanhar testes de comportamento e fluxo real, sem fragmentar handlers que compartilham o mesmo ciclo de vida. Os demais módulos NestJS preservam a arquitetura existente.
