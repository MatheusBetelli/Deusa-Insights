# QA do Deusa Insights: prontidão para produção e próximos passos

**Data de corte:** 19/11/2026

**Código auditado:** branch **main**, commit **df91a8e**
**Decisão:** não liberar para uso comercial amplo em produção. O código compila e os checks locais passam, mas foram encontrados bloqueadores de segurança, confiabilidade dos dados e operação que ainda não têm evidência de fechamento.

## Resumo executivo

O Deusa Insights tem uma base de aplicação real: frontend React/TanStack, API NestJS, PostgreSQL/Prisma, autenticação e papéis, painel, carteira, leads, atividades comerciais, funil, importações e mapa. Há boa cobertura de regras de backend e controles no código para autenticação, autorização e congelamento dos dados.

O projeto pode ser usado para demonstração local restrita, com dados sintéticos. Homologação acessível externamente depende primeiro da correção das vulnerabilidades críticas/altas e da configuração de um ambiente isolado. Ainda não há evidência suficiente para declarar a operação pronta em produção:

- A auditoria de dependências de produção encontrou **16 vulnerabilidades**: 7 críticas, 5 altas e 4 moderadas.
- A classificação de cliente e a precisão de localização ainda dependem de conciliação e validação comercial; falta de vínculo não prova que a loja não seja cliente, e parte dos pontos representa centroide municipal.
- A descoberta de estabelecimentos depende de CSV local que não está no Git nem na imagem backend. A importação regional pode registrar sucesso parcial como sucesso e não reparar um lead ausente ao repetir a mesma empresa.
- Não foram verificados o banco de produção, o estado de migrations, as contas de nuvem, os segredos, o envio de e-mail, os backups, a restauração, o domínio, os alertas nem o rollout.
- Existem workflows de CI, migration controlada e canário sem tráfego. A existência dos workflows não comprova execução bem-sucedida nem ambiente ativo.
- “Deusa Direto” não está implementado neste repositório como catálogo, pedido, checkout ou integração comercial. Deve ser estimado como produto separado.

## Escopo e evidência

Esta rodada foi somente de auditoria e documentação. Não houve alteração de código ou de dados, consulta ao banco, migration, seed, importação de carteira/leads, chamada a Google Places/Tavily, acesso à nuvem ou deploy. O conteúdo dos arquivos de .env não foi inspecionado nem exibido. O Prisma CLI informou que carregou o arquivo .env durante a validação; as URLs de teste foram passadas explicitamente, e nenhuma conexão foi feita ao banco.

| Verificação | Resultado desta rodada | Limite |
|---|---|---|
| Testes backend | 158 aprovados | Testes automatizados locais; não provam PostgreSQL de produção |
| Testes frontend | 25 aprovados | Predominam checks de utilitários/contratos; não substituem uso visual da aplicação |
| Typecheck e lint | Passaram nos dois pacotes | Não provam runtime nem dados |
| Dead code e higiene do repositório | Passaram | A higiene verifica arquivos rastreados e regras do repositório |
| Build de produção | Backend e frontend passaram; artefato Node/Cloud Run aprovado | Executado em cópia temporária do commit para preservar backend/dist e frontend/.output existentes |
| Prisma validate | Schema válido | URLs falsas de teste; não houve conexão ao banco nem verificação de migrations aplicadas |
| npm audit de produção | Raiz: 0; backend: 7; frontend: 9 vulnerabilidades | Resultado referente aos lockfiles e à base de advisories consultada em 19/11/2026 |
| HTTP local | :3001/health/live e :5173/login responderam 200; :8080/login não respondeu | Prova local e pontual, não prova deploy ou saúde do banco |
| UI no navegador e E2E autenticado | Não validados | A ponte de navegador não estava disponível; não foram usados credenciais de teste |

O Node padrão do shell é 22.12.0, abaixo da exigência ^22.13.0 ou >=24.0.0. As verificações foram executadas com o Node 22.23.3 instalado localmente, que atende ao requisito. O .nvmrc fixa somente a versão principal 22.

Os documentos 01–06 desta pasta foram produzidos no snapshot e42998e. A comparação até df91a8e mostra apenas remoção de emojis em comentários da lista de CNAEs, sem alteração de comportamento. Esta página registra a evidência adicional desta rodada, inclusive a auditoria atualizada de dependências.

