# Código para demonstrar na reunião

## Como usar este roteiro

Abra os arquivos nesta ordem. As linhas são referências ao snapshot `e42998e` auditado; se o código mudar antes da reunião, confira novamente as linhas. Não abra arquivos `.env`, não mostre tokens nem cadastros reais. A demonstração explica o desenho e as regras implementadas, mas não comprova que os serviços estejam operacionais hoje.

## Sequência recomendada

### 1. Mapa geral dos módulos do backend

- **Arquivo:** `backend/src/app.module.ts`, linhas 25–61.
- **Classe/configuração:** `AppModule`, lista de `imports` e provedores globais.
- **O que faz:** registra módulos de autenticação, empresas, leads, importação, dashboard, mapa, pipeline e auditoria/throttling.
- **Por que mostrar:** dá uma visão rápida da organização do sistema e prova que Analytics tem uma API estruturada em módulos.
- **Explicação simples:** “Esta é a lista das áreas da API. Cada área trata um pedaço do trabalho comercial e elas compartilham os serviços comuns.”
- **Limitação:** módulo registrado não prova fluxo integrado nem endpoint disponível; alguns nomes de funcionalidades no produto são redirecionamentos e não módulos próprios.

### 2. Comunicação do frontend com a API

- **Arquivo:** `frontend/src/services/api.ts`, linhas 14–51 e 69–117.
- **Funções:** `buildUrl` e cliente de requisições HTTP.
- **Complemento:** `frontend/src/server.ts`, linhas 18–87, proxy SSR `/api/*` para `BACKEND_ORIGIN`.
- **O que faz:** resolve a URL da API, restringe caminho à origem configurada e envia chamadas do frontend; na configuração de produção o SSR pode encaminhar chamadas ao backend.
- **Por que mostrar:** explica como a tela conversa com a API sem falar diretamente com PostgreSQL.
- **Explicação simples:** “O navegador pede dados ao servidor da aplicação. O servidor encaminha a solicitação à API, que aplica as regras e consulta o banco.”
- **Limitação:** URLs e proxy configurados não provam que os serviços respondam. O frontend e backend não responderam às sondagens locais nesta auditoria.

### 3. Estrutura de dados comerciais

- **Arquivo:** `backend/prisma/schema.prisma`, linhas 147–229 (`Company`), 245–270 (`ClientAccount`), 273–302 (`Lead`), 303–344 (`LeadInteraction` e `ImportJob`).
- **Modelos:** `Company`, `ClientAccount`, `Lead`, `LeadInteraction`, `ImportJob`.
- **O que faz:** separa cadastro da empresa, relação com a carteira, oportunidade comercial, interações e histórico de importação.
- **Por que mostrar:** torna visível que empresa, lead e cliente são conceitos diferentes no banco.
- **Explicação simples:** “Uma empresa pode estar cadastrada, virar uma oportunidade acompanhada e também ter um vínculo com a carteira. São registros relacionados, mas não significam a mesma coisa.”
- **Limitação:** schema descreve estrutura, não garante que as migrations correspondentes estejam aplicadas no banco atual nem que os vínculos comerciais estejam completos.

### 4. Login e controle de sessão

- **Arquivo:** `backend/src/auth/auth.controller.ts`, linhas 13–42.
- **Método:** `AuthController.login`, helper `getAuthCookieOptions`.
- **Complemento:** `backend/src/auth/auth.guard.ts`, linhas 49–95, `AuthGuard.canActivate`.
- **O que faz:** define cookie `HttpOnly`, `Secure` em produção, `SameSite`; valida token JWT e verifica se a conta continua ativa e se a sessão não foi invalidada.
- **Por que mostrar:** demonstra que a autenticação e a verificação de acesso são aplicadas no servidor.
- **Explicação simples:** “Ao entrar, o sistema entrega uma sessão protegida. Em cada área restrita, a API verifica se a sessão ainda é válida e se a conta pode usar o sistema.”
- **Limitação:** controles no código e testes unitários não equivalem a login real no browser nem a auditoria de segurança. Não há comprovação de configuração atual dos segredos, cookies e domínio.

### 5. Fonte de prospecção e nomes de fallback

