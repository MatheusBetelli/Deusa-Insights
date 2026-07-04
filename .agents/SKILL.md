# Deusa Insights - Agent Coding Playbook & Skills

Playbook de instruções e diretrizes customizadas para o projeto **Deusa Insights**. Siga sempre estas regras para evitar alucinações e manter a consistência técnica, de design e de negócios do projeto.

---

## 🛠️ Stack Tecnológica & Infraestrutura

### Backend (NestJS + Prisma)
- **Framework:** NestJS com TypeScript.
- **ORM:** Prisma ORM.
- **Banco de Dados:** PostgreSQL (porta local: `5435` via Docker Compose).
- **Porta padrão:** `3001`.
- **Sincronização do Banco:** 
  - Ao alterar o `schema.prisma`, execute `npx prisma migrate dev`.
  - Execute `npm run seed` para restaurar e testar dados mockados coerentes.

### Frontend (React + Vite + Tailwind CSS v4)
- **Biblioteca principal:** React 19 com TypeScript.
- **Bundler:** Vite.
- **Estilização:** Tailwind CSS v4 (Vanilla CSS como base, evitando classes utilitárias ad-hoc fora do design system).
- **Roteamento & Estado:** TanStack Router e TanStack Query (React Query).
- **Componentes visuais:** Radix UI / Shadcn UI.
- **Mapas:** Leaflet e Lucide React para ícones.
- **Porta padrão:** `5173`.

---

## 🎨 Sistema de Design & Estética Premium

Ao criar ou modificar interfaces neste projeto, siga estas diretrizes:
1. **Estética Rica e Moderna:** Interfaces vibrantes com paletas de cores harmoniosas (tailored HSL), efeitos de vidro (glassmorphism), sombras sutis e suporte a modo escuro/claro premium.
2. **Sem Cores Genéricas:** Evite vermelho, verde ou azul puros do navegador. Use cores de marca e tons refinados (e.g., `#0B1F33` para azul escuro corporativo, `#FFF200` para amarelo de destaque da Deusa Alimentos).
3. **Responsividade & Alinhamento:** Layouts limpos, grid/flexbox responsivos, e tipografia moderna (Google Fonts como Outfit, Inter ou Roboto).
4. **Interatividade e Micro-animações:** Efeitos de hover suaves, transições ao interagir com cards e botões.
5. **IDs Únicos:** Garanta que elementos interativos importantes possuam atributos `id` exclusivos e legíveis para facilitar testes de navegador.
6. **Sem Placeholders:** Nunca deixe imagens cinzas de marcação ou dados falsos desestruturados. Use dados mockados realistas e de alta fidelidade.

---

## 📊 Regras de Negócio & Domínio

### 1. Classificação de Clientes (Lead status para Categoria)
A categorização dos Leads no frontend segue a seguinte regra lógica com base no status do Lead (`LeadStatus` no Prisma):
- **CLIENTE:** Leads com status `CONVERTED`.
- **NAO_CLIENTE:** Leads com status `NOT_INTERESTED` ou `INACTIVE`.
- **POTENCIAL:** Todos os outros status ativos (`NEW`, `NO_CONTACT`, `CONTACTED`, `INTERESTED`, `NEGOTIATION`).

Corresponde aos seguintes labels em português:
- `CLIENTE` -> "Cliente" (Cor verde: `#22C55E`)
- `POTENCIAL` -> "Potencial Cliente" (Cor amarela/laranja: `#F59E0B`)
- `NAO_CLIENTE` -> "Não Cliente" (Cor vermelha: `#EF4444`)

### 2. Cálculo do Lead Score
O cálculo do score de prioridade de uma empresa ao ser importada segue os seguintes pesos:
- **Status ativo da empresa:** `+30` pontos.
- **CNAE correspondente ao alvo:** `+25` pontos.
- **Presença de Nome Fantasia:** `+15` pontos.
- **Porte ME (Microempresa) ou EPP (Empresa de Pequeno Porte):** `+10` pontos.
- **Cidade monitorada ativa:** `+10` pontos.
- **Presença de coordenadas de geolocalização (Lat/Long):** `+10` pontos.

---

## 💡 Diretrizes de Desenvolvimento e Código

- **Comentários de Código:** Mantenha e respeite todos os comentários, docstrings e anotações originais do código que não estejam relacionados à mudança que você está efetuando.
- **Normalização de Dados:** Sempre normalize e trate os campos de CNPJ, CEP e CNAE antes de efetuar consultas ou persistências (remover pontuações, espaços em branco e zeros à esquerda desnecessários).
- **Sem imports quebrados:** Sempre use caminhos relativos ou alias `@/` configurados no `tsconfig.json` do frontend e backend.
