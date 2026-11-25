# Infraestrutura, integrações e prontidão para produção

## Conclusão executiva

**Não recomendo colocar o sistema em produção agora.** A classificação é **3 — adequado somente para demonstração ou homologação**. O repositório contém Dockerfiles, configuração de Cloud Run, integração Supabase/PostgreSQL, workflow de CI e um workflow manual de canário. Isso prova que existe um caminho planejado no código; não prova que os serviços, segredos, banco, DNS, backup, monitoramento ou workflow estejam ativos hoje.

O briefing informa que hospedagem e algumas integrações não estão disponíveis. A razão concreta não é registrada no código e é **não verificada** nesta auditoria. Não foram usados `gcloud`, credenciais, console da nuvem, API do Google, Resend, banco remoto ou ações de deploy.

## Topologia prevista no repositório

| Camada | Implementação/configuração encontrada | Estado atual |
|---|---|---|
| Frontend | React 19, Vite e TanStack Start; artefato SSR Node. O Dockerfile executa `.output/server/index.mjs` na porta 8080 em [frontend/Dockerfile](../../frontend/Dockerfile), linhas 1–35. | Código presente; build e servidor atual não verificados. |
| Proxy | `/api/*` é encaminhado pelo servidor frontend para `BACKEND_ORIGIN` em [frontend/src/server.ts](../../frontend/src/server.ts), linhas 18–87. Em produção exige origem HTTPS. | Configuração presente; origem ativa não verificada. |
| API | NestJS 11/Express, REST, DTO validation, autenticação JWT e módulos de negócio. A API escuta porta configurável e executa em `0.0.0.0` em [backend/src/main.ts](../../backend/src/main.ts), linhas 75–181. | Código presente; endpoint local e remoto não responderam/não foram consultados. |
| Persistência | PostgreSQL por Prisma 6.12. O schema admite `DATABASE_URL` e `DIRECT_URL` em [schema.prisma](../../backend/prisma/schema.prisma), linhas 1–10. O compose cria PostgreSQL 16 local na porta padrão 5435 e usa volume persistente em [docker-compose.yml](../../docker-compose.yml), linhas 1–21. | Conexão e migrations atuais não verificadas. O compose não foi iniciado. |
| Produção documentada | [DEPLOY.md](../../DEPLOY.md), linhas 7–24, descreve frontend e backend em Google Cloud Run com Supabase PostgreSQL, pooler runtime e conexão de migrations. | É documentação estática, sem prova de serviço ativo. |

## Google Cloud não é a API de prospecção

São dois tipos de dependência diferentes:

| Uso | Serviço | Evidência e observação |
|---|---|---|
| Hospedagem dos containers | Google Cloud Run | Ambos os Dockerfiles e o manual de deploy descrevem containers. A documentação oficial do Cloud Run confirma suporte a implantação de imagens de container ([Google Cloud: deploy de imagens](https://docs.cloud.google.com/run/docs/deploying)). |
| Armazenamento de imagens | Artifact Registry | Referenciado no manual e no workflow manual de deploy; operação ativa não verificada. |
| Segredos de produção | Google Secret Manager | O manual manda armazenar credenciais do banco, JWT e serviço de e-mail; nenhuma secret foi consultada. |
| Autenticação da automação | GitHub Actions Workload Identity Federation | O workflow usa identidade federada em vez de chave JSON persistente em [.github/workflows/deploy-production-canary.yml](../../.github/workflows/deploy-production-canary.yml), linhas 19–40 e 99–107. O ambiente GitHub não foi consultado. |
| Banco gerenciado | Supabase PostgreSQL | O frontend não acessa Supabase diretamente; Nest/Prisma é a camada de acesso. O manual exige conexão runtime via pooler e `DIRECT_URL` somente para migrations. Configuração e backups atuais não foram verificados. A disponibilidade atual de backups/PITR depende do projeto e plano; ver [Supabase: backups](https://supabase.com/docs/guides/platform/backups). |
| Busca individual de estabelecimento | Google Places API Text Search | Há uma chamada POST a `places.googleapis.com/v1/places:searchText` em [companies.service.ts](../../backend/src/companies/companies.service.ts), linhas 315–343. A chave é `GOOGLE_MAPS_API_KEY`; o código sai sem candidatos se ela não estiver configurada, linhas 1122–1152. Não há integração com Google Geocoding encontrada no código pesquisado. |
| Tiles do mapa | OpenStreetMap | A tela busca tiles diretamente em `tile.openstreetmap.org` em [mapa-oportunidades.tsx](../../frontend/src/routes/_app/mapa-oportunidades.tsx), linhas 567–574. Isso não depende da API Google Places, mas depende de conexão externa para carregar o fundo cartográfico. |
| E-mail | Resend | Variáveis de API key/remetente aparecem nos templates de ambiente e são utilizadas para convite/recuperação. Disponibilidade e domínio verificado não foram confirmados. |

Google Cloud hospeda aplicação e artefatos; Google Places tenta sugerir candidatos para um registro existente. Uma aplicação pode voltar a hospedar sem Google Places, embora a sugestão individual fique indisponível. Um endpoint de Places escrito no código não prova chave válida, faturamento, API habilitada, quota ou resposta operacional.

## Caminho de deploy e por que não comprova hospedagem atual

O workflow [deploy-production-canary.yml](../../.github/workflows/deploy-production-canary.yml), linhas 1–40, é manual (`workflow_dispatch`) e exige variáveis de projeto/região/repositório/serviços e identidade federada. Valida um CI verde, confirma que os serviços já existem, publica imagens e cria revisões canary sem tráfego em linhas 49–161. Isso é um mecanismo de publicação preparado; não demonstra que tenha sido executado.

O manual de deploy descreve ainda uma etapa de migrations controlada, ambiente protegido, secrets, smoke tests e rollout gradual em [DEPLOY.md](../../DEPLOY.md), linhas 81–101, 120–199 e 263–288. Nenhuma dessas etapas foi executada ou conferida nesta auditoria. A ausência de site ativo não permite concluir, somente pelo código, se a causa foi projeto suspenso, cobrança, permissão, secret ausente, serviço excluído ou outra condição. Essas causas seriam hipóteses sem consulta ao proprietário do ambiente.

Existe também um comando frontend `deploy` voltado ao Wrangler/Cloudflare em [frontend/package.json](../../frontend/package.json), linhas 10–20, enquanto o build da raiz e o manual atual usam Node/Cloud Run. A presença desse caminho alternativo não prova que Cloudflare esteja ativo; convém manter a decisão de destino explícita para não confundir os comandos.

## Configuração necessária

Os templates mostram nomes de configuração, não valores ativos. Nenhum segredo real aparece neste relatório.

| Componente | Configuração esperada |
|---|---|
| Backend | `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `PORT`, `FRONTEND_URL`, `ALLOWED_ORIGINS`, `AUTH_COOKIE_SAME_SITE`, `ENABLE_LEAD_MUTATIONS`, `ENABLE_COMMERCIAL_ACTIONS`. |
| E-mail | `RESEND_API_KEY` e `RESEND_FROM_EMAIL` para convite e recuperação; remetente/domínio precisam estar verificados no provedor. |
| Google Places opcional | `GOOGLE_MAPS_API_KEY` somente se a Deusa decidir permitir consultas individuais pagas. O código exige confirmação explícita por chamada e limita a rota. |
| Frontend em produção | `VITE_API_URL=/api` para usar o proxy first-party e `BACKEND_ORIGIN` HTTPS no runtime SSR; veja [vite.config.ts](../../frontend/vite.config.ts), linhas 9–42 e 66–73, e [server.ts](../../frontend/src/server.ts), linhas 18–42. |
| Migrations | `DIRECT_URL` em job isolado de migration, não no container de runtime, conforme [DEPLOY.md](../../DEPLOY.md), linhas 64–77 e 120–131. |

O template de produção e a validação do backend exigem configuração forte, origem HTTPS, flags e ausência de `DIRECT_URL` no runtime em [production-config.ts](../../backend/src/common/production-config.ts), linhas 86–143, e [main.ts](../../backend/src/main.ts), linhas 28–72. A validação real foi coberta em testes unitários; não se executou o check com credenciais.

## Execução local: o que é possível afirmar

- `node_modules` está presente nos três níveis e os testes/typecheck/lint executaram localmente.
- O Node desta máquina é `22.12.0`, abaixo da versão mínima declarada; npm `10.9.0` cumpre o mínimo.
- O Docker Compose local existe, mas não foi iniciado. O volume configurado é persistente; não é apropriado iniciar ou resetar sem saber se contém dados que alguém usa.
- A API exige `DATABASE_URL` e `JWT_SECRET` no startup em [main.ts](../../backend/src/main.ts), linhas 54–72. A API também tenta conectar ao banco no ciclo de vida do Prisma em [prisma.service.ts](../../backend/src/prisma/prisma.service.ts), linhas 4–12.
- As portas locais testadas não responderam. Portanto frontend e backend **não foram demonstrados em execução** nesta sessão.
- O frontend pode renderizar login sem acesso a Places, mas os fluxos de negócio dependem de API, autenticação e banco. A existência de dependências instaladas não basta para afirmar que a tela ou SSR sobe.
- Não foram lidos `.env` locais para evitar usar inadvertidamente configuração ou credencial de produção. Para um teste integrado, é necessário primeiro selecionar um banco descartável/local e credenciais de demonstração autorizadas.

## Segurança e estado operacional

| Critério | Evidência de código | Situação para produção |
|---|---|---|
| Autenticação | Hash de senha bcrypt, cookie HttpOnly, Secure em produção, JWT e revalidação de status/versão. | Controles existentes; login real e configuração de secrets não testados. |
| Autorização | `AuthGuard`, `RolesGuard` e filtros de propriedade de carteira em backend. | Testes unitários passaram; RBAC não foi exercitado em ambiente HTTP real. |
| CORS/CSRF/headers | Helmet, CORS allowlist em produção, proteção por origem e validação de DTO em `main.ts`, linhas 92–160. | Configuração ativa, CSP, cookies, domínio e comportamento no browser não verificados. |
| Dados comerciais | Frontend fala com NestJS; migration restringe roles diretas da Data API e limita writes do usuário runtime, linhas 1–110 da migration RLS. | Migration e grants aplicados no banco ativo: **não verificado**. O papel de backend tem leitura ampla e a separação por vendedor depende da API. |
| Rate limiting | Throttler global e limites mais baixos em login/import/Places. | Armazenamento é local ao processo. Para múltiplas instâncias, o manual pede controle central/WAF; sua existência não está comprovada, [DEPLOY.md](../../DEPLOY.md), linhas 245–250. |
| Erros e logs | Health liveness/readiness, request ID, interceptor de auditoria e respostas sanitizadas. | Há testes unitários; retenção, alertas, dashboards e escala de plantão não verificados. |
| Backup/recuperação | O manual exige backup, PITR e teste de restauração antes de deploy. | Nenhuma cópia ou restauração foi confirmada. |
| Dependências/custos | Google Places, tiles OpenStreetMap, PostgreSQL gerenciado e e-mail externo são dependências configuráveis. | Custos, quotas, região, contrato e plano atuais não foram verificados; nenhum valor é estimado aqui. |

O header `X-LGPD-Compliance` no código não representa certificação nem auditoria de conformidade. A prontidão de segurança descrita aqui é revisão estática, não pentest nem certificação OWASP.

## Alternativas de hospedagem

1. **Retomar Google Cloud Run + Supabase PostgreSQL**, topologia que já aparece nos Dockerfiles, proxy, manual e workflow. É a opção com menor mudança de arquitetura aparente, mas depende de a Deusa revalidar propriedade/acesso do projeto, secrets, banco, serviço de e-mail, domínio e backup. A documentação oficial descreve Cloud Run para containers e deployment por imagem; isso não informa o custo real da configuração da Deusa.
2. **Hospedar os mesmos Dockerfiles em outra plataforma gerenciada de containers e usar PostgreSQL gerenciado.** Render documenta serviços Docker e web services ([Docker no Render](https://render.com/docs/docker), [Web Services](https://render.com/docs/web-services)). Ainda seria necessário validar região, egress, conexão do PostgreSQL, TLS, limites, backup, secrets e custo antes da decisão. Não há estimativa de preço neste relatório.
3. **Docker Compose em máquina local** para homologação isolada, nunca como substituto automático de produção. A configuração já existe, mas utiliza volume persistente e a auditoria não iniciou o container.

A escolha depende de titularidade da conta, localização dos dados, política de segurança, disponibilidade operacional, orçamento aprovado e responsável por backup/plantão. Não recomendo comparar preços ou criar contas antes de a Deusa definir esses requisitos.

## Bloqueadores para produção e melhorias posteriores

**Bloqueadores:** ambiente/serviços e banco ativos não confirmados; estado de migrações e restauração não comprovado; origem e qualidade do conjunto comercial sem validação; “não cliente” não é uma negativa conciliada; ausência de smoke autenticado e browser; dependências e custos operacionais sem dono/orçamento definidos.

**Após um piloto:** centralizar rate limiting e métricas, ajustar caches distribuídos se necessário, medir desempenho com volume real, reduzir dívida de compatibilidade User/Profile e automatizar alertas/rotinas de recuperação. Esses pontos devem ser priorizados por medição e operação, sem adiar os bloqueadores de dados e infraestrutura.
