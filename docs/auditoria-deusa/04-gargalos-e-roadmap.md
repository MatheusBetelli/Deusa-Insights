# Gargalos, riscos e plano de evolução

## Gargalos e prioridades

Escala: gravidade estima impacto se o fluxo for usado; prioridade P0 bloqueia operação, P1 exige correção antes do piloto ou precisa de controle manual, P2 pode ser tratado após estabilizar. “Probabilidade” é avaliação técnica qualitativa, não frequência medida.

| Problema | Evidência no código | Impacto | Gravidade | Solução recomendada | Prioridade |
|---|---|---|---|---|---|
| Coordenada aproximada exibida como se fosse ponto de estabelecimento | O provider cria centroide + jitter de até cerca de 1,5 km, explicitamente visual em [receita-federal.provider.ts](../../backend/src/imports/providers/receita-federal.provider.ts), linhas 264–291. O fallback usa centroide sem jitter, mas atribui origem `municipio_centroide_jitter` em [map-opportunities.service.ts](../../backend/src/map-opportunities/map-opportunities.service.ts), linhas 576–592. | Rota de visita, cobertura e leitura de concentração podem ser incorretas; pinos podem se sobrepor. | Alta | Separar no dado/API coordenada municipal, candidata e confirmada; impedir navegação/rota com coordenada aproximada; corrigir rótulo do fallback e manter estado de precisão visível. | P0 |
| “Não cliente” não equivale a não pertencente à carteira | O mapa consulta somente `clientAccounts.some(isCurrentClient=true)` para marcar cliente em [map-opportunities.service.ts](../../backend/src/map-opportunities/map-opportunities.service.ts), linhas 595–600. A importação pode salvar conta sem `companyId` em [imports.service.ts](../../backend/src/imports/imports.service.ts), linhas 390–470. | Prospect real da carteira pode ser abordado como novo cliente; métricas de expansão podem ficar distorcidas. | Crítica | Antes de mostrar “não cliente”, conciliar CNPJ filial/código ERP com a carteira atual; manter estado “não conciliado”; obter aprovação comercial da regra e da periodicidade da carteira. | P0 |
| Situação de cliente não tem reconciliação de ausentes no backend | O import persiste `isCurrentClient: true`; o schema assume `true` por padrão. Não foi encontrado fluxo do backend que grave `false`: [imports.service.ts](../../backend/src/imports/imports.service.ts), linhas 456–470; [schema.prisma](../../backend/prisma/schema.prisma), linha 251. | Conta antiga pode permanecer ativa após saída se não houver processo externo atualizado. | Alta | Definir formalmente se o arquivo é snapshot ou delta; criar relatório de ausentes e etapa de revisão/baixa, com trilha de auditoria e teste de não regressão. | P0 |
| Nome de fachada pode ser substituído por placeholder ou confundido com razão social | `mapRowToCompany` atribui nome fantasia ou `EMPRESA CNPJ …` a `razaoSocial` em [receita-federal.provider.ts](../../backend/src/imports/providers/receita-federal.provider.ts), linhas 293–302. | Vendedor pode interpretar nome técnico/cadastral como marca real; buscas e comparação podem errar. | Alta | Manter razão social e fantasia como campos distintos; valor ausente deve permanecer ausente, com estado “nome comercial pendente”. | P1 |
| Candidatos Google Places podem ser falsos positivos | Similaridade aceita prefixo comum de cinco caracteres em [companies.service.ts](../../backend/src/companies/companies.service.ts), linhas 70–75; categoria incompatível vira alerta e situação comercial não é filtro de exclusão, linhas 362–419. | Sugestão errada pode ser confirmada manualmente ou gerar visita indevida. | Alta | Retirar prefixo genérico, comparar endereço/telefone com regras estritas, excluir fechados/incompatíveis do topo, pedir aprovação humana e registrar evidência rastreável. | P1 |
| Dataset de descoberta é local, ignorado pelo Git e ausente na imagem | Provider depende de CSV local em [receita-federal.provider.ts](../../backend/src/imports/providers/receita-federal.provider.ts), linhas 200–216; CSVs são ignorados em [.gitignore](../../.gitignore), linha 54; Dockerfile copia somente fonte/prisma em [backend/Dockerfile](../../backend/Dockerfile), linhas 20–23 e 36–40. | Ambiente de CI/produção não reproduz a mesma descoberta; habilitar importação sem fonte gera erro. | Alta | Versionar metadados e disponibilizar dado por processo controlado de ingestão em banco; se arquivo for necessário, empacotar com autorização, versão e controles de acesso. Não ativar mutação até validar fonte e custo. | P0 |
| Importação pode declarar sucesso parcial e não reparar lead ausente ao repetir | Falhas por item viram `null`, mas o job geral fecha `SUCCESS` em [imports.service.ts](../../backend/src/imports/imports.service.ts), linhas 287–326. Se empresa já existe, retorna antes de chamar `upsertLeadForCompany`, linhas 293–305. | Empresa pode ser persistida sem lead e permanecer fora do mapa mesmo após repetição; relatório de importação pode ocultar falha por item. | Alta | Transação por item para empresa+lead, contadores de falhas por item, status parcial explícito e upsert repetível que reconcilie empresa existente; testar falha após cada etapa em PostgreSQL descartável. | P1 |
| Várias áreas exibidas como navegação são redirecionamentos | Arquivos de rotas redirecionam mapa de calor, rotas, regiões, recomendações e base de dados para outras telas; exemplos em [rotas-inteligentes.tsx](../../frontend/src/routes/_app/rotas-inteligentes.tsx), [regioes-prioritarias.tsx](../../frontend/src/routes/_app/regioes-prioritarias.tsx), [recomendacoes.tsx](../../frontend/src/routes/_app/recomendacoes.tsx) e [base-de-dados.tsx](../../frontend/src/routes/_app/base-de-dados.tsx). | Reunião ou usuário pode entender menu como funcionalidade entregue. | Média | Remover da comunicação de entrega ou marcar como planejadas até construir e validar fluxos próprios. | P1 |
| Infraestrutura, banco, backups e monitoramento atuais não comprovados | Deploy é workflow manual com variáveis e serviços previamente provisionados em [.github/workflows/deploy-production-canary.yml](../../.github/workflows/deploy-production-canary.yml), linhas 1–40 e 109–161. Não houve acesso ao ambiente. | Não há base para assumir disponibilidade, segurança operacional, custo ou recuperação. | Crítica | Confirmar titularidade e estado com responsável da Deusa; preparar staging, backup/restauração, smoke autenticado e observabilidade antes de liberar usuários. | P0 |
| Ambiente local usa Node abaixo da versão mínima | `v22.12.0` observado; o projeto declara `^22.13.0 || >=24.0.0` em [package.json](../../package.json), linhas 6–9. | Pode haver diferença de build/runtime e dificulta reproduzir CI. | Média | Fixar versão suportada via `.nvmrc`/manager e alinhar máquina, CI e Docker. | P1 |
| Cache e throttling são locais por instância | Cache de dashboard/mapa é `Map` em memória; throttle global vem do Nest sem store distribuído: [map-opportunities.service.ts](../../backend/src/map-opportunities/map-opportunities.service.ts), linhas 472–487 e [app.module.ts](../../backend/src/app.module.ts), linhas 25–58. | Em múltiplas instâncias, cache e contadores divergem; limiter local não limita tráfego agregado. | Média | Medir volume e instâncias no piloto; adotar store compartilhado/rate limiting no gateway antes de escalar tráfego externo. | P2 |

