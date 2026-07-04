import type { City } from "@/types/city";
import type { Cnae } from "@/types/cnae";
import type { Company } from "@/types/company";
import type { DashboardSummary } from "@/types/dashboard";
import type { ImportJob } from "@/types/importJob";
import type { Lead, LeadInteraction, LeadStatus, PotentialLevel, UserSummary } from "@/types/lead";
import type { MapOpportunity } from "@/types/mapOpportunity";
import type { Pipeline } from "@/types/pipeline";

const updatedAt = "2026-06-18T08:42:00.000Z";

const users: UserSummary[] = [
  { id: "usr-rafael", name: "Rafael Mendes", email: "rafael.mendes@deusa.com.br", role: "SALES" },
  {
    id: "usr-mariana",
    name: "Mariana Alves",
    email: "mariana.alves@deusa.com.br",
    role: "MANAGER",
  },
  { id: "usr-camila", name: "Camila Rocha", email: "camila.rocha@deusa.com.br", role: "SALES" },
  { id: "usr-felipe", name: "Felipe Lima", email: "felipe.lima@deusa.com.br", role: "SALES" },
];

const cities: City[] = [
  {
    id: "city-tupa",
    name: "Tupã",
    uf: "SP",
    ibgeCode: "3555000",
    isActive: true,
    createdAt: updatedAt,
    updatedAt,
  },
  {
    id: "city-marilia",
    name: "Marília",
    uf: "SP",
    ibgeCode: "3529005",
    isActive: true,
    createdAt: updatedAt,
    updatedAt,
  },
  {
    id: "city-pompeia",
    name: "Pompeia",
    uf: "SP",
    ibgeCode: "3540002",
    isActive: true,
    createdAt: updatedAt,
    updatedAt,
  },
  {
    id: "city-garca",
    name: "Garça",
    uf: "SP",
    ibgeCode: "3516705",
    isActive: true,
    createdAt: updatedAt,
    updatedAt,
  },
  {
    id: "city-bastos",
    name: "Bastos",
    uf: "SP",
    ibgeCode: "3505807",
    isActive: true,
    createdAt: updatedAt,
    updatedAt,
  },
  {
    id: "city-assis",
    name: "Assis",
    uf: "SP",
    ibgeCode: "3504008",
    isActive: true,
    createdAt: updatedAt,
    updatedAt,
  },
  {
    id: "city-ourinhos",
    name: "Ourinhos",
    uf: "SP",
    ibgeCode: "3534708",
    isActive: true,
    createdAt: updatedAt,
    updatedAt,
  },
  {
    id: "city-lins",
    name: "Lins",
    uf: "SP",
    ibgeCode: "3527108",
    isActive: true,
    createdAt: updatedAt,
    updatedAt,
  },
  {
    id: "city-bauru",
    name: "Bauru",
    uf: "SP",
    ibgeCode: "3506003",
    isActive: true,
    createdAt: updatedAt,
    updatedAt,
  },
  {
    id: "city-prudente",
    name: "Presidente Prudente",
    uf: "SP",
    ibgeCode: "3541406",
    isActive: true,
    createdAt: updatedAt,
    updatedAt,
  },
  {
    id: "city-aracatuba",
    name: "Araçatuba",
    uf: "SP",
    ibgeCode: "3502804",
    isActive: true,
    createdAt: updatedAt,
    updatedAt,
  },
];

const cnaes: Cnae[] = [
  {
    id: "cnae-4711302",
    code: "4711302",
    description: "Supermercados",
    category: "Varejo alimentar",
    isTarget: true,
    createdAt: updatedAt,
    updatedAt,
  },
  {
    id: "cnae-4712100",
    code: "4712100",
    description: "Minimercados, mercearias e armazéns",
    category: "Varejo alimentar",
    isTarget: true,
    createdAt: updatedAt,
    updatedAt,
  },
  {
    id: "cnae-4721102",
    code: "4721102",
    description: "Padarias e confeitarias com predominância de revenda",
    category: "Varejo alimentar",
    isTarget: true,
    createdAt: updatedAt,
    updatedAt,
  },
  {
    id: "cnae-4729699",
    code: "4729699",
    description: "Comércio varejista de produtos alimentícios em geral",
    category: "Varejo alimentar",
    isTarget: true,
    createdAt: updatedAt,
    updatedAt,
  },
  {
    id: "cnae-4639701",
    code: "4639701",
    description: "Comércio atacadista de produtos alimentícios em geral",
    category: "Atacado alimentar",
    isTarget: true,
    createdAt: updatedAt,
    updatedAt,
  },
  {
    id: "cnae-5611203",
    code: "5611203",
    description: "Lanchonetes, casas de chá, de sucos e similares",
    category: "Food service",
    isTarget: false,
    createdAt: updatedAt,
    updatedAt,
  },
];

