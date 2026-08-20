import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function cleanString(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  throw new Error(
    "Script desativado: ele altera coordenadas já importadas. Faça auditoria somente leitura e aprove uma estratégia de correção antes de reativá-lo.",
  );

  console.log("\n=======================================================");
  console.log(" DEUSA ANALYTICS — SANITIZAÇÃO DE COORDENADAS DIVERGENTES ");
  console.log("=======================================================\n");

  const companies = await prisma.company.findMany({
    where: {
      OR: [
        { statusVerificacaoEndereco: "divergente" },
        { confiancaVerificacao: { lt: 60 } },
        { latitude: { not: null } },
      ],
    },
    select: {
      id: true,
      cnpj: true,
      razaoSocial: true,
      nomeFantasia: true,
      cidade: true,
      uf: true,
      latitude: true,
      longitude: true,
      statusVerificacaoEndereco: true,
      confiancaVerificacao: true,
      enderecoVerificado: true,
      origemCoordenada: true,
    },
  });

  console.log(`📊 Auditando ${companies.length} empresas com coordenadas salvas ou verificação pendente...\n`);

  let resetCount = 0;

  for (const c of companies) {
    const name = c.nomeFantasia || c.razaoSocial;
    let isDivergent = c.statusVerificacaoEndereco === "divergente" || (c.confiancaVerificacao !== null && c.confiancaVerificacao < 60);

    // Validação territorial extra caso haja um endereço verificado salvo
    if (!isDivergent && c.enderecoVerificado && c.latitude !== null) {
      const addrClean = cleanString(c.enderecoVerificado);
      const ufClean = cleanString(c.uf);
      const cidadeClean = cleanString(c.cidade);

      if (ufClean && !addrClean.includes(ufClean)) {
        isDivergent = true;
        console.log(`❌ Estado incompatível detectado para ${name} (${c.cidade}/${c.uf}): "${c.enderecoVerificado}"`);
      } else if (cidadeClean && !addrClean.includes(cidadeClean)) {
        isDivergent = true;
        console.log(`❌ Cidade incompatível detectada para ${name} (${c.cidade}/${c.uf}): "${c.enderecoVerificado}"`);
      }
    }

    if (isDivergent && (c.latitude !== null || c.longitude !== null || c.statusVerificacaoEndereco !== "divergente")) {
      await prisma.company.update({
        where: { id: c.id },
        data: {
          latitude: null,
          longitude: null,
          origemCoordenada: "sem_coordenada",
          statusVerificacaoEndereco: "divergente",
          confiancaVerificacao: c.confiancaVerificacao && c.confiancaVerificacao >= 60 ? 50 : c.confiancaVerificacao,
        },
      });
      resetCount++;
      console.log(`   🧹 resetado: ${name} (${c.cidade}/${c.uf}) -> Coordenadas limpas (usará centroide municipal)`);
    }
  }

  console.log("\n=======================================================");
  console.log(` RESUMO DA SANITIZAÇÃO:`);
  console.log(` Total Auditado:             ${companies.length}`);
  console.log(` Coordenadas Limpas/Resetadas: ${resetCount}`);
  console.log("=======================================================\n");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
