const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const backendDir = path.join(__dirname, "..", "backend");

function readEnvValue(name) {
  if (process.env[name]) return process.env[name];
  const envPath = path.join(backendDir, ".env");
  if (!fs.existsSync(envPath)) return "";
  const match = fs.readFileSync(envPath, "utf8").match(new RegExp(`^${name}\\s*=\\s*(.*)$`, "m"));
  return match ? match[1].trim().replace(/^['"]|['"]$/g, "") : "";
}

const rawDatabaseUrl = readEnvValue("DIRECT_URL") || readEnvValue("DATABASE_URL");
let parsedDatabaseUrl;
try {
  parsedDatabaseUrl = new URL(rawDatabaseUrl);
} catch {
  console.error("Reset bloqueado: configure uma DIRECT_URL ou DATABASE_URL local válida em backend/.env.");
  process.exit(1);
}

const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const databaseName = decodeURIComponent(parsedDatabaseUrl.pathname.replace(/^\//, ""));
if (!localHosts.has(parsedDatabaseUrl.hostname.toLowerCase()) || !databaseName || databaseName === "postgres") {
  console.error("Reset bloqueado: este comando aceita somente um banco local dedicado, nunca uma URL remota ou o banco postgres padrão.");
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("\x1b[31m⚠️  ATENÇÃO: OPERAÇÃO DESTRUTIVA DE RESET DO BANCO LOCAL!\x1b[0m");
rl.question(`Digite RESET ${databaseName} para confirmar: `, (answer) => {
  if (answer === `RESET ${databaseName}`) {
    console.log("\nApagando e recriando o esquema do PostgreSQL via Prisma...");
    try {
      execSync("npx prisma migrate reset --force", { stdio: "inherit", cwd: backendDir });
      console.log("\x1b[32m✔ Banco de dados recriado com sucesso!\x1b[0m\n");
    } catch (err) {
      console.error("\x1b[31m✖ Erro ao resetar o banco de dados.\x1b[0m");
    }
  } else {
    console.log("Operação cancelada pelo usuário.");
  }
  rl.close();
});