## Princípios para a evolução

- Preservar congelamento dos registros importados até que a Deusa autorize um plano de alteração/reconciliação. Não fazer busca em lote nem geocodificação paga.
- Separar dado cadastral oficial, inferência/estimativa, validação humana e fato comercial confirmado em estados e campos distintos.
- Não transformar falta de evidência em “não existe” ou “não é cliente”.
- Medir qualidade por amostra revisada. Não declarar taxa de precisão sem amostra e método aprovados.
- Tratar a configuração de produção como pendente até verificar banco, permissões, backup e execução real dos healthchecks.

## Roadmap por fases

Estimativas são **esforço relativo** (S/M/L/XL), não prazo. Dependências externas e disponibilidade de pessoas não foram estimadas.

### Fase 1 — Estabilização técnica

**Entregas:** alinhar Node à versão suportada; corrigir persistência parcial e repetição de importação; corrigir a origem da coordenada de fallback; revisar nomes/fallbacks; eliminar ambiguidade entre rotas existentes e planejadas; preparar testes de integração com PostgreSQL descartável e smoke autenticado.

**Dependências:** responsável técnico, contrato local de teste, aprovação para usar banco descartável e casos representativos sem dados de produção.

**Critérios de conclusão:** build backend/frontend reproduzível em Node suportado; CI verde incluindo migration chain; falhas de importação aparecem como parciais e são recuperáveis por repetição; login, autorização, dashboard, lead, funil e mapa passam por fluxo HTTP em ambiente de teste; dados de teste não atingem base real.

