# Regras Obrigatórias do Projeto Deusa Insights

## 1. Controle Obrigatório de Custos e APIs Externas (Google Places, Geocoding)
- **Minimizar ao máximo o consumo de créditos:** A base de dados existente (PostgreSQL) deve ser SEMPRE a fonte principal.
- **Proibido realizar novas descobertas em massa:** Não realizar buscas por cidade, busca regional, busca por raio, paginação automática de Places API, varredura territorial ou enriquecimento automático em lote.
- **Reutilização em primeiro lugar:** Fluxo obrigatório: `Banco de Dados → Cache / Dados Existentes → API Externa (Último Recurso)`.
- **Correções individuais:** Se um estabelecimento estiver sem coordenadas ou incompleto, corrigir somente ele. Nunca varrer a cidade inteira.
- **Confirmação Prévia:** Qualquer chamada paga a APIs externas deve ter a estimativa de custos/volume e o motivo apresentados ao usuário para aprovação antes de executar.

## 2. Escopo Comercial Rígido (Público-Alvo Deusa Alimentos)
- **Apenas compradores de Farinha e Farofa:** A plataforma deve conter EXCLUSIVAMENTE estabelecimentos com perfil de compra de farinha de mandioca, farinha de milho, farofa e produtos alimentícios.
- **Categorias Permitidas:** Supermercados, Hipermercados, Minimercados, Mercearias e Açougues.
- **Categorias Desqualificadas (Ignorar):** Lojas de roupas, calçados, informática/celulares, oficinas/auto peças, farmácias, salões/estética, bares/casas noturnas, restaurantes, escritórios, pet shops, lojas de 1 real/variedades e serviços não-alimentícios.

## 3. Fonte Única da Verdade (SSOT) para Clientes Ativos e Deduplicação Idempotente
- **Trava de Contagem dos Clientes Ativos:** A tabela `ClientAccount` com `isCurrentClient = true` é a ÚNICA fonte da verdade para o total de clientes ativos (fixado estritamente na carteira real de ~374 lojas).
- **Proibição Absoluta de Heurísticas de Expansão por Raiz de CNPJ ou Nome:** É estritamente PROIBIDO classificar estabelecimentos no Mapa ou Dashboard como clientes ativos utilizando os 8 primeiros dígitos do CNPJ (raiz de redes) ou buscas aproximadas por nome. Cada loja física é tratada de forma individual e estrita.
- **Idempotência Rigorosa:** Qualquer importação ou sincronização DEVE usar `upsert` com base na chave primária `codigoClienteDeusa` ou CNPJ exato de 14 dígitos. Se os dados existirem, atualiza os campos existentes; se não existirem, cria. Jamais duplicar registros.
- **Consistência Total entre Módulos:** Os contadores de Clientes Ativos no Dashboard, Mapa de Oportunidades, Funil e Carteira DEVEM ser 100% idênticos e alinhados à fonte única.

## 4. Congelamento Estático de Dados e Pinos (State Freeze)
- **Base de Dados e Coordenadas Fixo-Estáticas:** O conjunto atual de leads, clientes ativos, coordenadas GPS e pinos mapeados no sistema está **100% CONGELADO e ESTÁTICO**.
- **Proibição Absoluta de Alterações Automáticas:** É estritamente PROIBIDO adicionar novos leads, excluir leads existentes, alterar coordenadas GPS ou executar varreduras/sanitizações automáticas no banco de dados.
- **Modificações Apenas Sob Demanda Explícita:** Qualquer inclusão, remoção ou alteração de estabelecimentos só será executada mediante solicitação direta e explícita do usuário.