- **Arquivo:** `backend/src/imports/providers/receita-federal.provider.ts`, linhas 188–216, 223–253, 264–302 e 416–449.
- **Métodos:** `onModuleInit`, `getCsvPath`, `ensureCache`, `getApproximateCoords`, `mapRowToCompany`, `searchCompaniesByCityAndCnae`.
- **O que faz:** procura um CSV local, cria um índice em memória, filtra por município/CNAE e converte as linhas em cadastros. Se o nome fantasia está vazio, `razaoSocial` recebe `EMPRESA CNPJ …`; se existe, copia o nome fantasia.
- **Por que mostrar:** responde com evidência à questão de como os estabelecimentos são encontrados e de onde vem o nome exibido.
- **Explicação simples:** “O sistema não pesquisa toda a internet. Ele lê um arquivo cadastral que precisa estar disponível e procura os registros que combinam com a cidade e a atividade escolhidas.”
- **Limitações a declarar:** o arquivo é local e não está no Git nem na imagem backend; sua data/procedência efetiva não foram verificadas. A razão social mapeada pode ser apenas nome fantasia ou placeholder, não o nome legal confirmado. O CNPJ/cadastro não confirma operação física atual.

### 6. Coordenadas aproximadas

- **Arquivo:** `backend/src/imports/providers/receita-federal.provider.ts`, linhas 264–291.
- **Métodos:** `deterministicJitter`, `getApproximateCoords`.
- **Complemento:** `backend/src/map-opportunities/map-opportunities.service.ts`, linhas 576–592, fallback de centroide.
- **O que faz:** parte de um centroide municipal e desloca o pino de forma determinística pelo CNPJ; o comentário no próprio método diz que é apenas visual e não representa o ponto real.
- **Por que mostrar:** é uma limitação comercial crítica para qualquer leitura de rota, visita ou endereço.
- **Explicação simples:** “Quando não temos coordenada exata, o mapa espalha o ponto perto do centro da cidade para evitar sobreposição. Esse ponto não indica onde a loja fica.”
- **Limitação:** o mapa deve exibir a precisão claramente; esses pontos não podem ser apresentados como endereço visitável. O fallback do mapa também merece revisão porque rotula o centroide como `municipio_centroide_jitter`.

### 7. Importação da carteira e correspondência com empresa

- **Arquivo:** `backend/src/imports/imports.service.ts`, linhas 390–471.
- **Métodos:** `processClientImportRow`, `persistClientImport`.
- **O que faz:** normaliza a linha, procura empresa por CNPJ, procura conta pelo código comercial, relaciona quando encontra, registra quando fica sem vínculo e grava `isCurrentClient: true`.
- **Por que mostrar:** apresenta o mecanismo real que cruza o arquivo comercial da Deusa com empresas prospectadas.
- **Explicação simples:** “A importação tenta relacionar a conta da Deusa com o cadastro pelo CNPJ ou pelo vínculo já existente. Quando não encontra, mantém a conta sem ligação automática.”
- **Limitações:** conta sem `companyId` não será reconhecida pelo mapa como cliente vinculado à empresa. O código define o registro importado como atual; não foi encontrado no backend um processo que marque como inativa a conta ausente de uma nova importação. A regra do snapshot versus atualização incremental precisa ser aprovada pela Deusa.

### 8. Regra do mapa para cliente versus oportunidade

- **Arquivo:** `backend/src/map-opportunities/map-opportunities.service.ts`, linhas 480–544 e 595–629.
- **Método:** `MapOpportunitiesService.findAll`.
- **Complemento:** `backend/src/common/opportunity-filter.ts`, linhas 321–351.
- **Endpoint:** `backend/src/map-opportunities/map-opportunities.controller.ts`, linhas 102–133; `GET /map/opportunities` exige autenticação e há endpoint `GET /map/heatmap`.
- **O que faz:** consulta leads, aplica filtros de status, CNAE e área urbana, seleciona vínculos de clientes ativos e monta os pontos retornados.
- **Por que mostrar:** é o elo que transforma registros e regras em dados que a tela do mapa pode exibir.
- **Explicação simples:** “A API seleciona os registros que atendem às regras, consulta se há uma conta de cliente ligada e prepara os dados para o mapa.”
- **Limitação:** ausência de conta ativa vinculada resulta em `isClient` falso; isso não comprova que a empresa esteja fora da carteira. Há cache em memória por instância, não distribuído.

### 9. Tela do dashboard e do mapa