type MockCompanyInput = Omit<
  Company,
  "id" | "complemento" | "lastSyncAt" | "createdAt" | "updatedAt" | "cnaes"
>;

function company(input: MockCompanyInput): Company {
  return {
    ...input,
    id: `cmp-${input.cnpj}`,
    complemento: null,
    lastSyncAt: updatedAt,
    createdAt: updatedAt,
    updatedAt,
    cnaes: [
      {
        id: `cc-${input.cnpj}`,
        companyId: `cmp-${input.cnpj}`,
        cnaeCode: input.cnaePrincipal ?? "",
        isPrimary: true,
      },
    ],
  };
}

const companies: Company[] = [
  company({
    cnpj: "12345678000190",
    razaoSocial: "Mercadinho Sao Jose de Tupa Ltda",
    nomeFantasia: "Mercadinho São José",
    situacaoCadastral: "ATIVA",
    porte: "ME",
    matrizFilial: "MATRIZ",
    dataAbertura: "2018-04-12T00:00:00.000Z",
    cnaePrincipal: "4712100",
    uf: "SP",
    cidade: "Tupã",
    bairro: "Centro",
    cep: "17600010",
    logradouro: "Rua Caingangs",
    numero: "430",
    latitude: -21.9347,
    longitude: -50.5136,
    source: "mock",
  }),
  company({
    cnpj: "23456789000167",
    razaoSocial: "Supermercado Avenida Marilia Ltda",
    nomeFantasia: "Supermercado Avenida",
    situacaoCadastral: "ATIVA",
    porte: "EPP",
    matrizFilial: "MATRIZ",
    dataAbertura: "2012-09-03T00:00:00.000Z",
    cnaePrincipal: "4711302",
    uf: "SP",
    cidade: "Marília",
    bairro: "Jardim Maria Izabel",
    cep: "17515000",
    logradouro: "Avenida Sampaio Vidal",
    numero: "1850",
    latitude: -22.2171,
    longitude: -49.9501,
    source: "mock",
  }),
  company({
    cnpj: "11222333000144",
    razaoSocial: "Emporio Familia Pompeia Ltda",
    nomeFantasia: "Empório Família",
    situacaoCadastral: "ATIVA",
    porte: "ME",
    matrizFilial: "MATRIZ",
    dataAbertura: "2020-01-20T00:00:00.000Z",
    cnaePrincipal: "4712100",
    uf: "SP",
    cidade: "Pompeia",
    bairro: "Centro",
    cep: "17580000",
    logradouro: "Rua Getulio Vargas",
    numero: "112",
    latitude: -22.107,
    longitude: -50.1712,
    source: "mock",
  }),
  company({
    cnpj: "45678901000123",
    razaoSocial: "Mercado Uniao Garca Ltda",
    nomeFantasia: "Mercado União",
    situacaoCadastral: "ATIVA",
    porte: "EPP",
    matrizFilial: "MATRIZ",
    dataAbertura: "2016-07-18T00:00:00.000Z",
    cnaePrincipal: "4712100",
    uf: "SP",
    cidade: "Garça",
    bairro: "Williams",
    cep: "17400000",
    logradouro: "Rua Carlos Ferrari",
    numero: "760",
    latitude: -22.2125,
    longitude: -49.6546,
    source: "mock",
  }),
  company({
    cnpj: "78901234000156",
    razaoSocial: "Mini Mercado Central Bastos Ltda",
    nomeFantasia: "Mini Mercado Central",
    situacaoCadastral: "ATIVA",
    porte: "ME",
    matrizFilial: "MATRIZ",
    dataAbertura: "2019-05-11T00:00:00.000Z",
    cnaePrincipal: "4712100",
    uf: "SP",
    cidade: "Bastos",
    bairro: "Centro",
    cep: "17690000",
    logradouro: "Rua Presidente Vargas",
    numero: "95",
    latitude: -21.921,
    longitude: -50.7358,
    source: "mock",
  }),
  company({
    cnpj: "50987654000188",
    razaoSocial: "Padaria Aurora de Assis Ltda",
    nomeFantasia: "Padaria Aurora",
    situacaoCadastral: "ATIVA",
    porte: "ME",
    matrizFilial: "MATRIZ",
    dataAbertura: "2017-08-09T00:00:00.000Z",
    cnaePrincipal: "4721102",
    uf: "SP",
    cidade: "Assis",
    bairro: "Vila Claudia",
    cep: "19800040",
    logradouro: "Avenida Rui Barbosa",
    numero: "1220",
    latitude: -22.6612,
    longitude: -50.4113,
    source: "mock",
  }),
  company({
    cnpj: "60987654000177",
    razaoSocial: "Atacarejo Novo Oeste Ltda",
    nomeFantasia: "Atacarejo Novo Oeste",
    situacaoCadastral: "ATIVA",
    porte: "DEMAIS",
    matrizFilial: "MATRIZ",
    dataAbertura: "2014-03-27T00:00:00.000Z",
    cnaePrincipal: "4639701",
    uf: "SP",
    cidade: "Presidente Prudente",
    bairro: "Jardim Paulista",
    cep: "19023010",
    logradouro: "Avenida Washington Luiz",
    numero: "2840",
    latitude: -22.1211,
    longitude: -51.3881,
    source: "mock",
  }),
  company({
    cnpj: "71987654000166",
    razaoSocial: "Mercado Pioneiro Ourinhos Ltda",
    nomeFantasia: "Mercado Pioneiro",
    situacaoCadastral: "ATIVA",
    porte: "EPP",
    matrizFilial: "MATRIZ",
    dataAbertura: "2015-11-15T00:00:00.000Z",
    cnaePrincipal: "4712100",
    uf: "SP",
    cidade: "Ourinhos",
    bairro: "Centro",
    cep: "19900031",
    logradouro: "Rua Paraná",
    numero: "610",
    latitude: -22.9787,
    longitude: -49.8701,
    source: "mock",
  }),
  company({
    cnpj: "82987654000155",
    razaoSocial: "Super Lins Comercio de Alimentos Ltda",
    nomeFantasia: "Super Lins",
    situacaoCadastral: "ATIVA",
    porte: "EPP",
    matrizFilial: "MATRIZ",
    dataAbertura: "2011-06-02T00:00:00.000Z",
    cnaePrincipal: "4711302",
    uf: "SP",
    cidade: "Lins",
    bairro: "Jardim Aeroporto",
    cep: "16400070",
    logradouro: "Rua Voluntário Vitoriano Borges",
    numero: "880",
    latitude: -21.6738,
    longitude: -49.7487,
    source: "mock",
  }),
  company({
    cnpj: "93987654000144",
    razaoSocial: "Casa de Carnes e Mercearia Bela Vista Ltda",
    nomeFantasia: "Mercearia Bela Vista",
    situacaoCadastral: "ATIVA",
    porte: "ME",
    matrizFilial: "MATRIZ",
    dataAbertura: "2021-02-10T00:00:00.000Z",
    cnaePrincipal: "4729699",
    uf: "SP",
    cidade: "Bauru",
    bairro: "Vila Cardia",
    cep: "17013110",
    logradouro: "Rua Gustavo Maciel",
    numero: "1522",
    latitude: -22.3231,
    longitude: -49.0738,
    source: "mock",
  }),
  company({
    cnpj: "04987654000133",
    razaoSocial: "Emporio Noroeste Aracatuba Ltda",
    nomeFantasia: "Empório Noroeste",
    situacaoCadastral: "ATIVA",
    porte: "ME",
    matrizFilial: "MATRIZ",
    dataAbertura: "2019-12-04T00:00:00.000Z",
    cnaePrincipal: "4712100",
    uf: "SP",
    cidade: "Araçatuba",
    bairro: "São Joaquim",
    cep: "16050040",
    logradouro: "Rua do Fico",
    numero: "410",
    latitude: -21.2059,
    longitude: -50.4389,
    source: "mock",
  }),
  company({
    cnpj: "15987654000122",
    razaoSocial: "Mercado Vila Nova de Marilia Ltda",
    nomeFantasia: "Mercado Vila Nova",
    situacaoCadastral: "ATIVA",
    porte: "ME",
    matrizFilial: "MATRIZ",
    dataAbertura: "2016-10-19T00:00:00.000Z",
    cnaePrincipal: "4712100",
    uf: "SP",
    cidade: "Marília",
    bairro: "Vila Nova",
    cep: "17500080",
    logradouro: "Rua Nove de Julho",
    numero: "940",
    latitude: -22.2179,
    longitude: -49.9432,
    source: "mock",
  }),
  company({
    cnpj: "26987654000111",
    razaoSocial: "Quitanda e Mercearia Primavera Ltda",
    nomeFantasia: "Mercearia Primavera",
    situacaoCadastral: "ATIVA",
    porte: "ME",
    matrizFilial: "MATRIZ",
    dataAbertura: "2022-04-25T00:00:00.000Z",
    cnaePrincipal: "4729699",
    uf: "SP",
    cidade: "Tupã",
    bairro: "Jardim América",
    cep: "17605020",
    logradouro: "Rua Aimorés",
    numero: "731",
    latitude: -21.9275,
    longitude: -50.5098,
    source: "mock",
  }),
  company({
    cnpj: "37987654000100",
    razaoSocial: "Mini Mercado Estacao Pompeia Ltda",
    nomeFantasia: "Mini Mercado Estação",
    situacaoCadastral: "ATIVA",
    porte: "ME",
    matrizFilial: "MATRIZ",
    dataAbertura: "2018-01-08T00:00:00.000Z",
    cnaePrincipal: "4712100",
    uf: "SP",
    cidade: "Pompeia",
    bairro: "Flândria",
    cep: "17580060",
    logradouro: "Avenida Brasil",
    numero: "330",
    latitude: -22.1062,
    longitude: -50.1761,
    source: "mock",
  }),
  company({
    cnpj: "48987654000199",
    razaoSocial: "Mercado Popular Garca Ltda",
    nomeFantasia: "Mercado Popular",
    situacaoCadastral: "ATIVA",
    porte: "ME",
    matrizFilial: "MATRIZ",
    dataAbertura: "2013-09-30T00:00:00.000Z",
    cnaePrincipal: "4712100",
    uf: "SP",
    cidade: "Garça",
    bairro: "Labienópolis",
    cep: "17402080",
    logradouro: "Rua Barão do Rio Branco",
    numero: "1185",
    latitude: -22.2156,
    longitude: -49.6567,
    source: "mock",
  }),
];

