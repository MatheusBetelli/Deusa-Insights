import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TOM_CITY_MAP: Record<string, string> = {
  "7201": "Tupã", "6681": "Marília", "6901": "Pompeia", "6475": "Garça",
  "6215": "Bastos", "6179": "Assis", "6795": "Ourinhos", "6643": "Lins",
  "6219": "Bauru", "6929": "Presidente Prudente", "6155": "Araçatuba",
  "6969": "Ribeirão Preto", "6425": "Franca", "6101": "Adamantina",
  "6653": "Lucélia", "6825": "Osvaldo Cruz", "6377": "Dracena",
  "6951": "Quintana", "7237": "Vera Cruz", "6817": "Oriente",
  "6389": "Echaporã", "6515": "Herculândia", "6537": "Iacri",
  "6845": "Parapuã", "6979": "Rinópolis", "6471": "Gália",
};

async function run() {
  const csvPath = path.resolve(__dirname, "../../dadosCNAE/sp_4712100_estabelecimentos.csv");
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ Arquivo CSV não encontrado: ${csvPath}`);
    process.exit(1);
  }

  console.log(`📂 Lendo mercados e minimercados ativos de: ${csvPath}...`);

  const fileStream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let totalProcessed = 0;
  let totalImported = 0;

  for await (const line of rl) {
    totalProcessed++;
    const cols = line.split(";").map((c) => c.replace(/^"|"$/g, "").trim());

    const cnpjBasico = cols[0];
    const cnpjOrdem = cols[1];
    const cnpjDv = cols[2];

    if (!cnpjBasico || cnpjBasico.length !== 8) continue;

    const fullCnpj = `${cnpjBasico}${cnpjOrdem}${cnpjDv}`;
    const situacaoCode = cols[5]; // 02 = ATIVA
    const tomCode = cols[20];
    const cityName = TOM_CITY_MAP[tomCode];

    // Somente ativas nas cidades cadastradas
    if (situacaoCode !== "02" || !cityName) continue;

    const nomeFantasia = cols[4] || "MINIMERCADO / SUPERMERCADO";
    const tipoLogradouro = cols[13] || "";
    const logradouro = cols[14] || "";
    const logradouroCompleto = [tipoLogradouro, logradouro].filter(Boolean).join(" ");
    const numero = cols[15] || "S/N";
    const bairro = cols[17] || "";
    const cep = cols[18] || "";
    const uf = cols[19] || "SP";
    const ddd1 = cols[21] || "";
    const fone1 = cols[22] || "";
    const telefone = ddd1 && fone1 ? `(${ddd1}) ${fone1}` : null;
    const email = cols[27] || null;

    try {
      const company = await prisma.company.upsert({
        where: { cnpj: fullCnpj },
        update: {
          nomeFantasia,
          cidade: cityName,
          uf,
          logradouro: logradouroCompleto,
          numero,
          bairro,
          cep,
          situacaoCadastral: "ATIVA",
        },
        create: {
          cnpj: fullCnpj,
          razaoSocial: nomeFantasia,
          nomeFantasia,
          situacaoCadastral: "ATIVA",
          cidade: cityName,
          uf,
          logradouro: logradouroCompleto,
          numero,
          bairro,
          cep,
          cnaePrincipal: "4712100",
          source: "csv_cnae_import",
          pontuacaoOportunidade: 85,
          nivelOportunidade: "alta",
        },
      });

      await prisma.lead.upsert({
        where: { companyId: company.id },
        update: {},
        create: {
          companyId: company.id,
          status: "NEW",
          score: 85,
          potentialLevel: "HIGH",
        },
      });

      if (telefone || email) {
        await prisma.companyDetails.upsert({
          where: { companyId: company.id },
          update: {
            telefone: telefone ?? undefined,
            email: email ?? undefined,
          },
          create: {
            companyId: company.id,
            telefone,
            email,
            descricaoCnae: "Minimercados, mercearias e armazéns",
          },
        });
      }

      totalImported++;
    } catch (err) {
      console.warn(`Erro ao importar ${fullCnpj}:`, err instanceof Error ? err.message : String(err));
    }
  }

  console.log(`✅ Importação concluída: ${totalImported} mercados/minimercados ativos inseridos nas cidades cadastradas!`);
  await prisma.$disconnect();
}

run().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
