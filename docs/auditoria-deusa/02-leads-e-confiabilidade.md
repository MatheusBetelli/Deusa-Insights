# Leads, carteira comercial e confiabilidade dos dados

## Resposta direta

O projeto não executa hoje uma descoberta geral de mercados via Google. O caminho de prospecção implementado lê um arquivo local no layout ESTABELE da Receita Federal, filtra por município e CNAE e transforma registros em empresas e leads. A busca do Google Places é uma consulta individual a candidatos para uma empresa que já existe no banco, condicionada à confirmação de uma chamada paga. Nenhuma consulta externa ou importação foi executada nesta auditoria.

O código **não adivinha um nome real de mercado quando o nome fantasia está ausente**. Ele usa o nome fantasia cadastrado quando disponível e, quando não há, escreve o placeholder `EMPRESA CNPJ <número>` em `razaoSocial`. Porém, quando existe nome fantasia, esse mesmo valor é copiado para `razaoSocial`; portanto o campo legal não representa necessariamente a razão social oficial. A regra está em [receita-federal.provider.ts](../../backend/src/imports/providers/receita-federal.provider.ts), linhas 293–302.

## Fluxo de captação atual

```text
CSV ESTABELE local, com CNAE e UF escolhidos
        ↓
cache em memória por código municipal TOM
        ↓
filtro por município, CNAE e limite solicitado
        ↓
upsert da empresa por CNPJ e tentativa de upsert do lead
        ↓
filtros de situação, CNAE, município, localização e carteira
        ↓
dashboard, lista de leads e mapa
```

O provider procura o arquivo `dadosCNAE/sp_4712100_estabelecimentos.csv` em caminhos locais e falha se não o encontrar em [receita-federal.provider.ts](../../backend/src/imports/providers/receita-federal.provider.ts), linhas 200–216. Carrega e indexa linhas em memória, linhas 223–253, e pesquisa pela cidade e CNAE, linhas 416–449. O endpoint de importação cria um job, chama esse provider, grava empresas e leads e salva um status em [imports.service.ts](../../backend/src/imports/imports.service.ts), linhas 257–343.

Esse CSV local não é baixado nem atualizado por código. Os arquivos CSV existentes no workspace estão ignorados pelo Git ([.gitignore](../../.gitignore), linha 54) e não fazem parte do conteúdo rastreado pelo repositório. A imagem backend copia código e schema, mas não os dados CSV ([backend/Dockerfile](../../backend/Dockerfile), linhas 20–23 e 36–40; o workflow constrói com contexto `backend/` em [.github/workflows/ci.yml](../../.github/workflows/ci.yml), linhas 118–124). Em produção, a mutação do dataset é intencionalmente desligada e o provider não pré-carrega os dados; veja [dataset-freeze.guard.ts](../../backend/src/common/dataset-freeze.guard.ts), linhas 28–39 e 70–103, e [receita-federal.provider.ts](../../backend/src/imports/providers/receita-federal.provider.ts), linhas 188–197.

O relatório local de qualidade identifica a fonte como CSV ESTABELE de CNAE 4712100 em São Paulo e foi gerado em 05/07/2026. Ele registra 23.348 linhas analisadas, 13.230 sem nome fantasia, 22.248 sem coordenada municipal conhecida, 23.348 pendentes de validação manual e zero endereços verificados ([analysis_quality_report.md](../../dadosCNAE/analysis_quality_report.md), linhas 1–14, 27–43 e 53–62). Esses números são **do relatório histórico**, não foram recalculados nesta auditoria e não provam qualidade atual. Não foram lidas linhas do CSV nem os arquivos de leads.

O script de preparação aceita cinco CNAEs comerciais e, por padrão, filtra somente 4712100; veja [filter_cnpjs.py](../../dadosCNAE/filter_cnpjs.py), linhas 7–10 e 18–24, 96–103. Embora o provider aceite um CNAE solicitado, a cobertura efetiva dos demais códigos depende do CSV fornecido. Não há evidência, no repositório rastreado, de que arquivos atuais para todos os CNAEs estejam presentes no artefato de produção.

## Origem e natureza de cada campo

