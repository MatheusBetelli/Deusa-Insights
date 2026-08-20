import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { GeocodingService } from "../src/common/geocoding.service";

const prisma = new PrismaClient();
const geocodingService = new GeocodingService();

async function main() {
  throw new Error(
    "Script desativado: geocodificação em massa por API paga não é permitida. Use correção individual autorizada.",
  );

  console.log("\n=======================================================");
  console.log("  DEUSA ANALYTICS — GEOCODIFICAÇÃO EM LOTE GOOGLE MAPS ");
  console.log("=======================================================\n");

  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) {
    console.error("❌ ERRO: A variável GOOGLE_MAPS_API_KEY não foi encontrada no arquivo backend/.env.");
    console.error("   Por favor, insira a chave fornecida pela empresa no backend/.env e tente novamente.\n");
    process.exit(1);
  }

  const masked = `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
  console.log(`✅ Chave detectada com sucesso (${masked}).`);

  // Target CNAE 4712100 & 4711302
  const cnaeCode = process.argv[2] || "4712100";
  console.log(`🎯 Alvo selecionado: CNAE ${cnaeCode} (Minimercados, mercearias e armazéns)\n`);

  const pendingCompanies = await prisma.company.findMany({
    where: {
      OR: [
        { cnaePrincipal: cnaeCode },
        { cnaes: { some: { cnaeCode } } },
      ],
      latitudeVerificada: null,
    },
    include: { details: true },
  });

  console.log(`📊 Encontrados ${pendingCompanies.length} estabelecimentos pendentes de geocodificação de alta precisão.\n`);

  if (pendingCompanies.length === 0) {
    console.log("🎉 Todos os estabelecimentos já possuem coordenadas de alta precisão salvas!\n");
    return;
  }

  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < pendingCompanies.length; i++) {
    const company = pendingCompanies[i];
    console.log(`[${i + 1}/${pendingCompanies.length}] Geocodificando: ${company.nomeFantasia || company.razaoSocial} (${company.cidade}/${company.uf})...`);

    const result = await geocodingService.geocodeAndVerify({
      razaoSocial: company.razaoSocial,
      nomeFantasia: company.nomeFantasia,
      logradouro: company.logradouro,
      numero: company.numero,
      bairro: company.bairro,
      cep: company.cep,
      cidade: company.cidade,
      uf: company.uf,
      telefone: company.details?.telefone,
    });

    if (result) {
      successCount++;
      const isValido = result.confianca >= 60;
      const statusVerificacaoEndereco = result.confianca >= 90 ? "verificado" : result.confianca >= 60 ? "provavel" : "divergente";

      await prisma.company.update({
        where: { id: company.id },
        data: {
          latitude: isValido ? result.lat : null,
          longitude: isValido ? result.lng : null,
          latitudeVerificada: result.lat,
          longitudeVerificada: result.lng,
          enderecoVerificado: result.enderecoRetornado,
          fonteGeocodificacao: result.fonte,
          confiancaVerificacao: result.confianca,
          statusVerificacaoEndereco,
          dataVerificacaoGeo: result.dataVerificacao,
          origemCoordenada: isValido ? "geocodificado" : "sem_coordenada",
        },
      });
      if (isValido) {
        console.log(`   📍 Sucesso! Confiança: ${result.confianca}% | Lat: ${result.lat}, Lng: ${result.lng}`);
      } else {
        console.log(`   ⚠️ Divergente! Confiança: ${result.confianca}% | Endereço retornado: ${result.enderecoRetornado}`);
      }
      console.log(`      Endereço retornado: ${result.enderecoRetornado}\n`);
    } else {
      failedCount++;
      console.log(`   ⚠️ Não foi possível obter coordenadas de alta precisão no Google.\n`);
    }
  }

  console.log("=======================================================");
  console.log(`  RESUMO DA EXECUÇÃO:`);
  console.log(`  Total Processado: ${pendingCompanies.length}`);
  console.log(`  Com Sucesso:      ${successCount}`);
  console.log(`  Falhas:           ${failedCount}`);
  console.log(`  Custo estimado no plano grátis: $0.00 USD`);
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
