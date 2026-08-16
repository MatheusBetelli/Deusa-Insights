/**
 * AUDITORIA HONESTA DOS 3.051 REGISTROS SUSPEITOS
 *
 * Este script analisa COM TRANSPARÊNCIA:
 * 1. Quais campos o filtro atual usa para validar registros do banco
 * 2. Se os registros antigos realmente têm esses campos preenchidos
 * 3. Quantos foram descartados por qual motivo REAL
 * 4. Quantos foram descartados por falta de dados (inconclusivos)
 * 5. Testes unitários inline das 4 categorias alvo e do caso Mercadinho
 *
 * NENHUM DADO É ALTERADO.
 */

import { PrismaClient } from "@prisma/client";
import {
  isValidOpportunityCnae,
  isRuralOrNonCommercialLocation,
  isWithinUrbanTerritory,
} from "../src/common/opportunity-filter";

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// SEÇÃO 1: TESTES INLINE OBRIGATÓRIOS (executados antes da auditoria do banco)
// ─────────────────────────────────────────────────────────────────────────────

type TestCase = {
  name: string;
  input: {
    displayName: string;
    primaryType: string;
    businessStatus: string;
    cidade?: string;
    lat?: number;
    lng?: number;
  };
  expected: boolean;
  expectedReason: string;
};

function simulateIngestFilter(tc: TestCase): {
  accepted: boolean;
  reason: string;
} {
  // Simula exatamente a lógica do discoverRegion() no map-opportunities.service.ts

  // Passo 1: businessStatus deve ser OPERATIONAL
  if (tc.input.businessStatus && tc.input.businessStatus !== "OPERATIONAL") {
    return { accepted: false, reason: "businessStatus !== OPERATIONAL" };
  }

  // Passo 2: primaryType tem PRIORIDADE ABSOLUTA (nenhum fallback por nome)
  const primaryType = tc.input.primaryType;
  const allowedPrimaryTypes = [
    "supermarket",
    "hypermarket",
    "grocery_store",
    "asian_grocery_store",
    "japanese_grocery_store",
    "butcher_shop",
  ];

  let inferredCnae = "";
  if (primaryType === "supermarket") inferredCnae = "4711302";
  else if (primaryType === "hypermarket") inferredCnae = "4711301";
  else if (
    primaryType === "grocery_store" ||
    primaryType === "asian_grocery_store" ||
    primaryType === "japanese_grocery_store"
  )
    inferredCnae = "4712100";
  else if (primaryType === "butcher_shop") inferredCnae = "4722901";
  else {
    // TIPO INCOMPATÍVEL: nome NUNCA sobrescreve primaryType
    return {
      accepted: false,
      reason: `primaryType incompatível (${primaryType || "ausente"}) — nome ignorado`,
    };
  }

  // Passo 3: isValidOpportunityCnae (já garantido pelo mapeamento acima, mas verificado)
  if (!isValidOpportunityCnae(inferredCnae)) {
    return { accepted: false, reason: `CNAE inferido inválido: ${inferredCnae}` };
  }

  // Passo 4: Não-rural (regex no nome)
  if (
    isRuralOrNonCommercialLocation({
      nomeFantasia: tc.input.displayName,
      razaoSocial: tc.input.displayName,
    })
  ) {
    return {
      accepted: false,
      reason: `Nome contém keyword não-comercial (regex NON_TARGET_KEYWORDS)`,
    };
  }

  // Passo 5: Dentro do perímetro urbano (se lat/lng disponíveis)
  if (
    tc.input.cidade &&
    tc.input.lat !== undefined &&
    tc.input.lng !== undefined
  ) {
    if (!isWithinUrbanTerritory(tc.input.cidade, tc.input.lat, tc.input.lng, "SP")) {
      return { accepted: false, reason: `Fora do perímetro urbano de ${tc.input.cidade}` };
    }
  }

  return { accepted: true, reason: `CNAE ${inferredCnae} — ${primaryType} OPERATIONAL` };
}