- **Dashboard:** `frontend/src/routes/_app/dashboard.tsx`, linhas 176–225; carrega resumo via `dashboardService.getSummary` e trata estados de busca/erro.
- **Mapa:** `frontend/src/routes/_app/mapa-oportunidades.tsx`, linhas 365–425 (filtros e consulta) e 567–574 (tiles do OpenStreetMap).
- **O que faz:** conecta filtros visuais com os serviços de API e desenha a camada cartográfica.
- **Por que mostrar:** traduz a arquitetura backend para as telas que a equipe comercial usaria.
- **Explicação simples:** “O painel e o mapa não criam os dados: enviam filtros para a API e apresentam a resposta.”
- **Limitação:** as telas não foram verificadas em navegador nesta auditoria; o fundo do mapa depende de acesso à internet e as coordenadas podem ser aproximadas. Não mostrar dados comerciais identificáveis sem autorização.

### 10. Sugestão individual pelo Google Places

- **Arquivo:** `backend/src/companies/companies.service.ts`, linhas 70–75, 315–343, 345–419 e 1106–1185.
- **Métodos/funções:** `checkNameSimilarity`, `searchGooglePlaces`, `buildLocationCandidate`, `CompaniesService.getLocationCandidates`.
- **Endpoint:** `backend/src/companies/companies.controller.ts`, linhas 126–141.
- **O que faz:** para uma empresa já cadastrada, monta consulta com nome/endereço e pode obter até cinco candidatos; exige `confirmPaidRequest === true` e chave configurada.
- **Por que mostrar:** esclarece a diferença entre “descobrir leads” e “sugerir lugar para revisar” e evidencia a barreira contra chamada paga acidental.
- **Explicação simples:** “Para uma empresa que já temos, o sistema pode procurar lugares parecidos e sugerir opções para revisão humana.”
- **Limitações:** a integração não foi chamada. Candidato não é confirmação. A semelhança inclui regra simples de prefixo de cinco caracteres; categoria incompatível gera alerta, mas não necessariamente exclui candidato. A API requer configuração, quota, faturamento e custo a serem confirmados pela Deusa.

### 11. Infraestrutura preparada

- **Manual:** `DEPLOY.md`, linhas 7–24 e 81–101.
- **Workflow:** `.github/workflows/deploy-production-canary.yml`, linhas 1–40, 49–119 e 142–161.
- **Container:** `backend/Dockerfile`, linhas 20–23 e 36–60; `frontend/Dockerfile`, linhas 1–36.
- **O que faz:** documenta frontend/backend em containers, PostgreSQL gerenciado e um fluxo manual que valida CI e publica canário sem tráfego.
- **Por que mostrar:** permite explicar como se pretendia hospedar e quais passos existem para voltar a construir o ambiente.
- **Explicação simples:** “O repositório contém instruções e automação para empacotar e preparar uma versão de teste. Isso é um plano implementado como código, mas não comprova que a nuvem esteja ativa.”
- **Limitação:** deploy não foi executado; contas, secrets, banco, domínio, logs, backups, custos e último estado do workflow são **não verificados**. O container backend não copia o CSV de prospecção.

## Trechos que não devem ser apresentados como entrega concluída

- Deusa Direto: não há módulo de pedido/checkout; `frontend/src/features/leads/components/LeadDetailsSheet.tsx`, linha 51, apenas define URL de loja externa configurável.
- Rotas inteligentes, regiões prioritárias, recomendações e base de dados: arquivos de rota redirecionam para telas existentes; ver links e classificação em `01-diagnostico-tecnico.md`.
- Google Places: não mostrar como integração operacional sem chave autorizada, chamada controlada, resultado revisado e evidência de custo/quota.
- Mapa: não chamar pontos derivados de centroide de endereços confirmados.
- Carteira: não chamar todos os registros sem vínculo de “não clientes confirmados”.

## Percurso resumido para abrir durante a reunião

1. `backend/src/app.module.ts` — organização da API.
2. `frontend/src/services/api.ts` e `frontend/src/server.ts` — ligação frontend/backend.
3. `backend/prisma/schema.prisma` — empresa, lead, cliente e interação.
4. `backend/src/auth/auth.controller.ts` e `auth.guard.ts` — sessão e autorização.
5. `backend/src/imports/providers/receita-federal.provider.ts` — CSV, fallback do nome e coordenadas.
6. `backend/src/imports/imports.service.ts` — importação e vínculo da carteira.
7. `backend/src/map-opportunities/map-opportunities.service.ts` e `opportunity-filter.ts` — regras do mapa e status de cliente.
8. `frontend/src/routes/_app/dashboard.tsx` e `mapa-oportunidades.tsx` — experiência de tela.
9. `backend/src/companies/companies.service.ts` — Places individual, opcional e pago.
10. `DEPLOY.md`, Dockerfiles e workflow canário — infraestrutura planejada e estado não verificado.
