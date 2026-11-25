# QA, revisão e preparação para produção — 24/11/2026

## Fechamento para apresentação e commit — 24/11/2026

`E2E_EMAIL`, `E2E_PASSWORD` e `E2E_EXPECTED_ROLE` **não estão exportados neste ambiente**. Por isso, `npm run qa:authenticated` não foi executado nesta rodada: o comando exige credenciais reais e não há autorização para criar usuários ou alterar o banco congelado. Permanecem **sem validação real** a sessão no navegador, os filtros, a paginação, os drawers, os modais, os erros de console/rede nas telas autenticadas e a igualdade dos totais de Clientes Ativos entre Dashboard e Mapa sob os mesmos filtros. A observação anterior de 374 contas ativas e 336 leads vinculados compara unidades distintas e não substitui essa conferência de interface.

Para concluir com uma conta existente, mantenha o backend e o frontend locais ativos, exporte as credenciais de QA apenas no terminal local e execute o comando abaixo. O roteiro de filtros, paginação, drawers, modais, papéis e comparação dos contadores está na seção da segunda rodada; a automação atual percorre as rotas e verifica erros/overflow em 390, 820 e 1440 px, mas não substitui essas interações manuais. Não use os controles de gravação da tela de importação nem ações comerciais durante essa validação de leitura.

```sh
E2E_BACKEND_URL=http://127.0.0.1:3001 E2E_FRONTEND_URL=http://127.0.0.1:8080 npm run qa:authenticated
```

O trabalho que estava misturado no index e na árvore de trabalho foi organizado em quatro commits locais, separados por refatoração de domínios, segurança/importação, dependências/build e testes/QA. O único item de `docs/qa-evidence/` é `http-2026-11-24.json`, com 27 resultados HTTP básicos, sem corpo de resposta, cookies, tokens ou credenciais; ele foi mantido porque o relatório o referencia. Os documentos de auditoria e o PDF foram mantidos como entregáveis versionados. A revisão dos caminhos a versionar não encontrou `.env` ou arquivos de credenciais. Durante a varredura, o valor de `JWT_SECRET` em `.env.production.example` não estava identificado como placeholder; ele foi substituído por um marcador explícito antes do commit. O `.env` local não foi lido nem alterado. A varredura de padrões de chave privada, token GitHub, chave AWS e JWT não sinalizou conteúdo versionado. `backend/prisma/` e os guardas de congelamento não foram alterados nesta etapa; Dashboard e Mapa continuam usando `ClientAccount.isCurrentClient = true`, sem reconciliação heurística por raiz de CNPJ ou nome.

Após os quatro commits, `npm run typecheck`, `npm run lint`, `npm run test` (162 backend e 27 frontend), `npm run hygiene` e `npm run build` passaram. O build incluiu `check:node-artifact`, não mostrou o aviso de chunk circular e registrou apenas avisos de diretivas `use client` de dependências ignoradas pelo bundler. `git diff --check` e `git diff --cached --check` também passaram. O código validado é o mesmo dos quatro commits; a única atualização posterior foi este registro de QA. Nenhuma migration, seed, reset de banco ou chamada paga foi executada.

## Terceira rodada — resultado anterior

Os checks locais de release passaram. A auditoria de runtime reporta **zero vulnerabilidades na raiz, no backend e no frontend**. As contas reais de QA continuam necessárias para validar dados, paginação, filtros e equivalência de contadores nas telas autenticadas. Os resultados anteriores abaixo são históricos.

### Dependências corrigidas

| Componente | Versão resolvida no lockfile |
| --- | --- |
| proxy-addr | 2.0.8 |
| body-parser | 2.4.0 |
| multer | 2.5.0 |
| js-yaml do backend | 5.5.0 |
| qs | 6.17.1 |
| @nestjs/platform-express / @nestjs/swagger | 11.2.11 / 11.4.8 |
| @tanstack/react-start / react-router | 1.168.60 / 1.170.41 |
| @tanstack/start-server-core | 1.169.39 |
| seroval | 1.8.2 |
| source-map-js | 1.2.4 |
| vite | 7.3.8 |