## QA funcional por área

| Área | Estado observado | Próxima solução |
|---|---|---|
| Login, sessão, recuperação e papéis | Implementados; regras unitárias cobertas | Validar login/recuperação por HTTP e browser em staging; testar permitido e negado para administrador, gerente e vendedor |
| Dashboard, carteira, leads, atividades e follow-up | APIs e telas existem; regras backend têm testes | Validar a mesma amostra nos módulos, com PostgreSQL descartável e usuário de cada papel |
| Funil comercial | Existe e tem regras de consistência cobertas | Confirmar contagens e eventos contra uma amostra aprovada pela Deusa |
| Importação de carteira | Há normalização, upsert e estados de conciliação | Aprovar se a fonte é snapshot ou delta antes de qualquer baixa automática; revisar conflitos e registros sem vínculo |
| Descoberta de leads | Usa arquivo local da Receita Federal, filtrado por cidade/CNAE | Definir fonte, versão e política de ingestão; manter mutação congelada até aprovação e teste de reconciliação |
| Google Places | Sugestão individual para empresa já cadastrada, com confirmação explícita de chamada paga | Tratar resultado como candidato, restringir por orçamento e manter revisão humana; não usar para varredura ou enriquecimento em lote |
| Mapa | API e tela existem; há fallback de centroide/jitter | Exibir precisão e origem da coordenada; impedir que estimativa seja interpretada como endereço para visita |
| Mapa de calor, rotas, regiões, recomendações e “base de dados” | Algumas rotas redirecionam para telas existentes, sem módulo independente | Marcar como planejadas ou implementar com critérios próprios antes de vender como funcionalidade entregue |
| Deusa Direto | Não encontrado como fluxo de pedidos dentro deste repositório | Confirmar se será produto separado ou link externo; fazer discovery antes de estimar implementação |

## Bloqueadores prioritários e solução recomendada

### P0 — Dependências de produção vulneráveis

A execução de npm audit --omit=dev identificou no backend: proxy-addr@2.0.7 (crítica), body-parser@2.3.0 e multer@2.3.0 (altas), js-yaml@5.3.0 e qs@6.16.0 (moderadas). No frontend: dependências TanStack Start, seroval@1.5.4 (críticas), vite@7.3.5, source-map-js@1.2.1 e zod@4.4.3 (altas). O workflow de CI executa auditoria de produção, portanto este resultado tende a bloquear o gate de CI para os lockfiles atuais.

**Solução:** atualizar as dependências afetadas e lockfiles de forma direcionada; evitar um npm audit fix cego. Em seguida, repetir audit, testes, typecheck, lint, build, Docker builds e smoke do SSR. Meta para liberação: zero vulnerabilidades críticas/altas sem exceção formal documentada e mitigação aceita.

### P0 — Verdade comercial e precisão dos dados

- O mapa considera cliente quando encontra uma conta ativa vinculada. Um lead sem vínculo pode ser cliente da Deusa que ainda não foi conciliado.
- Parte das coordenadas é centroide municipal com deslocamento visual, não endereço do estabelecimento.
- O provider pode preencher razaoSocial com nome fantasia ou placeholder quando o dado está ausente.
- A importação regional pode fechar o job como sucesso mesmo quando itens falham; uma repetição pode ignorar o lead se a empresa já existir.
- A importação de carteira marca as linhas recebidas como atuais; a regra para contas ausentes depende de definir se o arquivo é snapshot ou delta.

**Solução:** aprovar a chave filial a filial (CNPJ/código ERP), a data de corte e a semântica da fonte; separar estados “cliente confirmado”, “não conciliado” e “prospect”; separar razão social e nome fantasia; guardar origem/data/precisão da coordenada; tornar a importação regional recuperável e mostrar falhas parciais. Não rodar essas mudanças sobre a base congelada sem autorização específica da Deusa.

### P0 — Operação de produção ainda não comprovada

