import { PrismaClient } from "@prisma/client";
import { isValidOpportunity } from "../src/common/opportunity-filter";

const prisma = new PrismaClient();

async function runAudit() {
  console.log("==================================================================");
  console.log(" AUDITORIA DE OPORTUNIDADES NA BASE EXISTENTE (MODO DIAGNÓSTICO) ");
  console.log("==================================================================\n");

  const companies = await prisma.company.findMany({
    include: {
      lead: true,
      details: true,
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`Total de empresas na base PostgreSQL: ${companies.length}\n`);

  let totalValidas = 0;
  let totalSuspeitas = 0;
  const suspeitas: Array<{
    id: string;
    cnpj: string | null;
    placeId: string | null;
    nome: string;
    cidade: string;
    cnae: string | null;
    source: string;
    motivo: string;
  }> = [];

  for (const comp of companies) {
    const isValid = isValidOpportunity({
      situacaoCadastral: comp.situacaoCadastral,
      cnaePrincipal: comp.cnaePrincipal,
      cidade: comp.cidade,
      uf: comp.uf,
      latitude: comp.latitude,
      longitude: comp.longitude,
      nomeFantasia: comp.nomeFantasia,
      razaoSocial: comp.razaoSocial,
      logradouro: comp.logradouro,
      bairro: comp.bairro,
      complemento: comp.complemento,
    });

    if (isValid) {
      totalValidas++;
    } else {
      totalSuspeitas++;
      let motivo = "Regra de filtro desqualificou";
      const nomeCompleto = `${comp.nomeFantasia || ""} ${comp.razaoSocial || ""}`.toLowerCase();
      
      if (comp.situacaoCadastral !== "ATIVA" && comp.situacaoCadastral !== "ATIVO") {
        motivo = `Situação Cadastral Inativa (${comp.situacaoCadastral})`;
      } else if (
        nomeCompleto.includes("produtos naturais") ||
        nomeCompleto.includes("suplementos") ||
        nomeCompleto.includes("organico") ||
        nomeCompleto.includes("orgânico")
      ) {
        motivo = "Categoria incompatível: Loja de Produtos Naturais / Suplementos";
      } else if (
        nomeCompleto.includes("fazenda") ||
        nomeCompleto.includes("sitio") ||
        nomeCompleto.includes("chacara")
      ) {
        motivo = "Propriedade rural / Local não comercial";
      } else if (
        nomeCompleto.includes("adega") ||
        nomeCompleto.includes("bar") ||
        nomeCompleto.includes("tabacaria")
      ) {
        motivo = "Atividade incompatível com supermercados/açougues";
      }

      suspeitas.push({
        id: comp.id,
        cnpj: comp.cnpj,
        placeId: comp.placeId,
        nome: comp.nomeFantasia || comp.razaoSocial,
        cidade: comp.cidade,
        cnae: comp.cnaePrincipal,
        source: comp.source,
        motivo,
      });
    }
  }

  console.log("── RESUMO DO DIAGNÓSTICO ─────────────────────────────────────────");
  console.log(`✅ Oportunidades Válidas Confirmadas: ${totalValidas}`);
  console.log(`⚠️  Falsos Positivos / Registros Incompatíveis: ${totalSuspeitas}`);
  console.log("──────────────────────────────────────────────────────────────────\n");

  if (suspeitas.length > 0) {
    console.log("── REGISTROS DESQUALIFICADOS PELA NOVA REGRA ─────────────────────");
    suspeitas.slice(0, 20).forEach((s, idx) => {
      console.log(
        `${idx + 1}. [${s.cidade}] ${s.nome} | CNPJ: ${s.cnpj || "N/A"} | Source: ${s.source} | Motivo: ${s.motivo}`
      );
    });
    if (suspeitas.length > 20) {
      console.log(`... e mais ${suspeitas.length - 20} registros suspeitos encontrados.`);
    }
    console.log("──────────────────────────────────────────────────────────────────");
    console.log("NENHUM DADO FOI APAGADO DO BANCO (Audit Mode Apenas).");
  }

  await prisma.$disconnect();
}

runAudit().catch((err) => {
  console.error("Erro ao executar auditoria:", err);
  prisma.$disconnect();
  process.exit(1);
});
