# API Smoke Tests - Pre-migracao Angular

Data de criacao: 2026-07-05

Objetivo: validar rapidamente os contratos principais da API antes de iniciar a migracao React -> Angular. Estes testes sao manuais e devem ser executados em ambiente local ou banco de teste.

Base URL padrao:

```bash
API_URL=http://127.0.0.1:3001
```

Avisos:

- `POST /imports/cnpj`, `POST /companies/sync/:cnpj` e endpoints de leads podem escrever no banco.
- Para testes de escrita, use banco local/teste e limites pequenos.
- Os comandos abaixo assumem backend rodando em `http://127.0.0.1:3001`.
- `jq` e opcional; quando usado, serve apenas para facilitar a leitura.

## Resultado da validacao rapida - 2026-07-05

Ambiente validado:

- Backend: `http://127.0.0.1:3001`
- Banco configurado: PostgreSQL local em `localhost:5435`
- CSV validado: `dadosCNAE/sp_4712100_estabelecimentos.csv`
- Registros no CSV: 23.348
- `frontend-angular/`: nao criado

| Item | Status | Observacao curta |
|---|---|---|
| Build backend `npm run build` | Passou | `tsc -p tsconfig.build.json` finalizou sem erro |
| `POST /auth/login` | Passou | HTTP 201, retornou `accessToken` |
| `GET /auth/me` | Passou | HTTP 200 com token do login |
| `GET /dashboard/summary` | Passou | HTTP 200, retornou chaves esperadas |
| `POST /imports/cnpj` | Passou | HTTP 201, importou 3 empresas com `source=receita-federal` |
| `POST /companies/sync/:cnpj` | Passou | 3 CNPJs reais do CSV sincronizados com HTTP 201 |
| `GET /leads` | Passou | HTTP 200, retornou 50 leads |
| `GET /leads?city=Tupã&cnae=4712100` | Passou | HTTP 200, retornou 50 leads filtrados |
| `GET /map/opportunities` | Passou | HTTP 200, retornou 50 pontos |
| Campos do mapa | Passou | Retornou `origemCoordenada`, `statusVerificacaoEndereco`, `confiancaVerificacao` |
| Centroide/jitter no mapa | Passou | 50 pontos com centroide/jitter, 0 com `statusVerificacaoEndereco=verificado`, todos `aproximado` |
| Aviso visual no React | Pendente | Nao foi aberto navegador nesta rodada; a API fornece os campos necessarios para o aviso |
| Dados reais do provider | Passou | Importacao/sync retornaram `source=receita-federal` |

### CNPJs reais testados

| CNPJ | Nome fantasia | Situacao cadastral | Cidade | Endereco | Telefone/e-mail | Pontuacao oportunidade | Confianca cadastral | Coordenada/status |
|---|---|---|---|---|---|---:|---:|---|
| `04.940.916/0001-82` | POINT DOG | BAIXADA | Presidente Prudente | AVENIDA CORONEL JOSE SOARES MARCONDES 2800 VILA EUCLIDES 19010082 | Ausente | 55 | 60 | `municipio_centroide_jitter` / `aproximado` |
| `03.302.373/0001-05` | Ausente | INAPTA | Aracatuba | RUA JOSEPH SMITH JUNIOR 500 JD. SAO JOSE 16070090 | Ausente | 55 | 50 | `municipio_centroide_jitter` / `aproximado` |
| `01.669.259/0001-92` | MERCADINHO RIBEIRO | BAIXADA | Pompeia | RUA SALVADOR M DE ALMEIDA 483 JD PRIMAVERA 17580000 | Ausente | 55 | 60 | `municipio_centroide_jitter` / `aproximado` |

## Checklist rapida

- [x] Backend responde em `GET /dashboard/summary`.
- [x] Login real retorna `accessToken`.
- [x] `/auth/me` valida token.
- [x] Importacao real por `ReceitaFederalProvider` funciona com limite pequeno.
- [x] Consulta de CNPJ real funciona.
- [x] Listagem de leads retorna `company`.
- [x] Filtros de leads retornam dados coerentes.
- [x] Mapa retorna oportunidades com coordenadas.
- [x] `origemCoordenada` aparece nos dados do mapa/leads.
- [x] `statusVerificacaoEndereco` aparece nos dados do mapa/leads.
- [ ] Casos com `centroide` ou `jitter` preservam aviso de localizacao aproximada no React atual.

