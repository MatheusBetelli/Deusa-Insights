const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const net = require("net");

function logOk(msg) {
  console.log(`\x1b[32m[OK]\x1b[0m ${msg}`);
}

function logError(msg, recommendation) {
  console.log(`\x1b[31m[ERRO]\x1b[0m ${msg}`);
  if (recommendation) {
    console.log(`       👉 \x1b[33mAção recomendada:\x1b[0m ${recommendation}`);
  }
}

function logWarn(msg, recommendation) {
  console.log(`\x1b[33m[AVISO]\x1b[0m ${msg}`);
  if (recommendation) {
    console.log(`       👉 \x1b[33mAção recomendada:\x1b[0m ${recommendation}`);
  }
}

function commandOutput(error) {
  if (!error || typeof error !== "object") return "";
  const output = error.stdout;
  if (Buffer.isBuffer(output)) return output.toString("utf8").trim();
  if (typeof output === "string") return output.trim();
  return "";
}

function commandBlockedBySandbox(error) {
  return error && typeof error === "object" && error.code === "EPERM";
}

function hasSupportedNodeVersion(version) {
  const [major, minor] = version.replace("v", "").split(".").map((part) => parseInt(part, 10));
  if (major > 24) return true;
  if (major === 24) return true;
  return major === 22 && minor >= 13;
}

function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (err) => {
      if (err.code === "EADDRINUSE") {
        resolve({ inUse: true });
      } else if (err.code === "EPERM") {
        resolve({ inUse: false, blocked: true });
      } else {
        resolve({ inUse: false });
      }
    });
    server.once("listening", () => {
      server.close();
      resolve({ inUse: false });
    });
    server.listen(port, "127.0.0.1");
  });
}

function checkTcpConnection(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    socket.once("connect", () => {
      socket.destroy();
      resolve({ connected: true });
    });
    socket.once("error", (err) => {
      socket.destroy();
      resolve({ connected: false, blocked: err.code === "EPERM" });
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve({ connected: false });
    });
    socket.connect(port, host);
  });
}

