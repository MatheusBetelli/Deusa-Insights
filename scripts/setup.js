const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const net = require("net");

function logStep(msg) {
  console.log(`\n\x1b[36m🚀 [SETUP]\x1b[0m ${msg}`);
}

function logSuccess(msg) {
  console.log(`\x1b[32m✔ [OK]\x1b[0m ${msg}`);
}

function logWarn(msg) {
  console.log(`\x1b[33m⚠️ [AVISO]\x1b[0m ${msg}`);
}

function logError(msg) {
  console.log(`\x1b[31m✖ [ERRO]\x1b[0m ${msg}`);
}

function copyEnvIfNotExists(examplePath, targetPath, name) {
  if (!fs.existsSync(targetPath)) {
    if (fs.existsSync(examplePath)) {
      fs.copyFileSync(examplePath, targetPath);
      logSuccess(`Criado ${name} a partir de .env.example`);
    } else {
      logWarn(`Exemplo ${examplePath} não encontrado para criar ${name}`);
    }
  } else {
    logSuccess(`${name} já existe (preservado sem sobrescrever).`);
  }
}

function checkTcpConnection(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1500);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function waitForPostgres(host, port, timeoutMs = 30000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const connected = await checkTcpConnection(host, port);
    if (connected) return true;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

async function runSetup() {
  console.log("\n⚙️ === DEUSA ANALYTICS — INICIALIZAÇÃO IDEMPOTENTE (npm run setup) ===\n");

  // 1. Verificar versão do Node
  const majorNode = parseInt(process.version.replace("v", "").split(".")[0], 10);
  if (majorNode < 20) {
    logError(`Node.js incompatível. Esperado: >=20.x. Encontrado: ${process.version}`);
    process.exit(1);
  }
  logSuccess(`Node.js ${process.version} verificado.`);

  // 2. Criar arquivos .env se não existirem
  logStep("Verificando arquivos de configuração de ambiente (.env)...");
  const rootDir = path.join(__dirname, "..");
  copyEnvIfNotExists(path.join(rootDir, ".env.example"), path.join(rootDir, ".env"), "Root .env");
  copyEnvIfNotExists(path.join(rootDir, "backend", ".env.example"), path.join(rootDir, "backend", ".env"), "Backend .env");
  copyEnvIfNotExists(path.join(rootDir, "frontend", ".env.example"), path.join(rootDir, "frontend", ".env"), "Frontend .env");

  // 3. Verificar instalação de dependências
  logStep("Verificando dependências em backend e frontend...");
  const backendModules = path.join(rootDir, "backend", "node_modules");
  const frontendModules = path.join(rootDir, "frontend", "node_modules");

  if (!fs.existsSync(backendModules) || !fs.existsSync(frontendModules)) {
    console.log("Instalando dependências dos pacotes...");
    execSync("npm run install:all", { stdio: "inherit", cwd: rootDir, shell: true });
    logSuccess("Dependências instaladas com sucesso.");
  } else {
    logSuccess("Dependências já estão instaladas.");
  }

  // 4. Iniciar PostgreSQL via Docker
  logStep("Verificando container PostgreSQL (Docker Compose)...");
  let pgIsUp = await checkTcpConnection("127.0.0.1", 5435);
  if (!pgIsUp) {
    console.log("Subindo container do PostgreSQL na porta 5435...");
    try {
      execSync("docker compose up -d", { stdio: "inherit", cwd: rootDir, shell: true });
    } catch (err) {
      try {
        execSync("docker-compose up -d", { stdio: "inherit", cwd: rootDir, shell: true });
      } catch (e) {
        logWarn("Não foi possível subir o container Docker automaticamente. Certifique-se de que o Docker esteja em execução.");
      }
    }

    console.log("Aguardando inicialização do banco PostgreSQL (localhost:5435)...");
    pgIsUp = await waitForPostgres("127.0.0.1", 5435, 30000);
  }

  if (pgIsUp) {
    logSuccess("PostgreSQL pronto e aceitando conexões na porta 5435.");
  } else {
    logError("Não foi possível conectar ao PostgreSQL em localhost:5435 dentro do tempo limite.");
    console.log("👉 Certifique-se de que o Docker Desktop ou Docker Engine esteja ativo e rode 'npm run db:start'.");
    process.exit(1);
  }

  // 5. Prisma Generate & Migrate
  logStep("Gerando Prisma Client e aplicando migrations...");
  const backendDir = path.join(rootDir, "backend");
  try {
    execSync("npx prisma generate", { stdio: "inherit", cwd: backendDir, shell: true });
    logSuccess("Prisma Client gerado com sucesso.");

    execSync("npx prisma migrate deploy", { stdio: "inherit", cwd: backendDir, shell: true });
    logSuccess("Migrations Prisma aplicadas com sucesso no banco.");
  } catch (err) {
    logError("Erro ao aplicar migrations Prisma.");
    process.exit(1);
  }

  // 6. Executar Seed se necessário
  logStep("Verificando seed inicial do banco de dados...");
  try {
    execSync("npm run seed", { stdio: "inherit", cwd: backendDir, shell: true });
    logSuccess("Seed de dados iniciais verificado com sucesso.");
  } catch (err) {
    logWarn("Falha ao executar o seed do banco de dados. (O banco pode já conter dados cadastrados).");
  }

  // 7. Resumo Final
  console.log("\n=======================================================");
  console.log("\x1b[32m✨ SETUP CONCLUÍDO COM SUCESSO!\x1b[0m");
  console.log("=======================================================");
  console.log("🔗 \x1b[1mURLs do Ambiente Local:\x1b[0m");
  console.log("   • Backend API:   http://localhost:3001");
  console.log("   • Healthcheck:   http://localhost:3001/health");
  console.log("   • Frontend Web:  http://localhost:8080 (ou http://localhost:5173)\n");
  console.log("▶️  Para iniciar o projeto em modo desenvolvimento:");
  console.log("   \x1b[36mnpm run dev\x1b[0m\n");
}

runSetup().catch((err) => {
  logError(`Falha durante o setup: ${err.message}`);
  process.exit(1);
});
