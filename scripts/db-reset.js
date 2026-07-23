const { execSync } = require("child_process");
const path = require("path");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("\x1b[31m⚠️  ATENÇÃO: OPERAÇÃO DESTRUTIVA DE RESET DO BANCO DE DADOS!\x1b[0m");
rl.question("Tem certeza que deseja apagar e recriar o banco de dados local? (s/N): ", (answer) => {
  if (answer.toLowerCase() === "s" || answer.toLowerCase() === "sim") {
    console.log("\nApagando e recriando o esquema do PostgreSQL via Prisma...");
    const backendDir = path.join(__dirname, "..", "backend");
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
