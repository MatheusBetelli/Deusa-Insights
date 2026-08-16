import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const isProduction = process.env.NODE_ENV === "production";

function getRequiredPassword(envVar: string, fallback: string): string {
  const value = process.env[envVar];
  if (value) return value;
  if (isProduction) {
    console.error(`❌ SEGURANÇA: ${envVar} é obrigatória em produção. Defina antes de executar o seed.`);
    process.exit(1);
  }
  console.warn(`⚠️  ${envVar} não definida. Usando senha padrão de desenvolvimento.`);
  return fallback;
}

async function main() {
  const adminPassword = await bcrypt.hash(getRequiredPassword("SEED_ADMIN_PASSWORD", "admin123"), 12);
  const salesPassword = await bcrypt.hash(getRequiredPassword("SEED_SALES_PASSWORD", "deusa123"), 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@deusa.com.br" },
    update: {},
    create: {
      name: "Administrador Deusa",
      email: "admin@deusa.com.br",
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
    },
  });

  const deusaGmail = await prisma.user.upsert({
    where: { email: "deusaalimentos01@gmail.com" },
    update: {},
    create: {
      name: "Deusa Alimentos",
      email: "deusaalimentos01@gmail.com",
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
    },
  });

  const rafael = await prisma.user.upsert({
    where: { email: "rafael.mendes@deusa.com.br" },
    update: {},
    create: {
      name: "Rafael Mendes",
      email: "rafael.mendes@deusa.com.br",
      passwordHash: salesPassword,
      role: UserRole.SALES,
    },
  });

  const mariana = await prisma.user.upsert({
    where: { email: "mariana.alves@deusa.com.br" },
    update: {},
    create: {
      name: "Mariana Alves",
      email: "mariana.alves@deusa.com.br",
      passwordHash: salesPassword,
      role: UserRole.MANAGER,
    },
  });

  const camila = await prisma.user.upsert({
    where: { email: "camila.rocha@deusa.com.br" },
    update: {},
    create: {
      name: "Camila Rocha",
      email: "camila.rocha@deusa.com.br",
      passwordHash: salesPassword,
      role: UserRole.SALES,
    },
  });

  const felipe = await prisma.user.upsert({
    where: { email: "felipe.lima@deusa.com.br" },
    update: {},
    create: {
      name: "Felipe Lima",
      email: "felipe.lima@deusa.com.br",
      passwordHash: salesPassword,
      role: UserRole.SALES,
    },
  });

  const citySeed = [
    ["Tupã", "SP", "3555000"],
    ["Marília", "SP", "3529005"],
    ["Pompeia", "SP", "3540002"],
    ["Garça", "SP", "3516705"],
    ["Quintana", "SP", "3541604"],
    ["Vera Cruz", "SP", "3556602"],
    ["Oriente", "SP", "3534005"],
    ["Echaporã", "SP", "3514304"],
    ["Herculândia", "SP", "3519105"],
    ["Iacri", "SP", "3519402"],
    ["Parapuã", "SP", "3535606"],
    ["Rinópolis", "SP", "3543709"],
    ["Gália", "SP", "3516606"],
    ["Bastos", "SP", "3505807"],
    ["Assis", "SP", "3504008"],
    ["Ourinhos", "SP", "3534708"],
    ["Lins", "SP", "3527108"],
    ["Bauru", "SP", "3506003"],
    ["Presidente Prudente", "SP", "3541406"],
    ["Araçatuba", "SP", "3502804"],
    ["Adamantina", "SP", "3500105"],
    ["Lucélia", "SP", "3527504"],
    ["Osvaldo Cruz", "SP", "3534609"],
    ["Dracena", "SP", "3514403"],
    ["Ribeirão Preto", "SP", "3543402"],
    ["Franca", "SP", "3516200"],
  ] as const;

  for (const [name, uf, ibgeCode] of citySeed) {
    await prisma.city.upsert({
      where: { name_uf: { name, uf } },
      update: { ibgeCode, isActive: true },
      create: { name, uf, ibgeCode, isActive: true },
    });
  }

    const cnaes = [
      { code: "4711301", description: "Hipermercados", category: "Hipermercados", isTarget: true },
      { code: "4711302", description: "Supermercados", category: "Supermercados", isTarget: true },
      { code: "4712100", description: "Minimercados, mercearias e armazéns", category: "Minimercados e Mercearias", isTarget: true },
      { code: "4722901", description: "Comércio varejista de carnes - Açougues", category: "Açougues", isTarget: true },
      { code: "4724500", description: "Comércio varejista de hortifrutigranjeiros", category: "Varejo alimentar (Pequeno porte)", isTarget: false },
      { code: "4721102", description: "Padarias e confeitarias com predominância de revenda", category: "Varejo alimentar (Pequeno porte)", isTarget: false },
      { code: "4729699", description: "Comércio varejista de produtos alimentícios em geral", category: "Varejo alimentar (Pequeno porte)", isTarget: false },
      { code: "4723700", description: "Comércio varejista de peixes e frutos do mar - Peixarias", category: "Varejo alimentar (Pequeno porte)", isTarget: false },
      { code: "4639701", description: "Comércio atacadista de produtos alimentícios em geral", category: "Atacado alimentar", isTarget: false },
      { code: "5611203", description: "Lanchonetes, casas de chá, de sucos e similares", category: "Food service", isTarget: false },
    ];

  for (const cnae of cnaes) {
    await prisma.cnae.upsert({
      where: { code: cnae.code },
      update: cnae,
      create: cnae,
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

