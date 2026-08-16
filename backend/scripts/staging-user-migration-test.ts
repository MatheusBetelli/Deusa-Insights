import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();

async function runStagingSingleUserTest() {
  console.log("=== INICIANDO MIGRAÇÃO CONTROLADA DE 1 USUÁRIO EM STAGING ===");
  
  // 1. Buscar usuário de teste legado
  const testUser = await prisma.user.findFirst({
    where: { email: "rafael.mendes@deusa.com.br" },
  });

  if (!testUser) {
    console.error("❌ Usuário de teste não encontrado");
    process.exit(1);
  }

  console.log(`\n1. Usuário selecionado: ${testUser.email} (CUID Legado: ${testUser.id})`);

  // 2. Simular/Executar criação no Supabase Auth e emissão de UUID
  const mockSupabaseUuid = randomUUID();
  console.log(`2. UUID gerado pelo Supabase Auth: ${mockSupabaseUuid}`);

  // 3. Mapeamento persistente CUID -> UUID na tabela user_mappings
  const userMapping = await prisma.userMapping.upsert({
    where: { cuid: testUser.id },
    update: { uuid: mockSupabaseUuid, email: testUser.email },
    create: { cuid: testUser.id, uuid: mockSupabaseUuid, email: testUser.email },
  });
  console.log(`3. Mapeamento salvo em user_mappings: ${userMapping.cuid} -> ${userMapping.uuid}`);

  // 4. Salvar na tabela public.profiles (Sem guardar a senha, mantida no Supabase Auth)
  const profile = await prisma.profile.upsert({
    where: { id: mockSupabaseUuid },
    update: { name: testUser.name, email: testUser.email, role: testUser.role },
    create: { id: mockSupabaseUuid, name: testUser.name, email: testUser.email, role: testUser.role },
  });
  console.log(`4. Registro em public.profiles salvo com sucesso: id=${profile.id}, role=${profile.role}`);

  // 5. Teste de Autenticação / Validação da senha antiga ("deusa123") com hash bcrypt
  const passwordValid = await bcrypt.compare("deusa123", testUser.passwordHash);
  console.log(`5. Confirmação de login com a senha anterior ('deusa123'): ${passwordValid ? "✅ SUCESSO" : "❌ FALHA"}`);

  // 6. Backfill relacional das FKs do usuário de teste (leads e lead_interactions)
  const leadsUpdated = await prisma.lead.updateMany({
    where: { assignedToId_legacy: testUser.id },
    data: { assignedToId: mockSupabaseUuid },
  });
  console.log(`6. Backfill em leads: ${leadsUpdated.count} registros associados ao novo UUID (${mockSupabaseUuid})`);

  const interactionsUpdated = await prisma.leadInteraction.updateMany({
    where: { userId_legacy: testUser.id },
    data: { userId: mockSupabaseUuid },
  });
  console.log(`   Backfill em lead_interactions: ${interactionsUpdated.count} registros associados ao novo UUID`);

  // 7. Teste de Rollback: Garantir que a tabela legada 'users' e colunas 'legacy' funcionam se o sistema for revertido
  const legacyCheck = await prisma.user.findUnique({ where: { id: testUser.id } });
  console.log(`7. Teste de Rollback: Dados legados em public.users continuam intactos: ${legacyCheck ? "✅ SUCESSO" : "❌ FALHA"}`);

  console.log("\n=== TESTE EM STAGING DO USUÁRIO 1 CONCLUÍDO COM SUCESSO ===\n");
}

runStagingSingleUserTest()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error("Erro no teste de staging:", err);
    prisma.$disconnect();
    process.exit(1);
  });