Os manifests e lockfiles foram atualizados dentro das famílias compatíveis. A resolução automática tentou TanStack Start 1.169.7, cujo peer exige Vite 8. Foi selecionado Start 1.168.60, com peer Vite >=7 e dependência server-core corrigida. Os dois pacotes TanStack diretos ficaram fixados para evitar essa migração implícita. Ajustado o contrato de erro do root route para receber unknown, conforme os tipos atualizados do router.

A correção do Start cobre CVE-2026-102989, XSS em respostas de server functions. A correção de proxy-addr cobre CVE-2026-90711, spoofing de IP em certas configurações de sub-rede de confiança. Todos os demais advisories de runtime detectados pelo npm audit deixaram de aparecer. Nenhuma exclusão de advisory foi usada. Fontes dos mantenedores e da base revisada do GitHub — [TanStack](https://github.com/advisories/GHSA-qx66-fv34-fjm8), [proxy-addr](https://github.com/advisories/GHSA-jqcg-44mw-7w3h).

Executados os audits JSON dos dois pacotes antes e depois, além da cadeia audit da raiz. Audit sem omit também identifica alertas de ferramentas de desenvolvimento, inclusive Cloudflare/Wrangler. A aprovação registrada aqui corresponde ao comando solicitado de runtime, npm audit --omit=dev. Não foi usada a opção force.

### Build e execução do Node

O agrupamento manual por nomes de bibliotecas e a inclusão automática das dependências nos chunks provocavam o ciclo vendor-map/vendor-tanstack. A primeira tentativa de tornar os chunks explícitos eliminou o ciclo, mas o teste de execução capturou erro JavaScript no login. Essa tentativa foi substituída pela divisão automática do bundler, removendo manualChunks.

No build final não ocorreu aviso Circular chunk. O servidor do artefato final iniciou com NODE_ENV=production em 127.0.0.1:8081 e respondeu HTTP 200 no login. Chrome headless percorreu o login, alternou mostrar/ocultar senha e abriu recuperação em 390, 820 e 1440 px. Sem exceções JavaScript, erros de console, respostas HTTP >=400 ou overflow horizontal nesses fluxos. O check:node-artifact aprovou servidor, assets e ausência de arquivos de ambiente.

### Sessões, contratos e comando de QA

E2E_EMAIL, E2E_PASSWORD e E2E_EXPECTED_ROLE estavam ausentes. O E2E contra o backend local terminou com 2 testes aprovados e 7 pulados. O processo backend foi reiniciado depois da instalação para carregar a árvore atualizada de dependências. Uma tentativa anterior com o processo parado foi descartada e repetida com health disponível.

O novo teste backend auth/roles-http.spec.ts usa uma aplicação Nest HTTP isolada, os AuthGuard, RolesGuard e DatasetFreezeGuard reais e sessões e serviços simulados. ADMIN, MANAGER e SALES percorrem leads, dashboard, mapa, cidades, CNAEs, notificações, pipeline, empresas, atividades, usuários e histórico. Confere os corpos retornados pelos controllers, 403 para usuários acessados por SALES, 403 no histórico por não ADMIN, 401 sem sessão e bloqueio de upload antes da chamada de serviço. Os fixtures validam o encadeamento HTTP e as permissões. A construção de dados pelos serviços reais permanece coberta por seus specs existentes e depende de sessão real para validação contra a carteira.

Foi acrescentado playwright-core como ferramenta dev para tornar o comando reproduzível. Com a aplicação e o banco existentes ativos, exporte as três variáveis E2E localmente e execute:

```sh
E2E_BACKEND_URL=http://127.0.0.1:3001 E2E_FRONTEND_URL=http://127.0.0.1:8080 npm run qa:authenticated
```

O comando executa test:e2e, login no Chrome, navegação de leitura nas telas, detalhe do primeiro lead disponível, erros do browser e overflow nas três larguras. Importação é visitada quando E2E_EXPECTED_ROLE=ADMIN. Chrome pode ser indicado por CHROME_PATH. O modo --public foi executado tanto no Vite quanto no artefato Node. A validação prática de filtros, paginação, drawers/modais e contadores SSOT requer a sessão humana e segue o roteiro da segunda rodada. Os totais de contas e leads não foram igualados artificialmente.

### Revalidação e organização

Após a última alteração de código, passaram integralmente typecheck, lint, test (162 backend e 27 frontend), deadcode, hygiene, build e audit. Zero falhas nas suítes de unidade e integração locais. Git diff --check também passou. Os relatórios e evidências HTTP anteriores foram preservados como histórico útil. Logs temporários ficaram em /tmp/d3*. Não houve commit, push, migração, escrita em dados comerciais ou chamada paga.

### Checklist restante

- Credenciais de QA existentes para executar os fluxos autenticados e conferir contagem SSOT sob recortes equivalentes.
- Servidor com NODE_ENV, DATABASE_URL remoto, JWT_SECRET, FRONTEND_URL, ALLOWED_ORIGINS, AUTH_COOKIE_SAME_SITE, ENABLE_LEAD_MUTATIONS=false, ENABLE_COMMERCIAL_ACTIONS=true e configuração real de e-mail. DIRECT_URL exclusiva do job de migrations. RESEND_TEST_RECIPIENT vazio.
- Frontend Node com VITE_API_URL=/api no build e BACKEND_ORIGIN HTTPS real no runtime, conforme a topologia escolhida.
- Validar status e drift das migrations no alvo, backup com restauração comprovada, HTTPS, cookies Secure/HttpOnly/SameSite, monitoramento e alertas.
- Testar sessão e envio de e-mail no domínio real após a publicação autorizada.

## Segunda rodada — decisão de liberação

**Resultado histórico; os bloqueios de dependências foram corrigidos na terceira rodada.** Chrome e Playwright funcionaram no ambiente local. A cadeia passou com Node 22.23.3, 161 testes de backend e 27 de frontend. A evidência autenticada das três roles permaneceu ausente.

### Fluxos e dados observados

- Chrome headless real no frontend local, larguras de 390, 820 e 1440 px. Login renderizou campos, alternou a visibilidade da senha e abriu a recuperação de senha. Reset sem token exibiu estado público e set-password encaminhou para reset. Não foi enviado e-mail. Nenhum overflow horizontal nas três larguras. Solicitações a hosts externos foram bloqueadas no navegador de teste.
- Em 1440 px, as entradas diretas em dashboard, leads, mapa, funil, atividades, importação e configurações terminaram em login após 401 esperado. A primeira execução revelou erro de hidratação React na troca de rota. A correção em `frontend/src/routes/_app.tsx` usa navegação completa ao redirecionar para login. No reteste não houve exceção JavaScript nessas sete rotas. Cada 401 gerou uma mensagem no console de rede.
- A suíte `frontend/src/e2e.test.ts` agora inclui detalhe de lead, mapa, atividades, empresas, notificações, perfil, usuários, histórico e códigos de acesso conforme a role. Executada contra os servidores reais após a reinicialização do backend: **2 passaram, 7 pulados**, por ausência de credenciais de teste. Nenhuma role foi autenticada nesta rodada. Um teste de health inicialmente falhou durante a reinicialização e passou na repetição.
- PostgreSQL local, consultas de contagem somente leitura: **374 contas ativas**, zero sem vínculo de empresa e **336 leads** cujas empresas têm alguma conta ativa. São unidades de contagem diferentes. A diferença de 38 não comprova 38 empresas faltantes nem o número de pinos visíveis. A comparação de dashboard e mapa precisa aplicar carteira, período, recorte geográfico e deduplicação equivalentes. Nenhum registro foi reclassificado.
- Para concluir com contas existentes, exporte localmente `E2E_EMAIL`, `E2E_PASSWORD` e `E2E_EXPECTED_ROLE` para cada papel, depois execute `E2E_BACKEND_URL=http://127.0.0.1:3001 E2E_FRONTEND_URL=http://127.0.0.1:8080 npm --prefix frontend run test:e2e`. No navegador, compare os totais sob os mesmos filtros, abra a segunda página e o drawer de leads, visite o detalhe pelo ID retornado, abra um pino e percorra filtros do funil e atividades. Confira acesso ao histórico de importação e à configuração por papel. Repita em 390, 820 e 1440 px com console e rede abertos. Para o dataset congelado, mantenha as interações em leitura.

### Limpeza e integridade

Backup privado em `/tmp/deusa-round2-4kSV/cleanup.tar`, criado antes da remoção dos datasets, scripts locais e atalhos Claude. O arquivo contém dados comerciais e permanece fora do repositório. Foram removidos os seguintes itens:

- `dadosCNAE/filter_cnpjs.py`
- `dadosCNAE/leads_para_validacao_manual.csv`
- `dadosCNAE/analysis_quality_report.md`
- `dadosCNAE/sp_4712100_estabelecimentos.csv`
- `cidadesclientes/Pompeia.csv`
- `cidadesclientes/Tupa.csv`
- `cidadesclientes/Marilia.csv`
- `cidadesclientes/Ribeirao_Preto.csv`
- `cidadesclientes/Bastos.csv`
- `cidadesclientes/Franca.csv`
- `backend/scripts/generate-quality-report.ts`
- `backend/scripts/audit-cidades-clientes.ts`
- `backend/scripts/verify-dashboard-map-sync.ts`
- `backend/scripts/call-dashboard-service.ts`
- `backend/scripts/verify-db-state.ts`
- `backend/scripts/check-client-counts.ts`
- `backend/scripts/verify-all-382.ts`
- `backend/scripts/test-map-opportunities-count.ts`
- `backend/scripts/check-street-match.ts`
- `backend/scripts/check-dashboard-summary.ts`
- `backend/scripts/check-root-cnpjs.ts`
- `backend/scripts/test-strict-matching.ts`
- `backend/scripts/compare-map-clients-vs-csv.ts`
- `backend/scripts/geocode-marilia.ts`
- `backend/scripts/find-unlinked-clients.ts`
- `backend/scripts/audit-data-quality-security.ts`
- `backend/scripts/audit-and-fix-coordinates.ts`
- `backend/scripts/check-single-franca.ts`
- `.claude/skills/prisma-client-api`
- `.claude/skills/prisma-postgres-setup`
- `.claude/skills/prisma-mongodb-upgrade`
- `.claude/skills/prisma-postgres`
- `.claude/skills/prisma-database-setup`
- `.claude/skills/prisma-cli`
- `.claude/skills/prisma-driver-adapter-implementation`
- `.claude/skills/prisma-upgrade-v7`
- `.claude/skills/prisma-compute`

A busca territorial saiu da tela e do cliente HTTP. O endpoint legado de importação conserva os guardas e retorna 410 ao alcançá-lo. O provider de sincronização também retorna erro controlado, sem ler disco nem rede. Removidos o DTO da busca, o modelo de resultado exclusivo da busca e seus specs obsoletos. Retirados `quality:report` e suas referências de lint, Knip, higiene e gitignore. Histórico continua consultável pelo administrador.

O upload XLSX/CSV permanece protegido por autenticação, role ADMIN e DatasetFreezeGuard, que executam antes do interceptor de arquivo e do serviço. Quando a escrita é explicitamente habilitada, todas as linhas, consultas de vínculo, atualizações e resumo usam uma transação Prisma por arquivo. Erro de persistência ou timeout aborta a transação. Linhas inválidas seguem a regra existente de contabilização como ignoradas. O teste com falha na segunda linha confirma a propagação da exceção em uma única transação simulada. Não se executou upload no banco comercial.

As cinco rotas legadas continuam como aliases documentados nas auditorias e nos contratos. Nenhum link foi encontrado nos componentes de navegação. `.gemini/` contém comandos OpenSpec e material próprio de migração. `output/pdf/` contém o entregável executivo já no staging. Ambos foram preservados.

### Auditoria de dependências

`npm run audit` executado. A raiz passou com zero alertas e a cadeia parou na falha do backend. Foram auditados também os dois pacotes individualmente com `npm audit --omit=dev --json`. Lockfiles e versões ficaram inalterados. Os números por pacote incluem dependências que herdam o mesmo advisory.

| Pacote | Resultado | Impacto a avaliar antes da liberação |
| --- | --- | --- |
| Backend | 1 crítico, 2 altos, 4 moderados | proxy-addr pode afetar identificação do IP quando há confiança em sub-redes de proxy. body-parser e multer afetam disponibilidade no processamento de requisições e uploads. Conferir topologia do proxy e atualizar as versões transitivas compatíveis com Nest/Express. |
| Frontend | 6 críticos, 3 altos | TanStack Start e seroval estão na cadeia de SSR e serialização, com avisos de XSS, desserialização e indisponibilidade. Vite, source-map-js e Zod exigem distinguir uso no build, no servidor de desenvolvimento e no artefato Node. Não foi demonstrada explorabilidade em produção. |

Revalidar o artefato SSR, login e cookies após atualizar a família TanStack e a árvore Nest/Express. Os alertas permanecem abertos.

### Configuração e checklist de deploy

`npm run production:check` passou em subshell com entradas fictícias, domínios reservados, banco remoto fictício e relay de testes vazio. O CLI só valida configuração. Não abriu conexão nem enviou e-mail. O template passou a incluir a flag comercial obrigatória e a orientação correta de relay.

| Variável do template ou do deploy | Preenchimento no destino |
| --- | --- |
| NODE_ENV / PORT | production e porta configurada para o respectivo serviço. |
| DATABASE_URL | PostgreSQL remoto, host real, credencial runtime com menor privilégio. DIRECT_URL somente no job de migrations. |
| JWT_SECRET | Segredo aleatório próprio do ambiente, mínimo 32 caracteres, sem placeholder. |
| FRONTEND_URL / ALLOWED_ORIGINS | Origem HTTPS canônica e lista de origens HTTPS permitidas, sem barra final. |
| AUTH_COOKIE_SAME_SITE | lax, strict ou none conforme topologia de cookies. Validar HTTPS e cookie Secure no browser real. |
| ENABLE_LEAD_MUTATIONS / ENABLE_COMMERCIAL_ACTIONS | false / true para congelamento e operações comerciais previstas. |
| RESEND_API_KEY / RESEND_FROM_EMAIL | Segredo do provedor e remetente verificado. RESEND_TEST_RECIPIENT vazio. Validar entrega com conta autorizada. |
| INVITATION_TTL_HOURS | Prazo operacional dos convites, 48 horas no exemplo. |
| VITE_API_URL / BACKEND_ORIGIN | Configurar URL de API no build. No frontend Node com proxy, usar /api e informar a origem HTTPS real do backend no runtime. |
| Infraestrutura | Validar migrations no banco alvo, restauração de backup, logs, alertas, domínio e monitoramento. |

**Cadeia final executada integralmente** — typecheck, lint, testes, deadcode, hygiene e build passaram. O check do artefato Node confirmou servidor, assets e ausência de arquivos de ambiente. O bundler informou dependência circular entre chunks de mapa e TanStack. Navegação autenticada pelo artefato de produção permanece pendente.

## Histórico da primeira rodada

## Decisão executiva

**Checks locais aprovados; liberação de produção pendente.** Corrigidos cinco achados, com regressões automatizadas e revalidação completa. Não há evidência para declarar o sistema sem bugs ou validado ponta a ponta: o serviço de navegador está indisponível e não há credenciais E2E configuradas. Isso bloqueia a Fase 3 e o reteste visual/autenticado da Fase 5.

O trabalho anterior já estava no staging quando esta revisão começou; não houve reset do índice, commit, push ou deploy. Os relatórios anteriores e o PDF foram preservados. Os resultados desta execução não dependem das aprovações históricas.

## 1. Bugs encontrados e corrigidos

| Achado / prioridade | Arquivo e causa | Correção e evidência |
| --- | --- | --- |
| Cookie bruto malformado escapava do tratamento de autenticação / P2 | `backend/src/auth/auth.guard.ts`: extração com `decodeURIComponent` ocorria antes do try/catch. O fallback podia lançar URIError, em vez de UnauthorizedException. Não foi demonstrado 500 no caminho normal com cookie-parser. | Extração dentro do tratamento de autenticação. `auth-guards.spec.ts` comprova 401 para encoding inválido, sem consultar usuário. |
| Configuração de banco inválida podia passar na checagem de produção / P1 | `backend/src/common/production-config.ts`: validação aceitava prefixo PostgreSQL sem URL/host válidos; hostname IPv6 era comparado a `::1`, enquanto URL retorna `[::1]`. | Parser URL obrigatório, protocolo e host verificados, bloqueio de loopback IPv6 e endereços não roteáveis. Regressão em `production-config.spec.ts` cobre URLs malformadas, IPv6 e 0.0.0.0. |
| E-mail completo no log de recuperação em desenvolvimento / P2 | `backend/src/auth/auth.service.ts`: ramo sem provedor imprimia destinatário completo, embora o token já fosse ocultado. | Reutilização de `maskEmailForLogs`. Teste em `auth.service.spec.ts` comprova ausência de e-mail completo e token, com provedor simulado. |
| Importação parcial reportava sucesso / P1 | `backend/src/imports/imports.service.ts`: exceções de registros eram descartadas e o job sempre encerrava SUCCESS; a tela também sempre mostrava toast de sucesso. | Job encerra ERROR quando total salvo diverge do encontrado. A tela usa `features/imports/model/import-result.ts` para mostrar falha e mantém job/empresas retornados. Testes cobrem registro perdido, erro e conclusão válida. |
| Exceções internas expostas no histórico/logs de importação / P1 | `backend/src/imports/imports.service.ts`: erro arbitrário do provider era persistido em errorMessage e logado com stack; falhas de registro imprimiam erro bruto. | Mensagens estáticas sem detalhes de conexão ou conteúdo arbitrário. Teste de provider falhando comprova que credenciais fictícias não entram no histórico. Não houve limpeza ou alteração de jobs históricos na base real. |

As correções de importação foram executadas somente contra mocks. Nenhum import real, criação de estabelecimento ou chamada de provider externo foi efetuado. Falhas parciais ainda podem deixar registros já salvos; o sistema agora informa ERROR, mas não oferece rollback transacional de lote nem reconciliação automática. Isso exige desenho próprio antes de reabilitar importações do dataset congelado.

## 2. Revisão técnica

Foram inspecionados os guards de autenticação/roles/congelamento, emissão de cookie HttpOnly, expiração/invalidação de JWT pela versão da conta, validação global de DTOs, CORS e proteção de Origin para mutações em produção, auditoria, HTML safety, contratos de importação, fonte de clientes ativos e refatoração por domínio. Os testes existentes cobrem autorização, SSOT, XSS, cookies, CORS e congelamento; sua aprovação não substitui teste autenticado com os papéis reais.

Dashboard e mapa consultam `ClientAccount.isCurrentClient` como fonte de classificação; não foi introduzida heurística por raiz de CNPJ ou nome. Nenhuma consulta ao Google Places/Geocoding foi executada. Não se trata de certificação OWASP ou auditoria exaustiva de segurança/dependências.

## 3. Resultado tela por tela

Aplicação local: backend `http://127.0.0.1:3001`, frontend Node/Vite `http://127.0.0.1:8080`. PostgreSQL existente em loopback:5435 foi reutilizado, sem reset, seed ou migração. O processo backend foi iniciado com `ENABLE_LEAD_MUTATIONS=false` e `ENABLE_COMMERCIAL_ACTIONS=false`; o carregamento do CSV foi ignorado pelo congelamento.

Os resultados abaixo são **smoke HTTP após a limpeza**, com redirecionamentos HTTP seguidos. HTML 200 nas rotas com SSR desabilitado pode ser somente o shell da aplicação; não prova renderização nem dados da página. Console, network do browser, filtros, paginação, drawers/modais, teclado, mobile/tablet/desktop e permissões por sessão real continuam não verificados em todas as telas.

| Rota | Smoke HTTP | Fluxo real |
| --- | --- | --- |
| `/login` | 200, HTML | Navegador/autenticação não verificados |
| `/reset-password` | 200, HTML | Navegador/autenticação não verificados |
| `/set-password` | 200, HTML | Navegador/autenticação não verificados |
| `/dashboard` | 200, HTML | Navegador/autenticação não verificados |
| `/leads-b2b` | 200, HTML | Navegador/autenticação não verificados |
| `/leads-b2b/qa-missing` | 200, HTML | Navegador/autenticação não verificados |
| `/mapa-oportunidades` | 200, HTML | Navegador/autenticação não verificados |
| `/mapa-de-calor` | 200, HTML | Navegador/autenticação não verificados |
| `/base-de-dados` | 200, HTML | Navegador/autenticação não verificados |
| `/recomendacoes` | 200, HTML | Navegador/autenticação não verificados |
| `/regioes-prioritarias` | 200, HTML | Navegador/autenticação não verificados |
| `/rotas-inteligentes` | 200, HTML | Navegador/autenticação não verificados |
| `/funil-comercial` | 200, HTML | Navegador/autenticação não verificados |
| `/atividades-comerciais` | 200, HTML | Navegador/autenticação não verificados |
| `/importar-cnpjs` | 200, HTML | Navegador/autenticação não verificados |
| `/configuracoes` | 200, HTML | Navegador/autenticação não verificados |

`/set-password` encaminhou por HTTP a `/reset-password`. Por inspeção das rotas, os aliases legados continuam registrados: `/mapa-de-calor` e `/rotas-inteligentes` redirecionam ao mapa; `/base-de-dados` e `/recomendacoes` aos leads; `/regioes-prioritarias` ao dashboard. Esses redirecionamentos dependem da navegação do router no app e não foram confirmados em navegador autenticado. Foram preservados para compatibilidade com URLs existentes.

O identificador `qa-missing` é deliberadamente inexistente; somente o shell HTTP foi solicitado. Não representa um detalhe real de lead validado. Recuperação/ativação de senha não foi submetida: nenhum e-mail foi enviado nem credencial alterada.

Backend real: `/health/live` e `/health/ready` retornaram 200. `/auth/me`, `/dashboard/summary`, `/leads`, `/map/opportunities`, `/pipeline`, `/commercial-activities`, `/users` e `/companies` retornaram 401 sem sessão e header nosniff. Login com corpo vazio retornou 400. Um probe inicial de `/map-opportunities` retornou 404 porque esse não é o contrato; frontend e backend usam `/map/opportunities`, retestado com 401. Não foi uma divergência do código.

Evidência sem conteúdo comercial: [smoke HTTP final](qa-evidence/http-2026-11-24.json). O navegador foi tentado por inventário e abertura direta; ambas falharam com `browser access host is unavailable`. Foi solicitada conexão de navegador com sessão de teste existente; nenhuma autenticação foi contornada ou fabricada.

## 4. Limpeza: lista exata

Removidos:

- `prisma/schema.prisma`
- `prisma.config.ts`
- `.windsurf/skills/prisma-cli`
- `.windsurf/skills/prisma-client-api`
- `.windsurf/skills/prisma-compute`
- `.windsurf/skills/prisma-database-setup`
- `.windsurf/skills/prisma-driver-adapter-implementation`
- `.windsurf/skills/prisma-mongodb-upgrade`
- `.windsurf/skills/prisma-postgres`
- `.windsurf/skills/prisma-postgres-setup`
- `.windsurf/skills/prisma-upgrade-v7`
- `prisma/`
- `.windsurf/skills/`
- `.windsurf/`
- `tmp/`

Justificativa: o schema da raiz era um scaffold sem modelos; seu client apontava para `generated/prisma`, sem consumidores nos pacotes/scripts/workflows. Os comandos Prisma ativos executam em `backend/`, onde schema e migrations válidas foram preservados. As ocorrências `prisma/schema.prisma` nos workflows são relativas ao backend, conferidas pelo working-directory/cd.

Os nove itens de `.windsurf/skills/` eram symlinks duplicando `.agents/skills/`, sem referências nos pacotes/scripts/workflows ou processo Windsurf ativo. Apenas os links foram removidos, sem tocar nos alvos. As pastas finais estavam vazias. `tmp/` também estava vazia. Cópia reversível dos arquivos/links removidos ficou fora do repositório em `/tmp/deusa-qa-cleanup-backup.tar`; não inclui .env ou credenciais. Diretórios vazios não precisam de backup.

**Preservados por uso confirmado:** `dadosCNAE/` é consumido por `receita-federal.provider.ts`, `backend/scripts/generate-quality-report.ts`, comando `quality:report` e documentação operacional. `cidadesclientes/` é lido por cinco scripts locais de auditoria/comparação em `backend/scripts/`. Não foram apagados os consumidores para justificar artificialmente uma exclusão. Os CSVs já estão fora do versionamento. `frontend/scripts/data/schema.sql` é parte do fluxo de dados local; SQLs de `backend/prisma/migrations/` são migrations válidas. Documentos/PDF já estavam no staging e são evidência técnica. Não removidas dependências, rotas ou funções adicionais: deadcode terminou sem achados. Não alterados arquivos .env.

## 5. Checks executados

Ambiente: Node 22.23.3 / npm 10.9.9, compatível com os engines. Após a última edição de código, executada em sequência a cadeia completa solicitada:

`npm run typecheck && npm run lint && npm run test && npm run deadcode && npm run hygiene && npm run build`

| Verificação | Resultado |
| --- | --- |
| `npm run doctor` | Aprovado; PostgreSQL existente acessível, envs presentes e Node suportado. Executado antes de subir os serviços. |
| `npm run typecheck` | Aprovado nos dois pacotes. |
| `npm run lint` | Aprovado sem warnings ESLint. |
| `npm run test` | 163 backend + 29 frontend aprovados; zero falhas e zero skips nessas suítes. |
| `npm run deadcode` | Aprovado nos dois pacotes. |
| `npm run hygiene` | Aprovado. |
| `npm run build` | Aprovado nos dois pacotes; check:node-artifact confirmou servidor, assets e ausência de arquivos de ambiente no artefato. |
| `git diff --check` | Aprovado. |
| `npm run production:check` | **Reprovado por configuração do ambiente**; detalhes abaixo. |
| Navegador / E2E autenticado | **Bloqueado**, sem aprovação visual ou funcional ponta a ponta. |

Logs de execução locais ficaram em `/tmp/deusa-qa-*`; não foram versionados. Avisos de dependências/bundler, incluindo diretivas use client ignoradas, não causaram falha do build. Não houve instalação, mudança de lockfile ou atualização automática de dependências.

## 6. Pendências e critérios para liberação

1. **Ambiente local de QA:** conectar o serviço de navegador e fornecer uma sessão de teste existente, ou configurar credenciais E2E por canal seguro, sem publicá-las no chat. Completar a matriz de rotas com console/network e papéis ADMIN/MANAGER/SALES, sem gravar no dataset real. Testes de escrita exigem uma base de teste identificada e autorização compatível.
2. **Configuração de produção:** o CLI foi lido antes de executar. Rodado inicialmente sem variáveis exportadas, falhou por ausências. Uma segunda execução carregou o backend/.env local sem imprimir valores; rejeitou banco localhost, DIRECT_URL no runtime, flags de mutação/comercial, origens/URL não HTTPS, SameSite ausente e configuração de recuperação de senha ausente. Não foram inventados valores nem alterado .env para forçar aprovação. A configuração de desenvolvimento não deve ser reutilizada em produção.
3. **Infraestrutura real:** verificar banco alvo e permissões, status/drift de migrations, HTTPS/domínios/proxy/cookies Secure, entrega de e-mails, backup e restauração, monitoração/alertas e acesso por menor privilégio. Nada disso está aprovado por um build local. Nenhuma migração válida foi excluída ou executada.
4. **Dados:** validar contadores e classificação na base/recorte real de cada papel, mantendo ClientAccount como SSOT. Corrigir inconsistências de carteira exige solicitação explícita; esta auditoria não alterou dados. Importações permanecem congeladas. Mensagens de erro históricas anteriores à correção não foram alteradas na base.
5. **Dependências e segurança:** executar auditoria atualizada de advisories no contexto de release e tratar achados com avaliação de compatibilidade. Não houve verificação atualizada de advisories nesta execução; resultados antigos não foram usados como aprovação.

**Aceite final:** a fase automatizada e a limpeza autorizada estão concluídas; as fases de navegador e validação do ambiente real permanecem pendentes. Não declarar “sem bugs”, “zero regressão” ou “pronto para produção” antes desses critérios.