async function runDoctor() {
  console.log("\n🩺 === DEUSA ANALYTICS — DIAGNÓSTICO DO AMBIENTE (npm run doctor) ===\n");

  let hasErrors = false;

  // 1. Sistema Operacional & Arquitetura
  logOk(`Sistema Operacional: ${process.platform} (${process.arch})`);

  // 2. Node.js Version
  const nodeVersion = process.version;
  if (hasSupportedNodeVersion(nodeVersion)) {
    logOk(`Node.js versão ${nodeVersion} (Compatível: ^22.13.0 || >=24.0.0)`);
  } else {
    hasErrors = true;
    logError(
      `Node.js incompatível. Esperado: ^22.13.0 || >=24.0.0. Encontrado: ${nodeVersion}`,
      "Atualize o Node.js para v22.13+ ou v24+.",
    );
  }

  // 3. npm Version
  try {
    const npmVer = execSync("npm --version", { encoding: "utf8" }).trim();
    logOk(`npm instalado versão ${npmVer}`);
  } catch (err) {
    const npmAgent = process.env.npm_config_user_agent;
    if (npmAgent) {
      logOk(`npm detectado pelo ambiente: ${npmAgent.split(" ")[0]}`);
    } else if (commandBlockedBySandbox(err)) {
      logWarn("Verificação do npm bloqueada pelo sandbox", "Execute 'npm -v' no terminal local.");
    } else {
      hasErrors = true;
      logError("npm não encontrado", "Instale o Node.js/npm.");
    }
  }

  // 4. Docker & Docker Compose
  let dockerOk = false;
  try {
    const dockerVer = execSync("docker --version", { encoding: "utf8" }).trim();
    logOk(`Docker encontrado: ${dockerVer}`);
    dockerOk = true;
  } catch (err) {
    const output = commandOutput(err);
    if (output) {
      logOk(`Docker encontrado: ${output}`);
      dockerOk = true;
    } else if (commandBlockedBySandbox(err)) {
      logWarn(
        "Verificação do Docker bloqueada pelo sandbox",
        "Execute 'docker --version' no terminal local.",
      );
    } else {
      logWarn("Docker CLI não encontrado no PATH", "Instale o Docker Desktop (Windows) ou Docker Engine (Linux).");
    }
  }

  if (dockerOk) {
    try {
      const composeVersion = execSync("docker compose version", { encoding: "utf8" }).trim();
      logOk(`Docker Compose disponível: ${composeVersion}`);
    } catch (err) {
      const output = commandOutput(err);
      if (output) {
        logOk(`Docker Compose disponível: ${output}`);
      } else if (commandBlockedBySandbox(err)) {
        logWarn(
          "Verificação do Docker Compose bloqueada pelo sandbox",
          "Execute 'docker compose version' no terminal local.",
        );
      } else {
        logWarn("Docker Compose v2 não detectado via 'docker compose'", "Verifique a instalação do Docker Compose.");
      }
    }
  }

  // 5. Arquivos .env
  const rootEnvPath = path.join(__dirname, "..", ".env");
  const backendEnvPath = path.join(__dirname, "..", "backend", ".env");
  const frontendEnvPath = path.join(__dirname, "..", "frontend", ".env");

  if (fs.existsSync(backendEnvPath)) {
    logOk("Arquivo backend/.env presente");
  } else {
    hasErrors = true;
    logError("Arquivo backend/.env não encontrado", "Execute 'npm run setup' para criar a partir de .env.example.");
  }

  if (fs.existsSync(frontendEnvPath)) {
    logOk("Arquivo frontend/.env presente");
  } else {
    hasErrors = true;
    logError("Arquivo frontend/.env não encontrado", "Execute 'npm run setup' para criar a partir de .env.example.");
  }

  // 6. Conexão PostgreSQL (Porta 5435)
  const pgConnection = await checkTcpConnection("127.0.0.1", 5435);
  if (pgConnection.connected) {
    logOk("PostgreSQL acessível na porta 5435 (localhost:5435)");
  } else if (pgConnection.blocked) {
    logWarn(
      "Verificação TCP do PostgreSQL bloqueada pelo sandbox",
      "Execute 'npm run db:start' e 'npx prisma migrate status' no terminal local.",
    );
  } else {
    logWarn("PostgreSQL não está acessível na porta 5435", "Execute 'npm run db:start' para subir o container Docker do banco.");
  }

  // 7. Checagem de portas de aplicação
  const port3001 = await checkPort(3001);
  if (port3001.inUse) {
    logWarn("Porta 3001 (Backend) está em uso", "Se o backend não estiver rodando propositalmente, libere a porta 3001.");
  } else if (port3001.blocked) {
    logWarn("Verificação da porta 3001 bloqueada pelo sandbox", "Confira a porta no terminal local se necessário.");
  } else {
    logOk("Porta 3001 (Backend) está livre");
  }

  const port8080 = await checkPort(8080);
  if (port8080.inUse) {
    logWarn("Porta 8080 (Frontend) está em uso", "Se o frontend não estiver rodando propositalmente, libere a porta 8080.");
  } else if (port8080.blocked) {
    logWarn("Verificação da porta 8080 bloqueada pelo sandbox", "Confira a porta no terminal local se necessário.");
  } else {
    logOk("Porta 8080 (Frontend) está livre");
  }

  // 8. Prisma Client
  const prismaClientPath = path.join(__dirname, "..", "backend", "node_modules", "@prisma", "client");
  if (fs.existsSync(prismaClientPath)) {
    logOk("Prisma Client gerado em backend/node_modules/@prisma/client");
  } else {
    logWarn("Prisma Client ausente", "Execute 'npm run db:generate' para gerar o cliente Prisma.");
  }

  console.log("\n=======================================================");
  if (!hasErrors) {
    console.log("\x1b[32m✔ Diagnóstico concluído sem erros impeditivos!\x1b[0m");
  } else {
    console.log("\x1b[31m✖ Diagnóstico encontrou itens que necessitam de atenção.\x1b[0m");
  }
  console.log("=======================================================\n");
}

runDoctor();