const TEST_CASES: TestCase[] = [
  // Caso real reportado pelo usuário — DEVE SER DESCARTADO
  {
    name: "Mercadinho Novo Bastos (health_food_store)",
    input: {
      displayName: "Mercadinho Novo Bastos",
      primaryType: "health_food_store",
      businessStatus: "OPERATIONAL",
      cidade: "Bastos",
      lat: -21.9235,
      lng: -50.7256,
    },
    expected: false,
    expectedReason: "primaryType incompatível mesmo com nome contendo 'Mercadinho'",
  },
  // 4 tipos alvo — DEVEM SER ACEITOS
  {
    name: "Supermercado OPERATIONAL",
    input: {
      displayName: "Supermercado Central",
      primaryType: "supermarket",
      businessStatus: "OPERATIONAL",
      cidade: "Marília",
      lat: -22.215,
      lng: -49.948,
    },
    expected: true,
    expectedReason: "supermarket OPERATIONAL dentro do perímetro",
  },
  {
    name: "Hipermercado OPERATIONAL",
    input: {
      displayName: "Hipermercado ABC",
      primaryType: "hypermarket",
      businessStatus: "OPERATIONAL",
      cidade: "Marília",
      lat: -22.215,
      lng: -49.948,
    },
    expected: true,
    expectedReason: "hypermarket OPERATIONAL dentro do perímetro",
  },
  {
    name: "grocery_store OPERATIONAL (Minimercado)",
    input: {
      displayName: "Minimercado do Bairro",
      primaryType: "grocery_store",
      businessStatus: "OPERATIONAL",
      cidade: "Garça",
      lat: -22.215,
      lng: -49.655,
    },
    expected: true,
    expectedReason: "grocery_store OPERATIONAL dentro do perímetro",
  },
  {
    name: "butcher_shop OPERATIONAL (Açougue)",
    input: {
      displayName: "Açougue São Paulo",
      primaryType: "butcher_shop",
      businessStatus: "OPERATIONAL",
      cidade: "Garça",
      lat: -22.215,
      lng: -49.655,
    },
    expected: true,
    expectedReason: "butcher_shop OPERATIONAL dentro do perímetro",
  },
  // Fechados — DEVEM SER DESCARTADOS
  {
    name: "Supermercado CLOSED_PERMANENTLY",
    input: {
      displayName: "Supermercado Fechado",
      primaryType: "supermarket",
      businessStatus: "CLOSED_PERMANENTLY",
    },
    expected: false,
    expectedReason: "businessStatus CLOSED_PERMANENTLY",
  },
  {
    name: "grocery_store CLOSED_TEMPORARILY",
    input: {
      displayName: "Minimercado Fechado",
      primaryType: "grocery_store",
      businessStatus: "CLOSED_TEMPORARILY",
    },
    expected: false,
    expectedReason: "businessStatus CLOSED_TEMPORARILY",
  },
  // Tipos incompatíveis com nome de mercado — DEVEM SER DESCARTADOS
  {
    name: "bakery com nome 'Mercadinho' (tipo incompatível)",
    input: {
      displayName: "Mercadinho Pão Quente",
      primaryType: "bakery",
      businessStatus: "OPERATIONAL",
    },
    expected: false,
    expectedReason: "primaryType bakery incompatível, nome ignorado",
  },
  {
    name: "liquor_store com nome 'Super Bom' (tipo incompatível)",
    input: {
      displayName: "Super Bom Bebidas",
      primaryType: "liquor_store",
      businessStatus: "OPERATIONAL",
    },
    expected: false,
    expectedReason: "primaryType liquor_store incompatível",
  },
  {
    name: "Supermercado com primaryType ausente",
    input: {
      displayName: "Supermercado Sem Tipo",
      primaryType: "",
      businessStatus: "OPERATIONAL",
    },
    expected: false,
    expectedReason: "primaryType ausente — descartado por segurança",
  },
];