| Informação | Como o código a obtém | O que pode ser afirmado | Limite / inferência |
|---|---|---|---|
| CNPJ | Concatena os campos de raiz, ordem e dígitos do CSV e valida dígito verificador | O CNPJ pode corresponder a um registro cadastral se a fonte e versão do arquivo forem autênticas | Validade matemática não confirma loja aberta, atividade atual ou vínculo comercial. A procedência e data do CSV específico são **não verificadas**. |
| Situação cadastral | Converte códigos do CSV em ATIVA, BAIXADA, INAPTA, SUSPENSA, NULA ou desconhecida | É o estado cadastral mapeado no arquivo | Situação ATIVA não comprova operação física atual nem que o estabelecimento venda os produtos da Deusa. |
| CNAE | Lê CNAE principal e secundários do CSV | Indica atividade econômica declarada no registro | É um filtro inicial; não confirma categoria do ponto físico nem perfil de compra. O escopo permitido aparece em [filter_cnpjs.py](../../dadosCNAE/filter_cnpjs.py), linhas 7–10. |
| Nome fantasia | Lê a coluna de nome fantasia; vazio vira `null` | É o campo cadastral disponível no arquivo | Pode faltar ou estar desatualizado. Não deve ser tratado como nome de fachada atual sem confirmação. |
| Razão social | Código atribui o nome fantasia ou o texto `EMPRESA CNPJ …` | A razão social gravada pelo provider pode ser um placeholder ou uma cópia do nome fantasia | **Não é a razão social oficial verificada** nesse mapeamento. Não inventa uma marca de mercado, mas cria um nome técnico de fallback. |
| Endereço postal | Mapeia campos de logradouro, número, complemento, bairro e CEP | É o endereço cadastral que consta no arquivo | Não comprova que ali exista um supermercado aberto ao público. O relatório de julho registra campos incompletos. |
| Telefone/e-mail | Mapeia campos do CSV | São contatos cadastrais disponíveis na fonte local | Não há teste de entrega, atualização ou titularidade. A completude não foi revalidada. |
| Coordenada do provider | Centroide da cidade mais deslocamento determinístico derivado do CNPJ | É um ponto sintético aproximado para visualização | Não é endereço nem posição real. O próprio código documenta deslocamento visual de até aproximadamente 1,5 km em [receita-federal.provider.ts](../../backend/src/imports/providers/receita-federal.provider.ts), linhas 264–291. |
| Coordenada de fallback do mapa | Quando lat/lon não existem, usa diretamente o centroide municipal | Representa somente o município | Em [map-opportunities.service.ts](../../backend/src/map-opportunities/map-opportunities.service.ts), linhas 576–592, esse ponto recebe o rótulo `municipio_centroide_jitter`, embora não aplique jitter. Isso pode sobrepor pinos e rotular a origem de forma incorreta. |

## Identificação e validação: quatro estados distintos

1. **Registro identificado:** existe uma linha de cadastro no arquivo que passou pelos filtros de município/CNAE. Isso não prova que seja loja ativa ou prospect elegível.
2. **Lead criado:** o sistema criou uma entidade interna de lead vinculada à empresa. Isso indica que entrou no CRM, não que houve contato, validação de endereço ou confirmação comercial.
3. **Localização validada:** o fluxo manual pede nome, endereço, categoria, fonte, justificativa e evidência (URL, Place ID ou visita) em [companies.service.ts](../../backend/src/companies/companies.service.ts), linhas 263–313. O servidor verifica presença e formato dos campos, mas não consulta a fonte da evidência nem comprova independentemente a visita.
4. **Cliente da Deusa:** código considera cliente a empresa que possui uma relação com `ClientAccount.isCurrentClient = true`. A confirmação é baseada nessa relação em [map-opportunities.service.ts](../../backend/src/map-opportunities/map-opportunities.service.ts), linhas 595–629, e [opportunity-filter.ts](../../backend/src/common/opportunity-filter.ts), linhas 321–351.

“Confiável cadastralmente” também não significa endereço confirmado. A função de score soma completude de CNPJ, situação, nome, endereço, CEP, telefone, e-mail e município; reduz o status se a coordenada é aproximada. A própria função define seu alcance em [cadastral-quality.ts](../../backend/src/common/cadastral-quality.ts), linhas 64–114. Score alto é uma regra de completude, não uma taxa de precisão medida contra lojas verificadas.

## Como a carteira é cruzada e por que “não cliente” não é prova

A importação da carteira normaliza a planilha e usa CNPJ para buscar empresa existente; usa o código da Deusa como chave de upsert da conta em [imports.service.ts](../../backend/src/imports/imports.service.ts), linhas 174–201 e 390–471. Quando encontra o mesmo CNPJ, liga a conta a `Company`. Quando não encontra, mantém uma `ClientAccount` sem `companyId`; o schema permite essa situação em [schema.prisma](../../backend/prisma/schema.prisma), linhas 245–270.

O mapa marca uma empresa como cliente somente quando existe `ClientAccount` ativa relacionada por `companyId`. Uma conta sem essa relação não aparece como cliente daquela empresa. Filial com CNPJ diferente, código cadastral inconsistente, divergência de formatação ou ausência de empresa correspondente podem deixar a carteira sem vínculo. Por isso, “não cliente” significa **não existe conta ativa vinculada nesta consulta**, e não “a Deusa confirmou que não vende para esta filial”.

