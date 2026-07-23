# 🥑 Deusa Analytics — Plataforma de Inteligência Comercial B2B

Plataforma de inteligência de mercado e visualização geográfica exclusiva para a Deusa Alimentos.

---

## 📋 Requisitos de Sistema

- **Node.js:** Versão LTS `>= 20.0.0` (Recomendado: Node v20 ou v22).
- **npm:** Versão `>= 9.0.0`.
- **Docker:**
  - **Windows:** Docker Desktop com backend WSL2 ou Hyper-V ativo.
  - **Linux:** Docker Engine v20.10+ e Docker Compose v2.
- **PostgreSQL:** PostgreSQL 16 (fornecido via container Docker na porta `5435`).

---

## ⚡ Instalação Rápida e Idempotente (Primeira Execução)

Após clonar o repositório, você pode preparar todo o ambiente (instalação de dependências do monorepo, arquivos de configuração `.env`, banco de dados Docker, Prisma Client e migrations) executando apenas dois comandos na raiz do projeto:

```bash
npm install
npm run setup
```

O script `npm run setup` é **idempotente** (pode ser executado várias vezes sem destruir dados ou sobrescrever arquivos `.env` existentes).

---

## 🩺 Diagnóstico do Ambiente (`npm run doctor`)

Caso enfrente qualquer erro ou queira validar seu ambiente antes de iniciar:

```bash
npm run doctor
```

Esse comando analisa sem alterar o sistema:
- Versões do Node.js, npm e Docker;
- Existência dos arquivos `.env`;
- Conexão com o PostgreSQL na porta `5435`;
- Disponibilidade das portas da aplicação (`3001` e `8080`);
- Geração do Prisma Client.

---

## 🚀 Executando o Projeto no Dia a Dia

Para iniciar o banco de dados e ambos os servidores (Frontend e Backend simultaneamente com logs formatados):

```bash
# 1. Iniciar o container do PostgreSQL em segundo plano
npm run db:start

# 2. Iniciar os servidores de desenvolvimento (Frontend + Backend)
npm run dev
```

Você verá a saída dos dois servidores no mesmo terminal com prefixos coloridos:
- **`[BACKEND]`** rodando em `http://localhost:3001` (Healthcheck: `http://localhost:3001/health`)
- **`[FRONTEND]`** rodando em `http://localhost:8080` (ou `http://localhost:5173`)

Para encerrar os servidores, pressione **`Ctrl + C`** no terminal.

Para desligar o banco de dados:
```bash
npm run db:stop
```

---

## 💻 Instruções Específicas por Sistema Operacional

### 🪟 Executando no Windows (PowerShell)

1. Certifique-se de que o **Docker Desktop** está em execução (ícone da baleia ativo no menu iniciar/bandeja).
2. Abra o **PowerShell** como usuário normal na raiz do projeto.
3. Se o PowerShell bloquear a execução de scripts locais por política de execução, execute:
   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   ```
4. Execute o setup e inicie a aplicação:
   ```powershell
   npm install
   npm run setup
   npm run dev
   ```

### 🐧 Executando no Linux (Bash / Zsh)

1. Certifique-se de que o serviço do Docker esteja rodando (`sudo systemctl start docker`).
2. Caso seu usuário necessite de permissão para rodar Docker sem `sudo`, adicione-o ao grupo `docker`:
   ```bash
   sudo usermod -aG docker $USER
   ```
   *(Pode ser necessário encerrar e reabrir a sessão do Linux após esse comando).*
3. Na raiz do projeto, execute:
   ```bash
   npm install
   npm run setup
   npm run dev
   ```

---

## 🛠️ Lista Completa de Comandos da Raiz (`package.json`)

| Comando | Descrição |
| :--- | :--- |
| `npm run setup` | Prepara todo o ambiente (.env, Docker, Prisma, Migrations, Seed). |
| `npm run doctor` | Diagnóstico automático de saúde do ambiente e portas. |
| `npm run dev` | Inicia o Frontend e Backend simultaneamente. |
| `npm run dev:backend` | Inicia somente o servidor de Backend (NestJS). |
| `npm run dev:frontend` | Inicia somente o servidor de Frontend (Vite/TanStack). |
| `npm run db:start` | Sobe o container PostgreSQL via Docker Compose (`docker compose up -d`). |
| `npm run db:stop` | Para o container PostgreSQL (`docker compose down`). |
| `npm run db:logs` | Exibe os logs em tempo real do banco de dados. |
| `npm run db:migrate` | Executa migrações do Prisma (`prisma migrate dev`). |
| `npm run db:generate` | Gera os tipos do Prisma Client (`prisma generate`). |
| `npm run db:seed` | Popula o banco com os dados e usuários iniciais. |
| `npm run db:reset` | **(Destrutivo)** Solicita confirmação e reseta o esquema do banco. |
| `npm run build` | Compila o Backend e o Frontend para produção. |

---

## 🔑 Credenciais de Desenvolvimento (Seed Users)

Para acessar a aplicação no navegador em `http://localhost:8080`:

* **Administrador:** `admin@deusa.com.br` / `admin123`
* **Comercial:** `rafael.mendes@deusa.com.br` / `deusa123`
* **Gerente:** `mariana.alves@deusa.com.br` / `deusa123`

---

## ❓ Resolução de Problemas Comuns

### 1. `Porta 3001 ou 5435 em uso`
* **Causa:** Outra instância do backend ou um serviço local do PostgreSQL está usando a porta.
* **Solução:** Libere a porta com `npx kill-port 3001` (ou `fuser -k 5435/tcp` no Linux) ou altere a porta nos arquivos `.env`.

### 2. `PrismaClientInitializationError: Can't reach database server at localhost:5435`
* **Causa:** O container do PostgreSQL não está rodando.
* **Solução:** Execute `npm run db:start` ou verifique se o Docker Desktop está ativo.

### 3. `node_modules` de outro sistema operacional
* **Causa:** Copiar a pasta `node_modules` gerada no Windows para o Linux (ou vice-versa).
* **Solução:** Apague a pasta `node_modules` e execute `npm run setup` no novo sistema.
