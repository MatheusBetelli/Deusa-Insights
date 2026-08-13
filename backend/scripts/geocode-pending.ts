import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { GeocodingService } from "../src/common/geocoding.service";

const prisma = new PrismaClient();
const geocodingService = new GeocodingService();

async function main() {
  console.log("\n=======================================================");
  console.log("  DEUSA ANALYTICS — GEOCODIFICAÇÃO DE EMPRESAS PENDENTES ");
  console.log("=======================================================\n");

  geocodingService.onModuleInit();

  if (!geocodingService.isAvailable()) {
    console.error("❌ GOOGLE_MAPS_API_KEY não encontrada ou inválida.");
    process.exit(1);
  }

  const city = process.argv[2];

  const whereClause: any = {
    OR: [
      { latitude: null },
      { longitude: null },
      { latitude: 0 },
      { longitude: 0 },
      { origemCoordenada: { contains: "centroide" } },
    ],
  };

  if (city) {
    whereClause.cidade = { equals: city, mode: "insensitive" };
    console.log(`🎯 Filtrando por cidade: ${city}\n`);
  }

  const pendingCompanies = await prisma.company.findMany({
    where: whereClause,
    include: { details: true },
  });

  console.log(`📊 Encontrados ${pendingCompanies.length} estabelecimentos com localização pendente/aproximada.\n`);

  if (pendingCompanies.length === 0) {
    console.log("🎉 Todos os estabelecimentos selecionados já possuem coordenadas verificadas!\n");
    return;
  }

  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < pendingCompanies.length; i++) {
    const company = pendingCompanies[i];
    const name = company.nomeFantasia || company.razaoSocial;
    console.log(`[${i + 1}/${pendingCompanies.length}] Geocodificando: ${name} (${company.cidade}/${company.uf})...`);

    const result = await geocodingService.geocodeAndVerify({
      cnpj: company.cnpj,
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
      const confianca = result.confianca;
      const statusVerificacaoEndereco = confianca >= 90 ? "verificado" : confianca >= 60 ? "provavel" : "divergente";
      const isValido = confianca >= 60 && statusVerificacaoEndereco !== "divergente";

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
          placeId: result.placeId ?? undefined,
          nomeEncontrado: result.placeName ?? undefined,
          telefoneEncontrado: result.placePhone ?? undefined,
          categoriaEncontrada: result.placeCategory ?? undefined,
        },
      });

      if (isValido) {
        console.log(`   📍 Sucesso! Confiança: ${result.confianca}% | Lat: ${result.lat}, Lng: ${result.lng}`);
      } else {
        console.log(`   ⚠️ Coordenada Divergente! Confiança: ${result.confianca}% | Mantida sem localização física em: ${result.enderecoRetornado}`);
      }
      console.log(`      Endereço retornado: ${result.enderecoRetornado}\n`);
    } else {
      failedCount++;
      console.log(`   ⚠️ Não foi possível obter coordenadas no Google Maps.\n`);
    }

    // Small delay for rate-limiting
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  console.log("=======================================================");
  console.log(`  RESUMO DA EXECUÇÃO:`);
  console.log(`  Total Processado: ${pendingCompanies.length}`);
  console.log(`  Com Sucesso:      ${successCount}`);
  console.log(`  Falhas:           ${failedCount}`);
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