O código contém Cloud Run, PostgreSQL/Supabase, Secret Manager, migrations protegidas, CI e publicação canário sem tráfego. Não foi consultada a conta de nuvem, a configuração atual, o banco remoto ou a execução dos workflows. O container PostgreSQL local estava saudável, mas o alvo configurado pela API não foi confirmado e o endpoint de readiness não foi chamado.

**Solução:** primeiro obter um staging sob titularidade da Deusa; verificar roles e acesso mínimo do banco; aplicar migrations somente após revisão e backup; testar restauração; configurar logs/alertas, domínio, HTTPS, e-mail, quotas, custo e rollback; então executar smoke autenticado e canário sem tráfego. Só promover depois do aceite.

### P1 — Testes integrados e experiência visual

Os 183 testes unitários passaram, mas o fluxo autenticado com banco, navegador real, estados de erro e layout em celular/tablet/desktop não foi comprovado. O E2E existente é dependente de credenciais e serviços configurados. A inspeção visual também não ocorreu nesta rodada.

**Solução:** adicionar E2E em staging com banco e contas descartáveis; cobrir login, permissões, resumo, busca de lead, atividade/follow-up, funil, mapa, erro de API e sessão expirada; validar teclado, foco, contraste, overflow e breakpoints em três larguras.

## Estimativa de esforço para deixar o Analytics pronto para produção

Estimativa em horas-pessoa, para implementação, QA e preparação técnica do Analytics existente. Não é cotação da Appfy nem cronograma garantido. Assume acesso a pessoas responsáveis, amostra comercial aprovada e ausência de migração grande de provedor.

| Fase | Entrega principal | Horas da equipe |
|---|---|---:|
| 0. Decisões e discovery técnico | Escopo do piloto, donos, fonte comercial, critérios de aceite e configuração do ambiente | 8–16 h |
| 1. Segurança | Corrigir lockfiles/advisories e validar compatibilidade, CI e imagens | 16–24 h |
| 2. Confiabilidade comercial | Estados de conciliação/localização, procedência, importação parcial e repetível, testes de regressão | 48–72 h |
| 3. Fluxo integrado e interface | PostgreSQL descartável, testes HTTP/E2E por papel e revisão visual/responsiva | 40–64 h |
| 4. Staging e operação | Configuração, secrets, migration gate, backup/restore, logs, alertas, limites e runbook | 32–48 h se as contas/serviços existirem |
| 5. Piloto e liberação | Aceite dos usuários, canário, smoke, observação e rollback | 16–24 h |

**Total da equipe técnica:** 160–248 h se a infraestrutura já existir. Se for necessário provisionar uma nova conta/ambiente ou reconstruir a topologia, acrescentar **24–48 h**.

**Participação estimada da Deusa:** mais **16–32 h** para decisões, conciliação de amostra e aceite comercial.

**Total indicativo:** 176–280 h com infraestrutura pronta; 200–328 h se houver novo provisionamento.

Ficam fora: custo de nuvem/banco/e-mail, correção manual de milhares de registros, espera por acessos e aprovações, pentest contratado e implementação do Deusa Direto. O escopo de Deusa Direto precisa de discovery separado antes de estimar construção.

## Appfy e Tavily

### Appfy

Interpretei “Appfy” como **appfy.ai**, que se apresenta como fornecedora de engenharia de produto e execução de marketing, incluindo construção, integração e retomada de projetos. O site anuncia conversa inicial de 30 minutos e Action Map; não publica preços e informa que o investimento e o prazo vêm numa proposta após delimitar o escopo. Isso faz da Appfy uma possível **fornecedora de execução**, não uma dependência técnica a instalar no Analytics. As afirmações sobre equipe, clientes e capacidade são do próprio site e não foram verificadas independentemente.

**Como avaliar:** pedir proposta escrita por fase, entregáveis, horas/tarifas ou teto, critérios de aceite, pessoa responsável, titularidade do código, acesso ao repositório, suporte, segurança, tratamento de dados, propriedade intelectual e plano de saída. Comparar a proposta com as faixas deste relatório. Para a conversa inicial, usar exemplos sintéticos; não enviar .env, credenciais, exportação da carteira ou dados de clientes. O aviso de privacidade da Appfy descreve coleta de dados do formulário e do chat.

