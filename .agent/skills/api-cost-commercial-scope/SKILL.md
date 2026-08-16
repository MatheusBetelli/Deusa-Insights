---
name: api-cost-commercial-scope
description: Regras obrigatórias de controle de custos de APIs externas (Google Places, Geocoding) e filtro rígido de escopo comercial para a Deusa Alimentos (apenas estabelecimentos compradores de farinha e farofa - supermercados, hipermercados, minimercados, mercearias e açougues).
---

# Controle de Custos de APIs e Filtro de Escopo Comercial (Deusa Alimentos)

Esta skill define as regras obrigatórias que TODOS os agentes e rotas do projeto Deusa Insights devem seguir rigorosamente ao manipular dados, consultas a APIs externas e qualificação de estabelecimentos.

---

## 1. Objetivo Principal
* **Minimizar ao máximo o consumo de créditos de APIs pagas** (Google Maps Platform, Google Places, Geocoding).
* **Restringir o banco estritamente ao perfil comprador da Deusa Alimentos** (produtos como farinha de mandioca, farinha de milho, farofa e alimentícios).

---

## 2. Regra Crítica: Não Realizar Novas Descobertas
É **PROIBIDO** realizar buscas amplas ou varredura territorial para descobrir novos estabelecimentos via API pagas.

### Nunca executar automaticamente:
* Descoberta de novos mercados por cidade ou região.
* Busca por raio, categoria ou varredura territorial.
* Paginação automática de resultados do Google Places.
* Buscas para aumentar a quantidade de empresas da base.
* Enriquecimento em massa via APIs externas.
* Jobs recorrentes ou polling de sincronização com APIs pagas.

---

## 3. Prioridade Absoluta: Banco de Dados Existente
Sempre reutilizar primeiro os dados já armazenados no PostgreSQL/Prisma.

### Fluxo Obrigatório de Dados:
```
Banco de Dados → Cache / Dados locais → API externa (ÚLTIMO RECURSO APENAS COM CONFIRMAÇÃO)
```

Antes de qualquer chamada externa:
1. Verificar se o estabelecimento já existe no banco (`cnpj`, `id` ou `nomeFantasia + cidade`).
2. Verificar se as coordenadas ou informações necessárias já estão salvas.
3. Se a informação puder ser resolvida com a base existente, **NÃO chamar a API externa**.

---

## 4. Correções Individuais e Direcionadas
* Correções no Google Places ou Geocoding só podem ocorrer em **registros individuais especificamente identificados como pendentes**.
* Exemplo **PERMITIDO**: Corrigir coordenadas do "Mercado X" que está sem lat/long.
* Exemplo **PROIBIDO**: Pesquisar novamente todos os mercados de uma cidade para atualizar a base.

---

## 5. Escopo Comercial Rígido (Público-Alvo Deusa Alimentos)

### ✅ CATEGORIAS PERMITIDAS (Compradores potenciais de Farinha e Farofa):
* **Supermercados** (CNAE 4711302)
* **Hipermercados** (CNAE 4711301)
* **Minimercados e Mercearias** (CNAE 4712100 / 4721102)
* **Açougues** (CNAE 4722901)

### ❌ CATEGORIAS PROIBIDAS (Ignorar / Desqualificar Imediatamente):
* Lojas de roupas, calçados, confecções, lingerie.
* Eletrônicos, informática, celulares, capinhas.
* Oficinas mecânicas, auto peças, lava jato, borracheiro.
* Farmácias, drogarias, perfumarias, cosméticos.
* Salões de beleza, barbearias, estética.
* Bares, casas noturnas, tabacarias.
* Restaurantes, lanchonetes, escritórios, prestadores de serviço.
* Pet shops, casas de ração, agropecuárias.
* Lojas de móveis, presentes, papelarias, utilidades, 1 real.

> **Nota:** O nome comercial do estabelecimento (ex: "Mercado da Moda", "Mercado das Peças") NÃO justifica inclusão se o ramo real/CNAE for não-alimentício.

---

## 6. Procedimento de Confirmação Obrigatória
Se uma tarefa exigir chamadas pagas a APIs externas, **NÃO execute automaticamente**. Apresente primeiro ao usuário:
1. Qual API externa será chamada (Google Places, Geocoding, etc.).
2. Por que a chamada é estritamente necessária.
3. Quantos estabelecimentos/chamadas serão processados.
4. Se existe alternativa usando apenas a base local.
5. Aguarde a **autorização explícita** do usuário antes de rodar.
