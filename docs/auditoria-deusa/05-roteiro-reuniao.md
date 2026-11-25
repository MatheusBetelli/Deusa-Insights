# Roteiro para a reunião executiva

## Mensagem central

O projeto já materializa uma parte importante da proposta Deusa Analytics: existe uma aplicação web com autenticação, painel, leads, carteira comercial, importação e mapa. O código e os testes unitários sustentam essa afirmação. Ainda não há evidência suficiente para apresentar o sistema como operação ativa: a aplicação local não respondeu às sondagens, não foi conectado banco, não foi validado o dataset comercial atual e a infraestrutura de produção não foi consultada.

O Deusa Direto continua como proposta neste repositório. A referência encontrada é um link configurável para uma loja externa, sem fluxo de pedidos, catálogo, pagamento ou integração comprovada com a API do Analytics.

## Abertura sugerida

> “O objetivo do ecossistema era apoiar a prospecção e a gestão comercial da Deusa, com inteligência geográfica, e também avaliar um canal B2B digital. O que conseguimos comprovar no código é uma base de Analytics com painel, leads, carteira, autenticação e mapa. O canal Deusa Direto não está implementado neste repositório. A auditoria também encontrou limites de procedência e localização dos leads que impedem chamar toda oportunidade exibida de empresa confirmada ou de não cliente.”

## Sequência de apresentação

### 1. Problema comercial e escopo real

- Explicar que Analytics tenta apoiar localização, priorização e acompanhamento de estabelecimentos comerciais.
- Mostrar que o caminho presente é uma aplicação Deusa Analytics; citar painéis e módulos encontrados em `backend/src/app.module.ts`, linhas 25–61.
- Distinguir intenção de entrega: não apresentar Deusa Direto, rotas inteligentes, regiões prioritárias ou base de dados como módulos concluídos. As rotas relacionadas no frontend redirecionam para páginas já existentes; veja `01-diagnostico-tecnico.md`.

### 2. Como a solução foi construída

- Mostrar o caminho frontend → API NestJS → Prisma → PostgreSQL.
- Explicar que autenticação, regras de acesso e consulta ficam no backend; o browser não acessa o banco diretamente.
- Abrir a lista de módulos, o cliente HTTP, o schema e o endpoint do mapa seguindo a sequência em `06-codigo-para-demonstracao.md`.

### 3. O que já foi comprovado

- No snapshot auditado, `npm test` passou com 158 testes backend e 25 frontend; `npm run typecheck` e `npm run lint` também passaram.
- Esses resultados provam regras unitárias e integridade estática dentro do escopo executado. Não provam deploy, disponibilidade do banco, login ponta a ponta, qualidade real da lista de leads nem interface operacional no ambiente atual.
- As sondagens locais a `127.0.0.1:3001/health/live`, `:5173/login` e `:8080/login` retornaram `000`. Nenhum servidor foi iniciado para esta auditoria.

### 4. A dificuldade principal: confiança comercial

- Explicar que a prospecção no código filtra um CSV local da Receita Federal por município e CNAE. O CSV específico é ignorado pelo Git, não é baixado automaticamente e sua versão efetiva não foi comprovada.
- Mostrar a substituição de razão social por nome fantasia ou por `EMPRESA CNPJ …` quando faltam campos; isso é um placeholder cadastral, não um nome de loja confirmado.
- Explicar que o mapa deriva pontos de centroides municipais com jitter determinístico; o deslocamento melhora a apresentação visual, mas não revela o endereço real.
- Separar os conceitos: registro cadastral é uma linha de fonte; lead é uma oportunidade no sistema; localização validada requer evidência revisada; cliente confirmado exige conciliação com a carteira oficial e data de referência.
- O status “não cliente” decorre de não haver conta ativa vinculada. A ausência de correspondência não comprova ausência na carteira da Deusa.

### 5. Por que não há hospedagem demonstrável

- Descrever sem especular: o repositório contém configuração de Cloud Run, Supabase/PostgreSQL, Artifact Registry, Secret Manager e deploy canário manual. Isso comprova preparação documentada, não disponibilidade atual.
- O briefing informa indisponibilidade de hospedagem e de algumas integrações. A causa concreta — conta, cobrança, permissões, serviço, secrets ou outro motivo — é **não verificada** porque não se consultou a nuvem.
- Google Cloud (hospedagem dos containers) e Google Places (sugestão pontual para um registro existente) têm papéis diferentes. O segundo depende de chave, API, quota e custo; não foi testado.

### 6. Estado de produção

