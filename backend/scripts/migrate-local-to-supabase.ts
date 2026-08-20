import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const localUrl = "postgresql://deusa:deusa@localhost:5435/deusa_analytics?schema=public";
const supabaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!supabaseUrl) {
  console.error("❌ DIRECT_URL ou DATABASE_URL não encontrada no .env");
  process.exit(1);
}

const localPrisma = new PrismaClient({ datasourceUrl: localUrl });
const supabasePrisma = new PrismaClient({ datasourceUrl: supabaseUrl });

async function migrate() {
  console.log("🚀 Iniciando migração ultra-rápida para o Supabase...");

  // 1. Migrar Usuários
  const users = await localPrisma.user.findMany();
  console.log(`👤 Migrando ${users.length} usuários...`);
  if (users.length > 0) {
    await supabasePrisma.user.createMany({ data: users as any, skipDuplicates: true });
  }

  // 2. Migrar CNAEs
  const cnaes = await localPrisma.cnae.findMany();
  console.log(`📋 Migrando ${cnaes.length} CNAEs...`);
  if (cnaes.length > 0) {
    await supabasePrisma.cnae.createMany({ data: cnaes as any, skipDuplicates: true });
  }

  // 3. Migrar Cidades
  const cities = await localPrisma.city.findMany();
  console.log(`🏙️ Migrando ${cities.length} cidades...`);
  if (cities.length > 0) {
    await supabasePrisma.city.createMany({ data: cities as any, skipDuplicates: true });
  }

  // 4. Migrar Empresas (Mercados) em lotes com createMany
  const totalCompanies = await localPrisma.company.count();
  console.log(`🏪 Migrando ${totalCompanies} estabelecimentos/mercados...`);

  const batchSize = 500;
  for (let skip = 0; skip < totalCompanies; skip += batchSize) {
    const companiesBatch = await localPrisma.company.findMany({
      skip,
      take: batchSize,
    });

    await supabasePrisma.company.createMany({
      data: companiesBatch as any,
      skipDuplicates: true,
    });

    const companyIds = companiesBatch.map((c) => c.id);
    const detailsBatch = await localPrisma.companyDetails.findMany({
      where: { companyId: { in: companyIds } },
    });
    if (detailsBatch.length > 0) {
      await supabasePrisma.companyDetails.createMany({
        data: detailsBatch as any,
        skipDuplicates: true,
      });
    }

    const cnaesBatch = await localPrisma.companyCnae.findMany({
      where: { companyId: { in: companyIds } },
    });
    if (cnaesBatch.length > 0) {
      await supabasePrisma.companyCnae.createMany({
        data: cnaesBatch as any,
        skipDuplicates: true,
      });
    }

    console.log(`   ✅ Progresso: ${Math.min(skip + batchSize, totalCompanies)} / ${totalCompanies} mercados migrados`);
  }

  // 5. Migrar Contas de Clientes
  const clients = await localPrisma.clientAccount.findMany();
  console.log(`👥 Migrando ${clients.length} contas de clientes...`);
  if (clients.length > 0) {
    await supabasePrisma.clientAccount.createMany({ data: clients as any, skipDuplicates: true });
  }

  // 6. Migrar Leads
  const leads = await localPrisma.lead.findMany();
  console.log(`🎯 Migrando ${leads.length} leads...`);
  if (leads.length > 0) {
    await supabasePrisma.lead.createMany({ data: leads as any, skipDuplicates: true });
  }

  console.log("\n🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO PARA O SUPABASE!");
}

migrate()
  .then(async () => {
    await localPrisma.$disconnect();
    await supabasePrisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ ERRO NA MIGRAÇÃO:", e);
    await localPrisma.$disconnect();
    await supabasePrisma.$disconnect();
    process.exit(1);
  });