## Testes

### 1. Health funcional do dashboard

Objetivo: confirmar que o backend esta respondendo e que o contrato de dashboard atual existe.

Endpoint: `GET /dashboard/summary`

Comando:

```bash
curl -s "$API_URL/dashboard/summary"
```

Resultado esperado:

- JSON com `potentialClients`, `activeClients`, `inactiveClients`, `criticalOpportunities`, `monitoredCities`, `monitoredCnaes`, `priorityCity`, `priorityCnae`.
- HTTP `200`.

### 2. Login real no backend

Objetivo: validar autenticacao real do NestJS, sem auth mock do React.

Endpoint: `POST /auth/login`

Comando:

```bash
curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"rafael.mendes@deusa.com.br","password":"deusa123"}'
```

Resultado esperado:

- HTTP `201` ou `200`, conforme resposta do Nest/adapter.
- JSON com `accessToken`.
- JSON com `user.id`, `user.name`, `user.email`, `user.role`.

### 3. Validacao de `/auth/me`

Objetivo: confirmar que o token do login valida a sessao no backend.

Endpoint: `GET /auth/me`

Passo manual:

1. Execute o teste de login.
2. Copie o valor de `accessToken`.
3. Execute:

```bash
curl -s "$API_URL/auth/me" \
  -H "Authorization: Bearer <TOKEN>"
```

Resultado esperado:

- HTTP `200`.
- JSON do usuario autenticado.
- Sem token ou token invalido deve retornar `401`.

### 4. Importacao de CNPJs reais

Objetivo: validar que o backend usa `ReceitaFederalProvider` e importa dados reais do CSV filtrado.

Endpoint: `POST /imports/cnpj`

Comando com limite pequeno:

```bash
curl -s -X POST "$API_URL/imports/cnpj" \
  -H "Content-Type: application/json" \
  -d '{
    "uf": "SP",
    "cityName": "Tupã",
    "cityIbgeCode": "3555000",
    "cnaeCode": "4712100",
    "limit": 1
  }'
```

Resultado esperado:

- JSON com `job.status` igual a `SUCCESS`.
- `job.totalFound` maior ou igual a `1`.
- `job.totalSaved` maior ou igual a `1`.
- `companies` com pelo menos um item.
- Empresa com `source` igual a `receita-federal`.
- Empresa com `cnaePrincipal` igual a `4712100`.

### 5. Consulta de CNPJ real

Objetivo: validar consulta direta pelo provider usando um CNPJ existente no CSV real.

Endpoint: `POST /companies/sync/:cnpj`

CNPJ real de amostra encontrado em `dadosCNAE/sp_4712100_estabelecimentos.csv`: `52302726000182`.

Comando:

```bash
curl -s -X POST "$API_URL/companies/sync/52302726000182" \
  -H "Content-Type: application/json"
```

Resultado esperado:

- HTTP `201` ou `200`.
- JSON de `Company`.
- `cnpj` igual a `52302726000182`.
- `source` igual a `receita-federal`.
- Campos de qualidade presentes quando calculados: `origemCoordenada`, `statusVerificacaoEndereco`, `confiancaVerificacao`, `pontuacaoOportunidade`, `nivelOportunidade`.

### 6. Listagem de leads

Objetivo: validar contrato usado pela tabela de leads e regioes prioritarias.

Endpoint: `GET /leads`

Comando:

```bash
curl -s "$API_URL/leads"
```

Resultado esperado:

- HTTP `200`.
- Array JSON.
- Cada lead deve trazer `id`, `status`, `score`, `potentialLevel` e `company`.
- `company` deve conter campos cadastrais, CNAE e qualidade quando disponiveis.

### 7. Filtros de leads

Objetivo: validar filtros de backend usados pelo React atual.

Endpoint: `GET /leads`

Comandos:

```bash
curl -s "$API_URL/leads?city=Tup%C3%A3&cnae=4712100"
```

```bash
curl -s "$API_URL/leads?potentialLevel=HIGH"
```

```bash
curl -s "$API_URL/leads?search=52302726000182"
```

Resultado esperado:

- HTTP `200`.
- Array JSON.
- Filtro por cidade retorna leads de `company.cidade = "Tupã"` quando houver dados.
- Filtro por CNAE retorna empresas com `company.cnaePrincipal = "4712100"` ou CNAE secundario correspondente.
- Filtro por busca encontra CNPJ/razao/nome fantasia quando existir.

