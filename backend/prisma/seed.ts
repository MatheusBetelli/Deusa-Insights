import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash("admin123", 10);
  const salesPassword = await bcrypt.hash("deusa123", 10);

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
    ["Bastos", "SP", "3505807"],
    ["Assis", "SP", "3504008"],
    ["Ourinhos", "SP", "3534708"],
    ["Lins", "SP", "3527108"],
    ["Bauru", "SP", "3506003"],
    ["Presidente Prudente", "SP", "3541406"],
    ["Araçatuba", "SP", "3502804"],
  ] as const;

  for (const [name, uf, ibgeCode] of citySeed) {
    await prisma.city.upsert({
      where: { name_uf: { name, uf } },
      update: { ibgeCode, isActive: true },
      create: { name, uf, ibgeCode, isActive: true },
    });
  }

  const cnaes = [
    { code: "4711302", description: "Supermercados", category: "Varejo alimentar", isTarget: true },
    { code: "4712100", description: "Minimercados, mercearias e armazéns", category: "Varejo alimentar", isTarget: true },
    { code: "4721102", description: "Padarias e confeitarias com predominância de revenda", category: "Varejo alimentar", isTarget: true },
    { code: "4729699", description: "Comércio varejista de produtos alimentícios em geral", category: "Varejo alimentar", isTarget: true },
    { code: "4639701", description: "Comércio atacadista de produtos alimentícios em geral", category: "Atacado alimentar", isTarget: true },
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