const leadPlans: Array<{
  status: LeadStatus;
  score: number;
  potentialLevel: PotentialLevel;
  assignedTo: UserSummary;
  notes: string;
  lastContactAt: string | null;
  nextActionAt: string | null;
  interactions: Array<
    Pick<LeadInteraction, "type" | "description" | "createdAt"> & { user: UserSummary }
  >;
}> = [
  {
    status: "NEW",
    score: 90,
    potentialLevel: "CRITICAL",
    assignedTo: users[0],
    notes: "Alta aderência ao mix de varejo alimentar. Priorizar oferta de giro rápido.",
    lastContactAt: null,
    nextActionAt: "2026-06-26T13:00:00.000Z",
    interactions: [],
  },
  {
    status: "CONTACTED",
    score: 89,
    potentialLevel: "HIGH",
    assignedTo: users[1],
    notes: "Comprador pediu tabela de preços para linha de empanados e frios.",
    lastContactAt: "2026-06-20T13:30:00.000Z",
    nextActionAt: "2026-06-27T12:00:00.000Z",
    interactions: [
      {
        type: "Contato comercial",
        description: "Ligação com o setor de compras. Solicitou apresentação da tabela semanal.",
        createdAt: "2026-06-20T13:30:00.000Z",
        user: users[1],
      },
    ],
  },
  {
    status: "INTERESTED",
    score: 88,
    potentialLevel: "HIGH",
    assignedTo: users[2],
    notes: "Interesse em abastecimento recorrente para balcão de frios.",
    lastContactAt: "2026-06-19T18:45:00.000Z",
    nextActionAt: "2026-06-25T14:00:00.000Z",
    interactions: [
      {
        type: "WhatsApp",
        description: "Cliente confirmou interesse e pediu condições para primeira compra.",
        createdAt: "2026-06-19T18:45:00.000Z",
        user: users[2],
      },
    ],
  },
  {
    status: "NEGOTIATION",
    score: 84,
    potentialLevel: "HIGH",
    assignedTo: users[0],
    notes: "Negociando volume mínimo e entrega semanal às terças-feiras.",
    lastContactAt: "2026-06-18T17:20:00.000Z",
    nextActionAt: "2026-06-24T19:30:00.000Z",
    interactions: [
      {
        type: "Proposta",
        description: "Enviada proposta com combo inicial para linha de varejo alimentar.",
        createdAt: "2026-06-18T17:20:00.000Z",
        user: users[0],
      },
    ],
  },
  {
    status: "CONVERTED",
    score: 72,
    potentialLevel: "MEDIUM",
    assignedTo: users[3],
    notes: "Cliente convertido com pedido piloto quinzenal.",
    lastContactAt: "2026-06-17T11:50:00.000Z",
    nextActionAt: "2026-07-01T13:00:00.000Z",
    interactions: [
      {
        type: "Pedido",
        description: "Primeiro pedido registrado para abastecimento de balcão refrigerado.",
        createdAt: "2026-06-17T11:50:00.000Z",
        user: users[3],
      },
    ],
  },
  {
    status: "CONTACTED",
    score: 94,
    potentialLevel: "CRITICAL",
    assignedTo: users[2],
    notes: "Padaria com alto fluxo no almoço. Boa entrada para linha food service.",
    lastContactAt: "2026-06-22T12:30:00.000Z",
    nextActionAt: "2026-06-25T12:30:00.000Z",
    interactions: [
      {
        type: "Contato comercial",
        description: "Responsável pediu amostras e catálogo de produtos para balcão quente.",
        createdAt: "2026-06-22T12:30:00.000Z",
        user: users[2],
      },
    ],
  },
  {
    status: "NEW",
    score: 93,
    potentialLevel: "CRITICAL",
    assignedTo: users[1],
    notes: "Potencial alto por porte e atuação atacadista. Primeiro contato ainda pendente.",
    lastContactAt: null,
    nextActionAt: "2026-06-24T18:00:00.000Z",
    interactions: [],
  },
  {
    status: "INTERESTED",
    score: 87,
    potentialLevel: "HIGH",
    assignedTo: users[3],
    notes: "Busca fornecedor regional para reduzir ruptura em finais de semana.",
    lastContactAt: "2026-06-16T14:15:00.000Z",
    nextActionAt: "2026-06-25T17:30:00.000Z",
    interactions: [
      {
        type: "Reunião",
        description: "Apresentado portfólio e levantado volume médio mensal por categoria.",
        createdAt: "2026-06-16T14:15:00.000Z",
        user: users[3],
      },
    ],
  },
  {
    status: "NEGOTIATION",
    score: 86,
    potentialLevel: "HIGH",
    assignedTo: users[0],
    notes: "Negociação avançada para abastecimento inicial de duas lojas.",
    lastContactAt: "2026-06-21T19:05:00.000Z",
    nextActionAt: "2026-06-26T13:20:00.000Z",
    interactions: [
      {
        type: "Proposta",
        description: "Proposta revisada com prazo de pagamento e logística compartilhada.",
        createdAt: "2026-06-21T19:05:00.000Z",
        user: users[0],
      },
    ],
  },
  {
    status: "CONTACTED",
    score: 81,
    potentialLevel: "HIGH",
    assignedTo: users[2],
    notes: "Perfil pequeno, mas com boa aderência a compras semanais.",
    lastContactAt: "2026-06-14T13:00:00.000Z",
    nextActionAt: "2026-06-28T13:00:00.000Z",
    interactions: [
      {
        type: "Contato comercial",
        description: "Proprietário pediu retorno após fechamento do inventário semanal.",
        createdAt: "2026-06-14T13:00:00.000Z",
        user: users[2],
      },
    ],
  },
  {
    status: "NEW",
    score: 79,
    potentialLevel: "HIGH",
    assignedTo: users[3],
    notes: "Cadastro novo vindo de prospecção regional.",
    lastContactAt: null,
    nextActionAt: "2026-06-27T16:30:00.000Z",
    interactions: [],
  },
  {
    status: "NO_CONTACT",
    score: 76,
    potentialLevel: "HIGH",
    assignedTo: users[0],
    notes: "Lead aguardando primeira abordagem após enriquecimento cadastral.",
    lastContactAt: null,
    nextActionAt: "2026-06-25T19:00:00.000Z",
    interactions: [],
  },
  {
    status: "INTERESTED",
    score: 68,
    potentialLevel: "MEDIUM",
    assignedTo: users[2],
    notes: "Interessado em mix enxuto para teste de giro.",
    lastContactAt: "2026-06-13T12:40:00.000Z",
    nextActionAt: "2026-06-30T12:40:00.000Z",
    interactions: [
      {
        type: "WhatsApp",
        description: "Enviado catálogo compacto com sugestão de compra inicial.",
        createdAt: "2026-06-13T12:40:00.000Z",
        user: users[2],
      },
    ],
  },
  {
    status: "NOT_INTERESTED",
    score: 61,
    potentialLevel: "MEDIUM",
    assignedTo: users[3],
    notes: "Sem interesse no momento por contrato vigente com outro fornecedor.",
    lastContactAt: "2026-06-10T17:00:00.000Z",
    nextActionAt: null,
    interactions: [
      {
        type: "Descartado",
        description: "Responsável pediu novo contato apenas no próximo trimestre.",
        createdAt: "2026-06-10T17:00:00.000Z",
        user: users[3],
      },
    ],
  },
  {
    status: "INACTIVE",
    score: 48,
    potentialLevel: "LOW",
    assignedTo: users[0],
    notes: "Cadastro mantido para histórico; operação aparenta estar inativa.",
    lastContactAt: "2026-05-28T14:20:00.000Z",
    nextActionAt: null,
    interactions: [
      {
        type: "Validação cadastral",
        description: "Telefone sem resposta e fachada fechada em visita externa.",
        createdAt: "2026-05-28T14:20:00.000Z",
        user: users[0],
      },
    ],
  },
];