Há outro limite: o código rastreado grava `isCurrentClient: true` na importação ([imports.service.ts](../../backend/src/imports/imports.service.ts), linhas 456–470) e o schema usa `true` por padrão ([schema.prisma](../../backend/prisma/schema.prisma), linha 251). Não encontrei no backend um fluxo que defina esse campo como falso ou reconcilie contas que sumiram de uma planilha. Isso não exclui uma operação externa no banco, mas essa operação é **não verificada**. Uma carteira desatualizada pode continuar classificando conta antiga como cliente.

## Falsos positivos e inconsistências técnicas

- O filtro de oportunidade exige situação ativa, CNAE alvo, exclusão de certos ramos e território urbano para prospect; cliente ativo é mantido no mapa por regra explícita em [opportunity-filter.ts](../../backend/src/common/opportunity-filter.ts), linhas 321–351. Isso melhora triagem, mas não é comprovação física.
- A pesquisa de candidatos Places compara nome por substring ou pelos primeiros cinco caracteres em [companies.service.ts](../../backend/src/companies/companies.service.ts), linhas 70–75. Prefixos comuns como “mercado” podem produzir compatibilidade fraca.
- O score de candidato soma nome, logradouro, município e telefone. Categoria incompatível vira alerta, e `businessStatus` é retornado, mas não é filtro que exclui o candidato antes da ordenação; veja [companies.service.ts](../../backend/src/companies/companies.service.ts), linhas 345–419. Portanto, um candidato fechado ou fora da categoria pode aparecer entre os resultados.
- O Places não recebe CNPJ como chave de confirmação: recebe um texto construído a partir dos dados existentes da empresa. O endpoint gera uma consulta individual e exige confirmação paga em [companies.service.ts](../../backend/src/companies/companies.service.ts), linhas 1106–1185. É uma sugestão para revisão humana, não match oficial.
- A importação individual pode deixar empresa sem lead: se a empresa já existe, o ramo de [imports.service.ts](../../backend/src/imports/imports.service.ts), linhas 279–305, retorna antes de chamar `upsertLeadForCompany`. Falhas por empresa são capturadas e o job geral pode terminar como `SUCCESS` com itens ignorados, linhas 306–326. Uma falha após salvar empresa e antes de salvar lead pode persistir parcialmente e a repetição não repara esse lead ausente.
- A importação de clientes grava o mesmo campo de nome em `razaoSocial` e `nomeFantasia` e exige CNPJ ou código identificador, mas pode manter contas sem vínculo à empresa; [imports.service.ts](../../backend/src/imports/imports.service.ts), linhas 174–201 e 456–470. A planilha de origem e seu contrato empresarial não foram avaliados.

## Abordagem recomendada para leads verificáveis

1. Manter o CSV cadastral como **fonte de empresas registradas**, com arquivo, órgão, layout, versão/data de extração e hash registrados. Não chamar esse universo de lojas verificadas.
2. Separar campos e estados: razão social oficial, nome fantasia cadastral, nome de fachada confirmado; endereço postal, coordenada municipal aproximada, coordenada de mapa sugerida e localização validada com evidência. O estado “pendente” não deve ser convertido em “confirmado” por score.
3. Tratar a unidade comercial como filial física e fazer cruzamento pelo CNPJ completo de 14 dígitos, código ERP/cliente e vínculo revisado. Registros sem correspondência devem ficar **não conciliados**, não classificados como “não cliente”.
4. Definir com a Deusa a importação da carteira como snapshot ou delta. Se for snapshot, implementar revisão de ausentes e inativação somente com conferência, contagem e aprovação; se for delta, registrar explicitamente o período e o escopo da exportação.
5. Fazer triagem manual de amostra representativa antes da prospecção: existência do ponto, atividade, endereço, telefone e condição de cliente. Medir falsos positivos e falsos negativos após a revisão; não declarar taxa de acerto antes dessa medição.
6. Para Places, usar somente consulta individual explicitamente aprovada, cache local e orçamento por chamada. Exigir revisão de nome, endereço, categoria, situação e evidência antes de gravar localização confirmada. Não fazer varredura territorial nem enriquecimento em lote.
7. Corrigir o fluxo de upsert para que uma repetição segura também reconcilie/crie o lead faltante e registre falhas parciais por item. Isso deve ser coberto por teste de persistência em banco descartável antes de habilitar importação.

## Conclusão de confiabilidade

O repositório implementa uma **lista inicial de empresas registradas com regras de priorização**, além de uma rotina manual para revisar localizações. Não comprova um conjunto atual de lojas físicas verificadas. A carteira também depende de um relacionamento exato que pode estar ausente. Até que fonte, data, filial e reconciliação sejam validadas, tratar cada linha como lead potencial pendente e cada classificação “não cliente” como não conciliada é a apresentação mais fiel ao código.