Fontes: [serviços e FAQ da Appfy](https://www.appfy.ai/) e [aviso de privacidade](https://appfy.ai/privacy/).

### Tavily

Tavily oferece uma API de busca web voltada a aplicações de IA. Pode ajudar em pesquisa manual de uma empresa já existente e devolver URLs para revisão. **Não substitui Receita Federal, ERP, carteira comercial nem geocodificação oficial**; um resultado de busca não confirma existência atual, endereço, relação de cliente ou adequação comercial.

O preço público consultado lista 1.000 créditos gratuitos por mês; uma busca Basic custa 1 crédito e Advanced custa 2. No uso pay-as-you-go, a página lista US$ 0,008 por crédito; 100 buscas Basic custariam aproximadamente US$ 0,80 antes de impostos/câmbio e sem extrações. São valores publicados pelo fornecedor em 19/11/2026, sujeitos a mudança. Fontes: [créditos e preços](https://docs.tavily.com/documentation/api-credits) e [API de busca](https://docs.tavily.com/documentation/api-reference/endpoint/search).

Há uma ressalva de privacidade que impede enviar dados reais sem revisão contratual: a política informa que queries/documentos são processados e que partes das queries podem ser usadas para melhorar respostas, salvo se o contrato especificar o contrário; os termos da AI Functionality autorizam uso/retenção de inputs e outputs para treinamento e mencionam fornecedores terceiros. Portanto, antes de qualquer integração, a Deusa deve aprovar o caso de uso e revisar contrato/DPA, retenção, região e subprocessadores. Não enviar contatos pessoais, dados internos, credenciais ou listas de clientes. Fontes: [política de privacidade](https://www.tavily.com/privacy) e [termos da plataforma](https://www.tavily.com/terms).

**Recomendação:** não usar Tavily para descobrir ou enriquecer leads em lote. Se houver necessidade real, estimar um piloto separado de **16–24 h**, restrito a um registro pendente por vez, backend-only, limite de orçamento/consultas, fonte permitida, URL/data/evidência registradas, revisão humana e sem mutação automática do dataset. Nenhuma chamada foi realizada nesta auditoria.

Se “Appfy” queria dizer **Apify**, é outro produto: uma plataforma de Actors para scraping, extração e automação em nuvem, com cobrança variável por plano/uso e por Actor. Não está incluída como recomendação para descoberta ampla, que conflita com o congelamento do dataset e exigiria avaliação legal, de fonte e custo. [Documentação oficial do Apify](https://docs.apify.com/get-started).

## Critérios objetivos para declarar produção

1. CI verde para o SHA que será lançado, incluindo audit, testes, build e cadeia de migrations em PostgreSQL descartável.
2. Zero vulnerabilidade crítica/alta sem exceção aprovada e documentada.
3. Staging validado por navegador: login, papéis permitidos/negados, painel, lead, atividade/follow-up, carteira e mapa.
4. Cada registro apresentado como cliente, prospect ou localização confirmada tem estado, procedência, data e critério aprovados; “não conciliado” nunca vira “não cliente”.
5. Migration aplicada por identidade dedicada, backup confirmado e restauração testada; RTO/RPO e retenção aprovados.
6. Segredos fora do repositório, imagem e browser; HTTPS, CORS/cookie, e-mail e limites verificados no domínio real.
7. Logs, alertas, responsável por incidente e rollback testados; custo mensal e dono operacional aprovados.
8. Piloto comercial aceito pela Deusa antes de aumentar tráfego ou ativar operações de dados.

## Recomendação para apresentar à empresa

Apresentar o Analytics como **base funcional em preparação para homologação**, não como produção pronta. A proposta é liberar recursos em duas frentes: primeiro remover o bloqueador de segurança e consolidar os dados/estados comerciais; em paralelo preparar staging e automação de testes; depois executar um piloto com pequena equipe e aceite formal; por fim promover o canário com operação, backup, observabilidade e rollback comprovados. Não incluir Deusa Direto nem pesquisa Tavily em lote no orçamento do Analytics até serem aprovados como escopos próprios.

Para o detalhamento anterior de arquitetura e evidências por arquivo, consulte os documentos 01–06 desta pasta. Este relatório é a versão executiva atualizada para as verificações feitas no commit df91a8e.
