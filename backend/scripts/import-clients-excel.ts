import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";

const prisma = new PrismaClient();

async function run() {
  const filePathArg = process.argv[2];
  if (!filePathArg) {
    console.error("❌ Por favor, informe o caminho do arquivo Excel (.xlsx / .xls ou .csv).");
    console.error("Exemplo: npx ts-node scripts/import-clients-excel.ts ./clientes_ribeirao_franca.xlsx");
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), filePathArg);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ Arquivo não encontrado: ${resolvedPath}`);
    process.exit(1);
  }

  console.log(`📂 Lendo arquivo: ${resolvedPath}...`);
  const workbook = XLSX.readFile(resolvedPath);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    console.error("❌ Planilha vazia ou sem abas.");
    process.exit(1);
  }

  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet) as Record<string, any>[];

  console.log(`📊 ${rawData.length} linha(s) encontrada(s) no arquivo.`);

  let matchedCount = 0;
  let createdCount = 0;

  for (const row of rawData) {
    const normalizedRow: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      const normKey = k
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      normalizedRow[normKey] = String(v ?? "").trim();
    }

    const cnpj = (normalizedRow.cnpj || normalizedRow.cnpjcliente || "").replace(/\D/g, "");
    const nome =
      normalizedRow.nome ||
      normalizedRow.razaosocial ||
      normalizedRow.nomefantasia ||
      normalizedRow.cliente ||
      normalizedRow.mercado ||
      "Cliente Excel";
    const cidade =
      normalizedRow.cidade ||
      normalizedRow.municipio ||
      normalizedRow.cidadeuf ||
      "Ribeirão Preto";
    const uf = (normalizedRow.uf || normalizedRow.estado || "SP").toUpperCase();
    const logradouro = normalizedRow.endereco || normalizedRow.logradouro || "";
    const numero = normalizedRow.numero || "";
    const bairro = normalizedRow.bairro || "";
    const cep = (normalizedRow.cep || "").replace(/\D/g, "");

    let company = null;

    if (cnpj.length === 14) {
      company = await prisma.company.findFirst({
        where: { cnpj: { contains: cnpj } },
      });
    }

    if (!company && nome && cidade) {
      company = await prisma.company.findFirst({
        where: {
          cidade: { equals: cidade, mode: "insensitive" },
          OR: [
            { razaoSocial: { contains: nome, mode: "insensitive" } },
            { nomeFantasia: { contains: nome, mode: "insensitive" } },
          ],
        },
      });
    }

    if (company) {
      await prisma.lead.upsert({
        where: { companyId: company.id },
        update: { status: "CONVERTED" },
        create: { companyId: company.id, status: "CONVERTED", score: 100, potentialLevel: "HIGH" },
      });
      matchedCount++;
    } else {
      const fakeCnpj = cnpj.length === 14 ? cnpj : `CLIENTE-EXCEL-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const newCompany = await prisma.company.create({
        data: {
          cnpj: fakeCnpj,
          razaoSocial: nome,
          nomeFantasia: nome,
          situacaoCadastral: "ATIVA",
          cidade,
          uf,
          logradouro,
          numero,
          bairro,
          cep,
          source: "excel_client_import",
          pontuacaoOportunidade: 100,
          nivelOportunidade: "alta",
        },
      });

      await prisma.lead.create({
        data: {
          companyId: newCompany.id,
          status: "CONVERTED",
          score: 100,
          potentialLevel: "HIGH",
        },
      });
      createdCount++;
    }
  }

  console.log(`✅ Importação concluída! Clientes correspondidos: ${matchedCount} | Novos criados: ${createdCount}`);

  // Resumo de Abate Regional
  const targetCities = ["Ribeirão Preto", "Franca"];
  console.log("\n📊 RESUMO DO ABATE E COBERTURA REGIONAL:");
  console.log("-----------------------------------------------------");

  for (const city of targetCities) {
    const totalClientes = await prisma.lead.count({
      where: {
        status: "CONVERTED",
        company: { cidade: { equals: city, mode: "insensitive" } },
      },
    });

    const totalProspects = await prisma.lead.count({
      where: {
        status: { not: "CONVERTED" },
        company: { cidade: { equals: city, mode: "insensitive" } },
      },
    });

    const totalMapeado = totalClientes + totalProspects;
    const taxa = totalMapeado > 0 ? ((totalClientes / totalMapeado) * 100).toFixed(1) + "%" : "0%";

    console.log(`📍 Cidade: ${city}`);
    console.log(`   • Clientes Ativos (Abatidos): ${totalClientes}`);
    console.log(`   • Oportunidades / Prospects: ${totalProspects}`);
    console.log(`   • Total de Mercados Mapeados: ${totalMapeado}`);
    console.log(`   • Taxa de Penetração Comercial: ${taxa}`);
    console.log("-----------------------------------------------------");
  }

  await prisma.$disconnect();
}

run().catch(async (e) => {
  console.error("❌ Erro ao importar clientes do Excel:", e);
  await prisma.$disconnect();
  process.exit(1);
});