### 8. Endpoint do mapa de oportunidades

Objetivo: validar contrato usado por `/mapa-oportunidades`.

Endpoint: `GET /map/opportunities`

Comando:

```bash
curl -s "$API_URL/map/opportunities"
```

Resultado esperado:

- HTTP `200`.
- Array JSON.
- Cada item deve conter `id`, `companyName`, `cnpj`, `city`, `uf`, `latitude`, `longitude`, `score`, `status`, `potentialLevel`.
- Itens devem conter `origemCoordenada`, `statusVerificacaoEndereco` e `confiancaVerificacao` quando a empresa tiver esses campos.

### 9. Verificacao de `origemCoordenada`

Objetivo: garantir que o Angular futuro consiga diferenciar coordenada aproximada de coordenada real.

Endpoint: `GET /map/opportunities`

Comando opcional com `jq`:

```bash
curl -s "$API_URL/map/opportunities" | jq '.[0] | {cnpj, origemCoordenada, latitude, longitude}'
```

Resultado esperado:

- Para dados vindos do CSV da Receita Federal, `origemCoordenada` normalmente deve ser `municipio_centroide_jitter` quando a cidade estiver mapeada.
- Se nao houver coordenada, a empresa nao aparece no endpoint do mapa, mas pode aparecer em `/leads`.

### 10. Verificacao de `statusVerificacaoEndereco`

Objetivo: garantir que o status de verificacao cadastral chega ate o consumidor do mapa e da tabela.

Endpoints:

- `GET /map/opportunities`
- `GET /leads`

Comandos:

```bash
curl -s "$API_URL/map/opportunities" | jq '.[0] | {cnpj, statusVerificacaoEndereco, confiancaVerificacao}'
```

```bash
curl -s "$API_URL/leads" | jq '.[0].company | {cnpj, statusVerificacaoEndereco, confiancaVerificacao}'
```

Resultado esperado:

- `statusVerificacaoEndereco` deve existir quando a empresa foi importada ou sincronizada pelo provider atual.
- Valores esperados incluem `aproximado`, `nao_verificado`, `confiavel_cadastralmente`, `verificado`, `divergente`, `nao_encontrado`.
- Para coordenada por centroide/jitter, a UI nao deve apresentar o ponto como endereco real.

### 11. Verificacao do aviso de localizacao aproximada

Objetivo: confirmar que a camada visual atual mostra aviso quando a API retorna coordenada aproximada.

Endpoint base: `GET /map/opportunities`

Passo manual:

1. Garanta que `/map/opportunities` retorna item com `origemCoordenada` contendo `centroide` ou `jitter`.
2. Abra o React atual em `/mapa-oportunidades`.
3. Clique em um marcador aproximado.

Resultado esperado:

- Marcador aproximado deve ter indicacao visual diferenciada.
- Popup deve informar que a localizacao e aproximada por municipio.
- Se a maioria dos pontos filtrados for aproximada, a tela deve mostrar banner explicativo.
- O texto nao deve sugerir que a coordenada e o endereco exato do estabelecimento.

### 12. Dados reais vindos do `ReceitaFederalProvider`

Objetivo: confirmar que a cadeia real CSV -> provider -> empresa -> lead -> mapa esta preservada.

Endpoints:

- `POST /imports/cnpj`
- `GET /leads`
- `GET /map/opportunities`

Passos:

1. Execute a importacao com `limit: 1`.
2. Liste leads com `GET /leads?city=Tup%C3%A3&cnae=4712100`.
3. Consulte o mapa com `GET /map/opportunities`.

Resultado esperado:

- Empresa importada com `source = "receita-federal"`.
- Lead criado ou atualizado para a empresa.
- Quando cidade estiver mapeada, mapa recebe latitude/longitude aproximadas.
- `origemCoordenada` e `statusVerificacaoEndereco` preservam a limitacao da base da Receita Federal.

## Criterio para liberar criacao do Angular

Antes de criar `frontend-angular/`, estes pontos devem estar aprovados:

- Login real e `/auth/me` funcionando.
- Endpoints de leitura principais retornando JSON coerente.
- Pelo menos uma importacao real pequena validada em banco local/teste.
- Campos de qualidade cadastral presentes nos contratos.
- Sem divergencia aberta sobre o endpoint de dashboard/analytics.