Apresentar a classificação **3 — adequado somente para demonstração ou homologação**. Os impedimentos são: ambiente e banco ativos não comprovados, procedência/atualidade dos leads não conciliada, classificação de não cliente insuficiente, restauração de backup não demonstrada e ausência de smoke autenticado em navegador. A classificação não significa que o código não funcione; significa que falta evidência para operação comercial segura.

### 7. Decisões que a Deusa precisa tomar

1. Qual arquivo/sistema é a fonte oficial da carteira e qual a data de corte?
2. Qual é a chave de correspondência comercial: CNPJ de filial, código do ERP, grupo econômico ou combinação revisada?
3. Quem valida uma amostra de leads e endereços e qual resultado torna um registro apto para prospecção?
4. Quais regiões e CNAEs entram em um piloto controlado?
5. A empresa autoriza consultas individuais via Google Places? Qual limite, orçamento e responsável por aprovar?
6. A proposta Deusa Direto será construída neste projeto ou seguirá como produto/loja externa?
7. Qual organização será titular da hospedagem, banco, domínio e credenciais, e quem cuidará de backups e incidentes?
8. Qual orçamento e nível de disponibilidade a empresa está disposta a sustentar?

### 8. Encerramento sugerido

> “A recomendação é não abrir o Analytics para uso comercial amplo ainda. O próximo passo é a Deusa aprovar a fonte e as regras de conciliação da carteira, escolher uma amostra regional de validação e designar um responsável pela infraestrutura. Com isso, podemos corrigir o fluxo de importação, demonstrar a qualidade medida e preparar um piloto isolado. A entrada em produção depende de critérios técnicos e comerciais verificáveis, não apenas de recolocar um site no ar.”

## Demonstração prática realista

### Se não houver ambiente integrado antes da reunião

1. Apresentar este relatório e mostrar os testes/typecheck/lint já executados, sem os descrever como validação de produção.
2. Fazer um walkthrough dos arquivos da sequência em `06-codigo-para-demonstracao.md`.
3. Mostrar o relatório histórico agregado de qualidade dos dados, identificando-o como retrato de 05/07/2026 e sem abrir CSVs, nomes, CNPJs ou endereços.
4. Mostrar o manual e o workflow canário como documentação de infraestrutura preparada, sem afirmar que foram executados.
5. Encerrar dizendo explicitamente que a UI integrada e os serviços atuais não foram demonstrados.

### Se a equipe preparar uma homologação antes da reunião

- Usar banco descartável ou staging autorizado, usuário de demonstração e conjunto sintético ou previamente aprovado/anonimizado; não conectar a um `.env` de produção desconhecido.
- Fazer o preflight de versão Node suportada, migrations no staging, login/logout, escopo por papel, resumo de painel, lead, mapa e limites de erro.
- Demonstrar origem/estado de precisão de cada pino. Omitir do exercício qualquer registro cujo nome, existência ou status de carteira não tenha sido validado.
- Registrar no roteiro quais verificações foram feitas, com data e ambiente. Até esse preflight ocorrer, a homologação é apenas uma possibilidade, não um fato.

## Frases para perguntas difíceis

| Pergunta | Resposta baseada em evidência |
|---|---|
| “Os leads são empresas reais?” | “O código transforma registros de um CSV cadastral em leads. Não confirmamos aqui a versão nem a existência física/atividade atual de cada estabelecimento; cada registro precisa de validação proporcional ao uso.” |
| “O sistema sabe quem não é cliente?” | “Ele marca cliente quando encontra conta ativa vinculada. Sem correspondência não significa que a pessoa jurídica esteja ausente da carteira. Precisamos conciliar a carteira oficial por uma chave aprovada.” |
| “Por que o sistema está fora do ar?” | “A hospedagem não está disponível conforme o contexto do projeto, mas a causa exata não foi verificada. O código contém configuração de Cloud Run e banco gerenciado; não consultamos a conta.” |
| “O Google encontra novos mercados?” | “A descoberta em lote usa arquivo local. Places tem código para sugerir até cinco candidatos em uma consulta individual a uma empresa existente, sob confirmação explícita e chave configurada; não foi chamado nesta auditoria.” |
| “Podemos começar a usar?” | “O código está adequado para demonstração/homologação. Ainda não há evidência suficiente para uso comercial amplo nem piloto com dados operacionais sem antes conciliar carteira, qualificar registros e validar ambiente.” |

## Materiais para levar

- Os seis documentos desta pasta.
- Snapshot de repositório auditado: branch `main`, commit `e42998e`.
- Acesso ao código sem abrir arquivos `.env` nem registros comerciais identificáveis.
- Uma planilha de decisões da seção 7, para registrar responsável, decisão e pendência, sem preencher respostas presumidas.
