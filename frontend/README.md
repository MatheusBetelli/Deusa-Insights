# Deusa Analytics Frontend

Interface web do Deusa Analytics, desenvolvida com React, Vite, TypeScript, Tailwind CSS (v4) e TanStack Router/Query.

## Stack

- **React 19**
- **Vite** (bundler rápido)
- **TypeScript** para tipagem estática
- **Tailwind CSS v4** para estilização moderna e otimizada
- **TanStack Router & Start** para roteamento e gerenciamento de estado de rotas
- **TanStack Query** (React Query) para cache e sincronização de dados de API
- **Leaflet** para exibição e interação com mapas geográficos das oportunidades
- **Lucide React** para ícones do sistema
- **Shadcn UI** (Radix UI) para componentes acessíveis e elegantes (Accordion, Dialog, Select, etc.)

## Setup

1. Certifique-se de que o **Backend** esteja rodando em `http://localhost:3001` (ou `http://127.0.0.1:3001`).
2. Entre no diretório do frontend:
   ```bash
   cd frontend
   ```
3. Instale as dependências:
   ```bash
   npm install
   ```
4. Crie/verifique o arquivo de configuração de variáveis de ambiente `.env`:
   ```bash
   cp .env.example .env
   ```
   O arquivo deve conter a URL do backend:
   ```env   cp .env.example .env

   VITE_API_URL=http://127.0.0.1:3001
   ```
5. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
   A aplicação estará disponível em `http://localhost:5173`.

## Scripts Disponíveis

No diretório do frontend, você pode executar:

- `npm test`: Executa os testes unitários da aplicação (formatadores, utilitários e validações).
- `npm run dev`: Inicia o servidor de desenvolvimento do Vite.
- `npm run build`: Compila o projeto para produção.
- `npm run preview`: Visualiza localmente o build de produção gerado.
- `npm run lint`: Executa a verificação estática do código com ESLint.
- `npm run format`: Formata automaticamente todos os arquivos usando Prettier.

## Testes Unitários

Para rodar os testes unitários do frontend:

```bash
npm test
```

## Estrutura do Projeto

- `src/components/`: Componentes reutilizáveis (e.g., botões, inputs, cards).
- `src/components/ui/`: Componentes base do design system (Shadcn UI/Radix).
- `src/routes/`: Definições das rotas do TanStack Router.
- `src/hooks/`: Custom hooks da aplicação.
- `src/services/`: Integração com o backend.
- `src/main.tsx`: Ponto de entrada da aplicação.