**Esforço relativo:** M para correções/automação, L se a preparação do ambiente de integração exigir infraestrutura nova.

### Fase 2 — Confiabilidade comercial

**Entregas:** inventário da fonte do cadastro e sua data; semântica separada para razão social/fantasia; estados explícitos de localização; reconciliador filial a filial da carteira; fila “não conciliado”; filtro de Places com categoria/situação; amostra de verificação humana e relatório de falsos positivos/falsos negativos.

**Dependências:** exportação oficial da carteira e do ERP, dono de cada campo, regra por filial/CNPJ, participação de vendedores para conferir amostra, autorização formal para eventuais consultas pagas individuais.

**Critérios de conclusão:** todos os registros expostos como cliente ou não cliente têm estado de conciliação e data de referência; nenhum ponto aproximado é anunciado como localização confirmada; resultados da amostra são registrados com método, período e denominador acordados.

**Esforço relativo:** L/XL; depende principalmente da qualidade e disponibilidade das fontes comerciais.

### Fase 3 — Infraestrutura

**Entregas:** decisão formal de hospedagem e titularidade das contas; provisionamento de staging; secrets; role de runtime mínima; plano de migration/rollback; backup e teste de restauração; logs/alertas; limites e custos monitoráveis; smoke de ponta a ponta.

**Dependências:** aprovação de orçamento, responsável de infraestrutura, acesso administrativo da Deusa, política de região/retensão e responsável por incidentes.

**Critérios de conclusão:** endpoint live/readiness comprovado, login/RBAC e leitura de carteira validados, migrations sem drift em staging, restore testado, secrets fora de imagem/cliente, rate limiting e monitoramento ativos, custo operacional aprovado.

**Esforço relativo:** M/L para reativar contas existentes; L/XL se for preciso migrar de provedor ou redesenhar acesso.

### Fase 4 — Piloto com a Deusa Alimentos

**Entregas:** grupo pequeno de usuários e escopo regional/comercial escolhidos pela Deusa; carteira e leads com origem/data; treinamento; registro de correções e resultados; processo manual de aprovação dos locais e do status de cliente.

**Dependências:** fases 1–3, usuários responsáveis, dataset autorizado e critérios de sucesso acordados antes de observar resultados.

**Critérios de conclusão:** usuários concluem os fluxos planejados; não há classificação “não cliente” sem reconciliação; falsos positivos e falhas são registrados; a Deusa aceita ou rejeita utilidade/qualidade com evidência documentada.

**Esforço relativo:** M, variável conforme quantidade de usuários e regiões escolhidas.

### Fase 5 — Produção

**Entregas:** liberação canary com imagem identificada por digest; aprovação formal; rollout gradual; rollback; escala de suporte; revisão de custos, backup e incidentes; política de atualização do cadastro e da carteira.

**Dependências:** gates de segurança, dados, testes, backup/restore e aceite do piloto; conta/provedor e orçamento operacionais.

**Critérios de conclusão:** checklist de [DEPLOY.md](../../DEPLOY.md), linhas 263–288, comprovado por evidências atuais; usuários autorizados conseguem login e consultar escopo correto; sinais e alertas observados após liberação; proprietário do produto aceita o risco residual.

**Esforço relativo:** M/L após todas as dependências. A estimativa não é cronograma.

## Decisões que dependem da Deusa

1. Qual exportação é a fonte oficial da carteira e qual data de corte deve valer?
2. A entidade comercial é CNPJ por filial, código do ERP, grupo econômico ou combinação revisada?
3. Como tratar conta sem CNPJ, CNPJ matriz, fechamento, transferência e cliente sem correspondência?
4. Quais CNAEs e regiões devem entrar no piloto? Quem valida cada amostra?
5. O Google Places será autorizado para chamadas individuais? Qual limite/orçamento e responsável por aprovar?
6. A Deusa pretende construir Deusa Direto neste projeto ou manter o link para uma loja externa?
7. Qual conta/cloud, região, plano de PostgreSQL, RTO/RPO, retenção e orçamento estão aprovados?
8. Quem será dono de operação, backup, suporte e decisão de rollback?
