# Deusa Analytics

Plataforma interna de inteligência comercial B2B para a Deusa Alimentos.

---

## 🚀 Como Inicializar o Projeto

Para rodar a plataforma localmente, siga o passo a passo abaixo.

### 1. Banco de Dados (PostgreSQL via Docker)

O backend depende de um banco de dados PostgreSQL rodando. Há um arquivo `docker-compose.yml` na raiz do projeto configurado para subir este banco na porta **`5435`** (configurado assim para evitar conflitos com outros bancos que você possua na máquina).

Na raiz do projeto, execute o comando abaixo para iniciar o banco em segundo plano:

```bash
docker compose up -d
```

> **Nota:** Certifique-se de que o Docker esteja em execução em sua máquina.

### 2. Configurando e Inicializando o Backend

1. Entre no diretório do backend:
   ```bash
   cd backend
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Garanta que o arquivo `.env` existe e está configurado (há um `.env.example` para referência). O arquivo `.env` padrão possui:
   ```env
   DATABASE_URL="postgresql://deusa:deusa@localhost:5435/deusa_analytics?schema=public"
   PORT=3001
   JWT_SECRET="dev-secret-change-me"
   ```
4. Aplique as migrações do banco de dados (Prisma):
   ```bash
   npx prisma migrate dev
   ```
5. Popule o banco com dados iniciais (se necessário):
   ```bash
   npm run seed
   ```
6. Inicialize o servidor em modo de desenvolvimento:
   ```bash
   npm run start:dev
   ```

O backend estará ativo em `http://localhost:3001`.

### 3. Configurando e Inicializando o Frontend

1. Abra um novo terminal e entre no diretório do frontend:
   ```bash
   cd frontend
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Verifique o arquivo `.env` (ou copie do exemplo: `cp .env.example .env`). O arquivo deve apontar para o backend:
   ```env
   VITE_API_URL=http://127.0.0.1:3001
   ```
4. Inicialize o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

O frontend estará disponível em `http://localhost:5173`.

---

## 🔑 Credenciais para Acesso (Seed Users)

Para entrar no sistema, utilize um dos seguintes usuários de teste (senha padrão indicada):

* **Administrador:** `admin@deusa.com.br` / `admin123`
* **Comercial:** `rafael.mendes@deusa.com.br` / `deusa123`
* **Comercial:** `mariana.alves@deusa.com.br` / `deusa123`

---

## 🛠️ Resolução de Problemas (Troubleshooting)

### Erro: `PrismaClientInitializationError: Can't reach database server at localhost:5435`

Se ao rodar `npm start` ou `npm run start:dev` no backend você se deparar com este erro, significa que o Prisma não conseguiu se conectar ao PostgreSQL.

**Como resolver:**
1. Verifique se o container do banco está de fato ativo rodando `docker compose ps` na raiz do projeto.
2. Caso o container não esteja ativo, inicie-o executando:
   ```bash
   docker compose up -d
   ```
3. Se o erro persistir, certifique-se de que o serviço do Docker (Docker Desktop ou daemon do Docker) está rodando no seu sistema operacional.
