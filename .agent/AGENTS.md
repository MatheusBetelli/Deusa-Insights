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