function runInlineTests() {
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log(" SEÇÃO 1 — TESTES INLINE DO FILTRO DE INGESTÃO (LÓGICA ATUAL)");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  let passed = 0;
  let failed = 0;

  for (const tc of TEST_CASES) {
    const result = simulateIngestFilter(tc);
    const ok = result.accepted === tc.expected;
    if (ok) passed++;
    else failed++;

    const icon = ok ? "✅" : "❌";
    const got = result.accepted ? "ACEITO" : "DESCARTADO";
    const exp = tc.expected ? "ACEITO" : "DESCARTADO";

    console.log(`${icon} [${tc.name}]`);
    console.log(`   Esperado : ${exp} (${tc.expectedReason})`);
    console.log(`   Obtido   : ${got} → ${result.reason}`);
    if (!ok) {
      console.log(`   *** FALHA! Comportamento diverge do esperado ***`);
    }
    console.log();
  }

  console.log(`── Resultado dos Testes Inline ────────────────────────────────────────`);
  console.log(`✅ Aprovados: ${passed} / ${TEST_CASES.length}`);
  console.log(`❌ Reprovados: ${failed} / ${TEST_CASES.length}`);
  if (failed > 0) {
    console.log(`\n⚠️  ATENÇÃO: Há testes falhando. NÃO PROSSIGA com limpeza até corrigir.\n`);
  } else {
    console.log(`\n✅ Todos os testes inline passaram. Lógica do filtro está correta.\n`);
  }
  return failed === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEÇÃO 2: AUDITORIA HONESTA DO BANCO DE DADOS
// Verifica quais campos os registros antigos têm e categoriza motivos reais
// ─────────────────────────────────────────────────────────────────────────────

type DisqualifyReason =
  | "CNAE_INVALIDO"
  | "SITUACAO_INATIVA"
  | "NOME_INCOMPATIVEL_REGEX"
  | "SEM_CNAE_E_SEM_PLACEID"
  | "FORA_PERIMETRO_URBANO"
  | "DADOS_INSUFICIENTES_INCONCLUSIVO";

type AuditedRecord = {
  id: string;
  nome: string;
  cidade: string;
  cnae: string | null;
  source: string;
  temCnae: boolean;
  temPlaceId: boolean;
  temLatLon: boolean;
  temSituacaoCadastral: boolean;
  situacaoCadastral: string;
  reason: DisqualifyReason;
};

async function runDatabaseAudit() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" SEÇÃO 2 — AUDITORIA HONESTA DOS REGISTROS DO BANCO (DIAGNÓSTICO)");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const companies = await prisma.company.findMany({
    select: {
      id: true,
      cnpj: true,
      placeId: true,
      source: true,
      nomeFantasia: true,
      razaoSocial: true,
      situacaoCadastral: true,
      cnaePrincipal: true,
      cidade: true,
      uf: true,
      latitude: true,
      longitude: true,
      logradouro: true,
      bairro: true,
      complemento: true,
      lastSyncAt: true,
      createdAt: true,
    },
  });

  console.log(`Total de registros na tabela companies: ${companies.length}\n`);

  // Análise de preenchimento dos campos críticos
  let semCnae = 0;
  let semPlaceId = 0;
  let semLatLon = 0;
  let semSituacaoCadastral = 0;
  let temTodosOsCampos = 0;

  for (const c of companies) {
    if (!c.cnaePrincipal) semCnae++;
    if (!c.placeId) semPlaceId++;
    if (!c.latitude || !c.longitude) semLatLon++;
    if (!c.situacaoCadastral) semSituacaoCadastral++;
    if (c.cnaePrincipal && c.placeId && c.latitude && c.longitude && c.situacaoCadastral) temTodosOsCampos++;
  }

  console.log("── Completude dos Campos Críticos para o Filtro ───────────────────────");
  console.log(`  Total de registros                  : ${companies.length}`);
  console.log(`  Com CNAE preenchido                 : ${companies.length - semCnae} (${((companies.length - semCnae) / companies.length * 100).toFixed(1)}%)`);
  console.log(`  Sem CNAE                            : ${semCnae} (${(semCnae / companies.length * 100).toFixed(1)}%)`);
  console.log(`  Com placeId do Google               : ${companies.length - semPlaceId} (${((companies.length - semPlaceId) / companies.length * 100).toFixed(1)}%)`);
  console.log(`  Sem placeId                         : ${semPlaceId} (${(semPlaceId / companies.length * 100).toFixed(1)}%)`);
  console.log(`  Com latitude/longitude              : ${companies.length - semLatLon} (${((companies.length - semLatLon) / companies.length * 100).toFixed(1)}%)`);
  console.log(`  Sem lat/lon                         : ${semLatLon} (${(semLatLon / companies.length * 100).toFixed(1)}%)`);
  console.log(`  Com situaçãoCadastral               : ${companies.length - semSituacaoCadastral} (${((companies.length - semSituacaoCadastral) / companies.length * 100).toFixed(1)}%)`);
  console.log(`  Com TODOS os campos críticos        : ${temTodosOsCampos} (${(temTodosOsCampos / companies.length * 100).toFixed(1)}%)`);

  // NOTA CRÍTICA: o filtro do banco usa cnaePrincipal, NÃO primaryType do Google
  console.log(`\n⚠️  IMPORTANTE: O filtro do banco usa 'cnaePrincipal' (campo do Prisma),`);
  console.log(`   NÃO 'primaryType' do Google Places. Os registros do Google têm o CNAE`);
  console.log(`   INFERIDO no momento da ingestão e armazenado em 'cnaePrincipal'.`);
  console.log(`   'primaryType' NÃO é persistido na tabela companies atualmente.\n`);

  // Categorização dos registros inválidos
  let validos = 0;
  const descartados: Record<DisqualifyReason, AuditedRecord[]> = {
    CNAE_INVALIDO: [],
    SITUACAO_INATIVA: [],
    NOME_INCOMPATIVEL_REGEX: [],
    SEM_CNAE_E_SEM_PLACEID: [],
    FORA_PERIMETRO_URBANO: [],
    DADOS_INSUFICIENTES_INCONCLUSIVO: [],
  };

  for (const comp of companies) {
    const status = (comp.situacaoCadastral || "").toUpperCase().trim();
    const nome = comp.nomeFantasia || comp.razaoSocial || "";
    const record: Omit<AuditedRecord, "reason"> = {
      id: comp.id,
      nome,
      cidade: comp.cidade,
      cnae: comp.cnaePrincipal,
      source: comp.source,
      temCnae: !!comp.cnaePrincipal,
      temPlaceId: !!comp.placeId,
      temLatLon: !!(comp.latitude && comp.longitude),
      temSituacaoCadastral: !!comp.situacaoCadastral,
      situacaoCadastral: comp.situacaoCadastral,
    };

    // 1. Situação inativa
    if (status && status !== "ATIVA" && status !== "ATIVO") {
      descartados.SITUACAO_INATIVA.push({ ...record, reason: "SITUACAO_INATIVA" });
      continue;
    }

    // 2. Sem CNAE e sem placeId (não é possível classificar — INCONCLUSIVO)
    if (!comp.cnaePrincipal && !comp.placeId) {
      descartados.DADOS_INSUFICIENTES_INCONCLUSIVO.push({
        ...record,
        reason: "DADOS_INSUFICIENTES_INCONCLUSIVO",
      });
      continue;
    }

    // 3. Sem CNAE apenas (placeId existe mas CNAE não foi inferido)
    if (!comp.cnaePrincipal) {
      descartados.SEM_CNAE_E_SEM_PLACEID.push({ ...record, reason: "SEM_CNAE_E_SEM_PLACEID" });
      continue;
    }

    // 4. CNAE inválido (não pertence às 4 categorias alvo)
    if (!isValidOpportunityCnae(comp.cnaePrincipal)) {
      descartados.CNAE_INVALIDO.push({ ...record, reason: "CNAE_INVALIDO" });
      continue;
    }

    // 5. Nome/razão social contém keyword incompatível (regex)
    if (
      isRuralOrNonCommercialLocation({
        nomeFantasia: comp.nomeFantasia,
        razaoSocial: comp.razaoSocial,
        logradouro: comp.logradouro,
        bairro: comp.bairro,
        complemento: comp.complemento,
      })
    ) {
      descartados.NOME_INCOMPATIVEL_REGEX.push({ ...record, reason: "NOME_INCOMPATIVEL_REGEX" });
      continue;
    }

    // 6. Fora do perímetro urbano (apenas se lat/lon disponíveis)
    if (
      comp.latitude &&
      comp.longitude &&
      !isWithinUrbanTerritory(comp.cidade, comp.latitude, comp.longitude, comp.uf)
    ) {
      descartados.FORA_PERIMETRO_URBANO.push({ ...record, reason: "FORA_PERIMETRO_URBANO" });
      continue;
    }

    validos++;
  }

  const totalDescartados = Object.values(descartados).reduce((sum, arr) => sum + arr.length, 0);

  console.log("── Categorização dos Registros Descartados ────────────────────────────");
  console.log(`✅ Oportunidades Válidas (passam em todos os filtros)  : ${validos}`);
  console.log(`──────────────────────────────────────────────────────────────────────`);
  console.log(`⚠️  Total Descartados                                  : ${totalDescartados}`);
  console.log(`   ├─ CNAE inválido (fora das 4 categorias)            : ${descartados.CNAE_INVALIDO.length}`);
  console.log(`   ├─ Situação Cadastral Inativa/Fechada               : ${descartados.SITUACAO_INATIVA.length}`);
  console.log(`   ├─ Nome/endereço contém keyword não-comercial       : ${descartados.NOME_INCOMPATIVEL_REGEX.length}`);
  console.log(`   ├─ Sem CNAE (apenas placeId, CNAE não foi inferido) : ${descartados.SEM_CNAE_E_SEM_PLACEID.length}`);
  console.log(`   ├─ Fora do perímetro urbano da cidade               : ${descartados.FORA_PERIMETRO_URBANO.length}`);
  console.log(`   └─ INCONCLUSIVOS (sem CNAE e sem placeId)           : ${descartados.DADOS_INSUFICIENTES_INCONCLUSIVO.length}`);

  // Exemplos dos primeiros registros por categoria
  const printSamples = (label: string, arr: AuditedRecord[], n = 5) => {
    if (arr.length === 0) return;
    console.log(`\n   Exemplos de "${label}" (primeiros ${Math.min(n, arr.length)} de ${arr.length}):`);
    arr.slice(0, n).forEach((r, i) => {
      console.log(
        `   ${i + 1}. [${r.cidade}] ${r.nome} | CNAE: ${r.cnae || "NULL"} | Source: ${r.source} | placeId: ${r.temPlaceId ? "✓" : "✗"} | lat/lon: ${r.temLatLon ? "✓" : "✗"}`
      );
    });
  };

  printSamples("CNAE_INVALIDO", descartados.CNAE_INVALIDO, 5);
  printSamples("SITUACAO_INATIVA", descartados.SITUACAO_INATIVA, 5);
  printSamples("NOME_INCOMPATIVEL_REGEX", descartados.NOME_INCOMPATIVEL_REGEX, 5);
  printSamples("SEM_CNAE", descartados.SEM_CNAE_E_SEM_PLACEID, 5);
  printSamples("FORA_PERIMETRO_URBANO", descartados.FORA_PERIMETRO_URBANO, 5);
  printSamples("INCONCLUSIVOS", descartados.DADOS_INSUFICIENTES_INCONCLUSIVO, 5);

  // Análise por fonte dos descartados
  const bySource: Record<string, number> = {};
  for (const arr of Object.values(descartados)) {
    for (const r of arr) {
      bySource[r.source] = (bySource[r.source] || 0) + 1;
    }
  }

  console.log(`\n── Descartados por Fonte de Dados ─────────────────────────────────────`);
  Object.entries(bySource)
    .sort((a, b) => b[1] - a[1])
    .forEach(([src, count]) => {
      console.log(`   ${src}: ${count} registros`);
    });

  // CONCLUSÃO DA CONFIABILIDADE
  const inconclusivos = descartados.DADOS_INSUFICIENTES_INCONCLUSIVO.length;
  const semCnaeApenas = descartados.SEM_CNAE_E_SEM_PLACEID.length;
  const totalIncerto = inconclusivos + semCnaeApenas;

  console.log(`\n══════════════════════════════════════════════════════════════════════`);
  console.log(` CONCLUSÃO DA AUDITORIA`);
  console.log(`══════════════════════════════════════════════════════════════════════`);
  console.log(`\n1. O filtro do banco NÃO usa primaryType do Google (não é persistido).`);
  console.log(`   Usa CNAE inferido no momento da ingestão + nome (regex) + geofence.`);
  console.log(``);
  console.log(`2. Dos ${totalDescartados} registros descartados:`);
  console.log(`   • ${descartados.CNAE_INVALIDO.length} têm CNAE inválido (dado CONCRETO — confiável para limpeza)`);
  console.log(`   • ${descartados.SITUACAO_INATIVA.length} estão inativos/fechados (dado CONCRETO — confiável)`);
  console.log(`   • ${descartados.NOME_INCOMPATIVEL_REGEX.length} foram rejeitados por keyword no nome (ATENÇÃO: regex pode ter falsos positivos)`);
  console.log(`   • ${descartados.FORA_PERIMETRO_URBANO.length} fora do perímetro urbano (confiável se lat/lon corretos)`);
  console.log(`   • ${totalIncerto} INCONCLUSIVOS — sem dados suficientes para confirmar.`);
  console.log(``);

  if (totalIncerto > 0) {
    console.log(`⚠️  RISCO: Há ${totalIncerto} registros inconclusivos por falta de dados.`);
    console.log(`   A auditoria NÃO É CONFIÁVEL para limpar esses registros automaticamente.`);
    console.log(`   Recomendação: marcar como 'pendente_revisao' e NÃO excluir.`);
  }

  if (descartados.NOME_INCOMPATIVEL_REGEX.length > 0) {
    console.log(`\n⚠️  RISCO: ${descartados.NOME_INCOMPATIVEL_REGEX.length} registros descartados por regex de nome.`);
    console.log(`   Verifique manualmente se algum supermercado real tem 'bar' no endereço`);
    console.log(`   (ex: "Rua do Bar 123" ou "Bairro São João Bar Alto") antes de excluir.`);
  }

  console.log(`\n✅ Auditoria concluída. NENHUM DADO FOI ALTERADO.`);
  console.log(`══════════════════════════════════════════════════════════════════════\n`);

  await prisma.$disconnect();
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const testsOk = runInlineTests();
  if (!testsOk) {
    console.error("\n❌ Testes inline falharam. Corrija antes de auditar a base.\n");
    await prisma.$disconnect();
    process.exit(1);
  }
  await runDatabaseAudit();
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  prisma.$disconnect();
  process.exit(1);
});