const leads: Lead[] = companies.map((companyItem, index) => {
  const plan = leadPlans[index];
  return {
    id: `lead-${index + 1}`,
    companyId: companyItem.id,
    status: plan.status,
    score: plan.score,
    potentialLevel: plan.potentialLevel,
    assignedToId: plan.assignedTo.id,
    notes: plan.notes,
    lastContactAt: plan.lastContactAt,
    nextActionAt: plan.nextActionAt,
    createdAt: updatedAt,
    updatedAt,
    company: companyItem,
    assignedTo: plan.assignedTo,
    interactions: plan.interactions.map((interaction, interactionIndex) => ({
      id: `int-${index + 1}-${interactionIndex + 1}`,
      leadId: `lead-${index + 1}`,
      userId: interaction.user.id,
      type: interaction.type,
      description: interaction.description,
      createdAt: interaction.createdAt,
      user: interaction.user,
    })),
  };
});

const imports: ImportJob[] = [
  {
    id: "job-tupa",
    uf: "SP",
    cityName: "Tupã",
    cityIbgeCode: "3555000",
    cnaeCode: "4712100",
    status: "SUCCESS",
    totalFound: 3,
    totalSaved: 3,
    errorMessage: null,
    startedAt: "2026-06-18T11:30:00.000Z",
    finishedAt: "2026-06-18T11:32:00.000Z",
    createdAt: "2026-06-18T11:30:00.000Z",
  },
  {
    id: "job-marilia",
    uf: "SP",
    cityName: "Marília",
    cityIbgeCode: "3529005",
    cnaeCode: "4711302",
    status: "SUCCESS",
    totalFound: 4,
    totalSaved: 4,
    errorMessage: null,
    startedAt: "2026-06-20T11:00:00.000Z",
    finishedAt: "2026-06-20T11:02:00.000Z",
    createdAt: "2026-06-20T11:00:00.000Z",
  },
  {
    id: "job-assis",
    uf: "SP",
    cityName: "Assis",
    cityIbgeCode: "3504008",
    cnaeCode: "4721102",
    status: "SUCCESS",
    totalFound: 2,
    totalSaved: 2,
    errorMessage: null,
    startedAt: "2026-06-22T11:00:00.000Z",
    finishedAt: "2026-06-22T11:01:00.000Z",
    createdAt: "2026-06-22T11:00:00.000Z",
  },
  {
    id: "job-prudente",
    uf: "SP",
    cityName: "Presidente Prudente",
    cityIbgeCode: "3541406",
    cnaeCode: "4639701",
    status: "RUNNING",
    totalFound: 12,
    totalSaved: 8,
    errorMessage: null,
    startedAt: "2026-06-24T11:30:00.000Z",
    finishedAt: null,
    createdAt: "2026-06-24T11:30:00.000Z",
  },
];

