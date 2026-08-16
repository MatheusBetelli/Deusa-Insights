import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { GeocodingService } from '../src/common/geocoding.service';
import { MapOpportunitiesService } from '../src/map-opportunities/map-opportunities.service';

const MONITORED_CITIES = [
  'Tupã', 'Marília', 'Pompeia', 'Garça', 'Quintana', 'Vera Cruz', 'Oriente',
  'Echaporã', 'Herculândia', 'Iacri', 'Parapuã', 'Rinópolis', 'Gália', 'Bastos',
  'Assis', 'Ourinhos', 'Lins', 'Bauru', 'Presidente Prudente', 'Araçatuba',
  'Adamantina', 'Lucélia', 'Osvaldo Cruz', 'Dracena', 'Ribeirão Preto', 'Franca'
];

async function main() {
  console.log('🚀 Iniciando Descoberta Completa para as 26 Cidades Monitoradas via Google Places...\n');
  const prisma = new PrismaClient();
  const geocoding = new GeocodingService();
  const service = new MapOpportunitiesService(prisma as any, geocoding);

  const resultsTable: any[] = [];

  for (const city of MONITORED_CITIES) {
    console.log(`📍 Processando cidade: ${city}/SP...`);
    const start = Date.now();
    const res = await service.discoverRegion(city, 'SP');
    const elapsedSec = ((Date.now() - start) / 1000).toFixed(1);

    if (res.success && res.diagnostico) {
      resultsTable.push({
        Cidade: city,
        Queries: res.diagnostico.queriesExecutadas,
        Brutos: res.diagnostico.resultadosBrutos,
        Unicos: res.diagnostico.resultadosUnicos,
        Primary: res.diagnostico.cnaePrimary,
        Secondary: res.diagnostico.cnaeSecondary,
        JáExistiam: res.diagnostico.jaExistentesNoBanco,
        NovosPersistidos: res.diagnostico.novosPersistidos,
        TotalMapa: res.diagnostico.renderizaveisNoMapa,
        Tempo: `${elapsedSec}s`,
      });
    } else {
      console.warn(`⚠️ Erro ou sem diagnóstico para ${city}: ${res.message}`);
    }
  }

  console.log('\n=====================================================================================');
  console.log('📊 RESUMO CONSOLIDADO DA DESCOBERTA NAS 26 CIDADES MONITORADAS');
  console.log('=====================================================================================');
  console.table(resultsTable);

  const totalMap = resultsTable.reduce((acc, r) => acc + (r.TotalMapa || 0), 0);
  const totalNovos = resultsTable.reduce((acc, r) => acc + (r.NovosPersistidos || 0), 0);
  console.log(`\n🎉 DESCOBERTA FINALIZADA!`);
  console.log(`✨ Total de Novos Estabelecimentos Persistidos: ${totalNovos}`);
  console.log(`🗺️  Total de Estabelecimentos Comerciais Disponíveis no Mapa (26 Cidades): ${totalMap}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('❌ Erro na execução:', err);
  process.exit(1);
});
