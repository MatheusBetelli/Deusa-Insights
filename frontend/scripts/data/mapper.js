import { asNumber, asString, firstPresent, normalizeCnpj, normalizeText } from "./utils.js";

const customerAliases = {
  cnpj: ["cnpj", "documento", "cnpj cliente", "cpf/cnpj"],
  razaoSocial: ["razao social", "razão social", "razaoSocial", "cliente", "nome razao social"],
  nome: ["nome", "nome estabelecimento", "nome fantasia", "fantasia", "estabelecimento", "cliente"],
  cidade: ["cidade", "municipio", "município"],
  regiao: ["regiao", "região", "territorio", "território"],
  produtos: ["produtos comprados", "produtos", "mix", "produto"],
  status: ["status cliente", "status", "situacao", "situação"],
};

const externalAliases = {
  cnpj: ["cnpj", "documento", "cpf/cnpj"],
  nome: ["nome", "nome estabelecimento", "nome fantasia", "fantasia", "estabelecimento", "empresa"],
  cidade: ["cidade", "municipio", "município"],
  regiao: ["regiao", "região", "territorio", "território"],
  cnae: ["segmento/cnae", "segmento", "cnae", "cnae principal", "descricao cnae", "descrição cnae"],
  endereco: ["endereco", "endereço", "logradouro", "rua"],
  telefone: ["telefone", "fone", "celular", "contato"],
};

const salesAliases = {
  cnpj: ["cnpj", "cnpj cliente", "documento"],
  nome: ["nome", "nome estabelecimento", "nome fantasia", "cliente", "estabelecimento"],
  cidade: ["cidade", "municipio", "município"],
  produto: ["produto", "produtos comprados", "item", "sku"],
  valor: ["valor", "valor venda", "total", "faturamento"],
  dataVenda: ["data venda", "data", "emissao", "emissão"],
};

function validationResult(requiredFields) {
  const missing = Object.entries(requiredFields)
    .filter(([, value]) => !asString(value))
    .map(([field]) => field);

  return {
    status: missing.length > 0 ? "INVALID" : "VALID",
    errors: missing.length > 0 ? `Campos obrigatorios ausentes: ${missing.join(", ")}` : "",
  };
}

export function mapCustomer(row, sourceFile) {
  const cnpj = asString(firstPresent(row, customerAliases.cnpj));
  const razaoSocial = asString(firstPresent(row, customerAliases.razaoSocial));
  const nome = asString(firstPresent(row, customerAliases.nome)) || razaoSocial;
  const cidade = asString(firstPresent(row, customerAliases.cidade));
  let status = asString(firstPresent(row, customerAliases.status));
  if (!status) {
    status = (sourceFile || "").toLowerCase().includes("inativo") ? "INATIVO" : "ATIVO";
  }
  const validation = validationResult({ nome, cidade });

  return {
    cnpj,
    normalized_cnpj: normalizeCnpj(cnpj),
    razao_social: razaoSocial,
    nome_estabelecimento: nome,
    normalized_name: normalizeText(nome),
    cidade,
    normalized_city: normalizeText(cidade),
    regiao: asString(firstPresent(row, customerAliases.regiao)),
    status_cliente: status,
    produtos_comprados: asString(firstPresent(row, customerAliases.produtos)),
    source_file: sourceFile,
    validation_status: validation.status,
    validation_errors: validation.errors,
  };
}

export function mapExternal(row, sourceFile) {
  const cnpj = asString(firstPresent(row, externalAliases.cnpj));
  const nome = asString(firstPresent(row, externalAliases.nome));
  const cidade = asString(firstPresent(row, externalAliases.cidade));
  const validation = validationResult({ nome, cidade });

  return {
    cnpj,
    normalized_cnpj: normalizeCnpj(cnpj),
    nome_estabelecimento: nome,
    normalized_name: normalizeText(nome),
    cidade,
    normalized_city: normalizeText(cidade),
    regiao: asString(firstPresent(row, externalAliases.regiao)),
    segmento_cnae: asString(firstPresent(row, externalAliases.cnae)),
    endereco: asString(firstPresent(row, externalAliases.endereco)),
    telefone: asString(firstPresent(row, externalAliases.telefone)),
    source_file: sourceFile,
    validation_status: validation.status,
    validation_errors: validation.errors,
  };
}

export function mapSale(row, sourceFile) {
  const cnpj = asString(firstPresent(row, salesAliases.cnpj));
  const nome = asString(firstPresent(row, salesAliases.nome));
  const cidade = asString(firstPresent(row, salesAliases.cidade));
  const validation = validationResult({ nome, cidade });

  return {
    customer_cnpj: cnpj,
    normalized_cnpj: normalizeCnpj(cnpj),
    nome_estabelecimento: nome,
    normalized_name: normalizeText(nome),
    cidade,
    normalized_city: normalizeText(cidade),
    produto: asString(firstPresent(row, salesAliases.produto)),
    valor: asNumber(firstPresent(row, salesAliases.valor)),
    data_venda: asString(firstPresent(row, salesAliases.dataVenda)),
    source_file: sourceFile,
    validation_status: validation.status,
    validation_errors: validation.errors,
  };
}