function clone<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

function normalize(value?: string | number | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function onlyDigits(value?: string | number | null) {
  return String(value ?? "").replace(/\D/g, "");
}

function queryValue(query: Record<string, string | number | undefined | null>, key: string) {
  const value = query[key];
  return value === undefined || value === null || value === "" ? undefined : String(value);
}

function filteredCompanies(query: Record<string, string | number | undefined | null>) {
  return companies.filter((companyItem) => {
    const search = queryValue(query, "search");
    const city = queryValue(query, "city");
    const uf = queryValue(query, "uf");
    const cnae = queryValue(query, "cnae");
    const situacao = queryValue(query, "situacaoCadastral");

    if (city && normalize(companyItem.cidade) !== normalize(city)) return false;
    if (uf && normalize(companyItem.uf) !== normalize(uf)) return false;
    if (cnae && onlyDigits(companyItem.cnaePrincipal) !== onlyDigits(cnae)) return false;
    if (situacao && normalize(companyItem.situacaoCadastral) !== normalize(situacao)) return false;
    if (search) {
      const haystack = `${companyItem.cnpj} ${companyItem.razaoSocial} ${companyItem.nomeFantasia ?? ""} ${companyItem.cidade}`;
      return (
        normalize(haystack).includes(normalize(search)) ||
        onlyDigits(companyItem.cnpj).includes(onlyDigits(search))
      );
    }
    return true;
  });
}

function filteredLeads(query: Record<string, string | number | undefined | null>) {
  return leads.filter((lead) => {
    const search = queryValue(query, "search");
    const city = queryValue(query, "city");
    const uf = queryValue(query, "uf");
    const cnae = queryValue(query, "cnae");
    const status = queryValue(query, "status");
    const potentialLevel = queryValue(query, "potentialLevel");
    const assignedToId = queryValue(query, "assignedToId");
    const minScore = Number(queryValue(query, "minScore") ?? Number.NEGATIVE_INFINITY);
    const maxScore = Number(queryValue(query, "maxScore") ?? Number.POSITIVE_INFINITY);

    if (city && normalize(lead.company.cidade) !== normalize(city)) return false;
    if (uf && normalize(lead.company.uf) !== normalize(uf)) return false;
    if (cnae && onlyDigits(lead.company.cnaePrincipal) !== onlyDigits(cnae)) return false;
    if (status && lead.status !== status) return false;
    if (potentialLevel && lead.potentialLevel !== potentialLevel) return false;
    if (assignedToId && lead.assignedToId !== assignedToId) return false;
    if (lead.score < minScore || lead.score > maxScore) return false;
    if (search) {
      const haystack = `${lead.company.cnpj} ${lead.company.razaoSocial} ${lead.company.nomeFantasia ?? ""} ${lead.company.cidade}`;
      return (
        normalize(haystack).includes(normalize(search)) ||
        onlyDigits(lead.company.cnpj).includes(onlyDigits(search))
      );
    }
    return true;
  });
}

function dashboardSummary(): DashboardSummary {
  const activePipeline = leads.filter(
    (lead) => !["CONVERTED", "INACTIVE", "NOT_INTERESTED"].includes(lead.status),
  );
  const topLead = [...leads].sort((a, b) => b.score - a.score)[0];
  return {
    potentialClients: activePipeline.length,
    activeClients: leads.filter((lead) => lead.status === "CONVERTED").length,
    inactiveClients: leads.filter((lead) => lead.status === "INACTIVE").length,
    criticalOpportunities: leads.filter((lead) => lead.potentialLevel === "CRITICAL").length,
    monitoredCities: cities.filter((city) => city.isActive).length,
    monitoredCnaes: cnaes.filter((cnae) => cnae.isTarget).length,
    priorityCity: topLead?.company.cidade ?? null,
    priorityCnae: "4712-1/00",
  };
}

function pipeline(): Pipeline {
  return {
    NEW: [],
    CONTACTED: [],
    INTERESTED: [],
    NEGOTIATION: [],
    CONVERTED: [],
  };
}

function buildPipeline() {
  const result = pipeline();
  for (const lead of leads) {
    if (lead.status in result) {
      result[lead.status as keyof Pipeline].push({
        id: lead.id,
        companyName: lead.company.nomeFantasia || lead.company.razaoSocial,
        city: lead.company.cidade,
        score: lead.score,
        potentialLevel: lead.potentialLevel,
        assignedTo: lead.assignedTo?.name ?? null,
      });
    }
  }
  return result;
}

function mapOpportunities(): MapOpportunity[] {
  return leads
    .filter(
      (lead) =>
        typeof lead.company.latitude === "number" && typeof lead.company.longitude === "number",
    )
    .map((lead) => ({
      id: lead.id,
      companyName: lead.company.nomeFantasia || lead.company.razaoSocial,
      cnpj: lead.company.cnpj,
      city: lead.company.cidade,
      uf: lead.company.uf,
      bairro: lead.company.bairro,
      latitude: lead.company.latitude,
      longitude: lead.company.longitude,
      score: lead.score,
      status: lead.status,
      potentialLevel: lead.potentialLevel,
    }))
    .sort((a, b) => b.score - a.score);
}

function parseBody(options: RequestInit) {
  if (!options.body || typeof options.body !== "string") return {};
  try {
    return JSON.parse(options.body) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function fallbackQuery(path: string, query?: Record<string, string | number | undefined | null>) {
  const url = new URL(path, "http://mock.local");
  const params: Record<string, string | number | undefined | null> = { ...(query ?? {}) };
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return { pathname: url.pathname, params };
}

export function getMockApiResponse<T>(
  path: string,
  options: RequestInit = {},
  query?: Record<string, string | number | undefined | null>,
): T | undefined {
  if (import.meta.env.VITE_DISABLE_API_MOCKS === "true") return undefined;

  const method = (options.method ?? "GET").toUpperCase();
  const { pathname, params } = fallbackQuery(path, query);
  const body = parseBody(options);

  if (method === "GET" && pathname === "/dashboard/summary") return clone(dashboardSummary()) as T;
  if (method === "GET" && pathname === "/cities") return clone(cities) as T;
  if (method === "GET" && pathname === "/cnaes") return clone(cnaes) as T;
  if (method === "GET" && pathname === "/companies") return clone(filteredCompanies(params)) as T;
  if (method === "GET" && pathname === "/leads")
    return clone(filteredLeads(params).sort((a, b) => b.score - a.score)) as T;
  if (method === "GET" && pathname === "/pipeline") return clone(buildPipeline()) as T;
  if (method === "GET" && pathname === "/map/opportunities") return clone(mapOpportunities()) as T;
  if (method === "GET" && pathname === "/imports") return clone(imports) as T;

  const companyMatch = pathname.match(/^\/companies\/([^/]+)$/);
  if (method === "GET" && companyMatch) {
    return clone(
      companies.find(
        (company) => company.id === companyMatch[1] || company.cnpj === companyMatch[1],
      ),
    ) as T;
  }

  const importMatch = pathname.match(/^\/imports\/([^/]+)$/);
  if (method === "GET" && importMatch) {
    return clone(imports.find((item) => item.id === importMatch[1])) as T;
  }

  if (method === "POST" && pathname === "/imports/cnpj") {
    const cityName = String(body.cityName ?? "Tupã");
    const job: ImportJob = {
      id: "job-preview",
      uf: String(body.uf ?? "SP"),
      cityName,
      cityIbgeCode: String(body.cityIbgeCode ?? ""),
      cnaeCode: String(body.cnaeCode ?? "4712100"),
      status: "SUCCESS",
      totalFound: 3,
      totalSaved: 3,
      errorMessage: null,
      startedAt: updatedAt,
      finishedAt: updatedAt,
      createdAt: updatedAt,
    };
    return clone({
      job,
      companies: companies
        .filter((company) => normalize(company.cidade) === normalize(cityName))
        .slice(0, 3),
    }) as T;
  }

  const leadMatch = pathname.match(/^\/leads\/([^/]+)$/);
  if (method === "GET" && leadMatch) {
    return clone(leads.find((lead) => lead.id === leadMatch[1])) as T;
  }
  if (method === "PATCH" && leadMatch) {
    const lead = leads.find((item) => item.id === leadMatch[1]);
    return clone(lead ? { ...lead, ...body } : undefined) as T;
  }

  const leadActionMatch = pathname.match(/^\/leads\/([^/]+)\/(convert|discard)$/);
  if (method === "POST" && leadActionMatch) {
    const lead = leads.find((item) => item.id === leadActionMatch[1]);
    const status: LeadStatus = leadActionMatch[2] === "convert" ? "CONVERTED" : "NOT_INTERESTED";
    return clone(lead ? { ...lead, status, lastContactAt: updatedAt } : undefined) as T;
  }

  const interactionMatch = pathname.match(/^\/leads\/([^/]+)\/interactions$/);
  if (interactionMatch) {
    const lead = leads.find((item) => item.id === interactionMatch[1]);
    if (method === "GET") return clone(lead?.interactions ?? []) as T;
    if (method === "POST") {
      const user = users.find((item) => item.id === body.userId) ?? users[0];
      const interaction: LeadInteraction = {
        id: `int-preview-${Date.now()}`,
        leadId: interactionMatch[1],
        userId: user.id,
        type: String(body.type ?? "Contato comercial"),
        description: String(body.description ?? "Contato registrado no modo mock."),
        createdAt: updatedAt,
        user,
      };
      return clone(interaction) as T;
    }
  }

  return undefined;
}
