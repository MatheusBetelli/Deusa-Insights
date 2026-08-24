import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ImportStatus } from "@prisma/client";
import { isValidCnpj } from "../common/cnpj-validator";
import { normalizeCnpj } from "../common/cnpj";
import { CompaniesService } from "../companies/companies.service";
import { LeadsService } from "../leads/leads.service";
import { PrismaService } from "../prisma/prisma.service";
import { ImportCnpjDto } from "./dto/import-cnpj.dto";
import { CNPJ_PROVIDER, CnpjProvider } from "./providers/cnpj-provider.interface";
import { readSheet } from "read-excel-file/node";
import { Open } from "unzipper-esm";

const MAX_XLSX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024;
const MAX_XLSX_ARCHIVE_ENTRIES = 200;

type DelimitedParserState = {
  row: string[];
  current: string;
  inQuotes: boolean;
};

function appendDelimitedCell(state: DelimitedParserState): void {
  state.row.push(state.current.trim());
  state.current = "";
}

function appendDelimitedRow(state: DelimitedParserState, rows: string[][]): void {
  appendDelimitedCell(state);
  if (state.row.some((cell) => cell !== "")) rows.push(state.row);
  state.row = [];
}

function processDelimitedCharacter(
  character: string,
  next: string | undefined,
  delimiter: string,
  state: DelimitedParserState,
  rows: string[][],
): boolean {
  if (character === '"' && state.inQuotes && next === '"') {
    state.current += '"';
    return true;
  }
  if (character === '"') {
    state.inQuotes = !state.inQuotes;
    return false;
  }
  if (character === delimiter && !state.inQuotes) {
    appendDelimitedCell(state);
    return false;
  }
  if ((character === "\n" || character === "\r") && !state.inQuotes) {
    appendDelimitedRow(state, rows);
    return character === "\r" && next === "\n";
  }
  state.current += character;
  return false;
}

function parseDelimitedRows(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0)
    ? ";"
    : ",";
  const rows: string[][] = [];
  const state: DelimitedParserState = { row: [], current: "", inQuotes: false };

  for (let index = 0; index < text.length; index += 1) {
    const skipNext = processDelimitedCharacter(
      text[index],
      text[index + 1],
      delimiter,
      state,
      rows,
    );
    if (skipNext) index += 1;
  }

  appendDelimitedRow(state, rows);
  return rows;
}

function rowsToObjects(rows: unknown[][]): Record<string, unknown>[] {
  if (rows.length === 0) return [];
  const headers = rows[0].map(
    (header, index) => String(header ?? "").replace(/^\uFEFF/, "").trim() || `coluna_${index + 1}`,
  );
  return rows.slice(1).map((values) =>
    headers.reduce<Record<string, unknown>>((record, header, index) => {
      const value = values[index];
      record[header] = value instanceof Date ? value.toISOString() : value ?? "";
      return record;
    }, {}),
  );
}

async function assertSafeXlsxArchive(fileBuffer: Buffer): Promise<void> {
  let directory;
  try {
    directory = await Open.buffer(fileBuffer);
  } catch {
    throw new BadRequestException("Planilha XLSX inválida ou corrompida.");
  }

  if (directory.files.length > MAX_XLSX_ARCHIVE_ENTRIES) {
    throw new BadRequestException("Planilha XLSX possui arquivos internos em excesso.");
  }
  const uncompressedBytes = directory.files.reduce(
    (total, entry) => total + Math.max(0, entry.uncompressedSize),
    0,
  );
  if (
    uncompressedBytes > MAX_XLSX_UNCOMPRESSED_BYTES ||
    uncompressedBytes > Math.max(fileBuffer.length * 100, 1)
  ) {
    throw new BadRequestException("Planilha XLSX excede o limite seguro após descompressão.");
  }
}

type NormalizedClientImportRow = {
  cnpj: string;
  nome: string;
  cidade: string;
  uf: string | null;
  explicitClientCode: string;
};

type ExistingClientAccount = {
  id: string;
  companyId: string | null;
  cnpj: string | null;
  razaoSocial: string;
  cidade: string | null;
  uf: string | null;
};

type ClientImportCounters = {
  matched: number;
  created: number;
  updated: number;
  unchanged: number;
  unmatched: number;
  ignored: number;
  ignoredReasons: Record<string, number>;
};

function createClientImportCounters(): ClientImportCounters {
  return {
    matched: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    unmatched: 0,
    ignored: 0,
    ignoredReasons: {},
  };
}

function normalizeImportKey(key: string): string {
  return key
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeClientImportRow(row: Record<string, unknown>): NormalizedClientImportRow {
  const normalizedRow = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeImportKey(key), String(value ?? "").trim()]),
  );
  const cnpj = (normalizedRow.cnpj || normalizedRow.cnpjcliente || "").replace(/\D/g, "");
  const nome =
    normalizedRow.nome ||
    normalizedRow.razaosocial ||
    normalizedRow.nomefantasia ||
    normalizedRow.cliente ||
    normalizedRow.mercado ||
    "";
  const cidade =
    normalizedRow.cidade ||
    normalizedRow.municipio ||
    normalizedRow.cidadeuf ||
    "";
  const uf = (normalizedRow.uf || normalizedRow.estado || "").toUpperCase() || null;
  const explicitClientCode =
    normalizedRow.codigo || normalizedRow.codigocliente || normalizedRow.cod || "";
  return { cnpj, nome, cidade, uf, explicitClientCode };
}

function getClientImportIgnoreReason(row: NormalizedClientImportRow): string | null {
  if (!row.nome) return "nome_ausente";
  if (row.cnpj && !isValidCnpj(row.cnpj)) return "cnpj_invalido";
  if (!row.explicitClientCode && !row.cnpj) return "identificador_ausente";
  return null;
}

function ignoreClientImportRow(counters: ClientImportCounters, reason: string): void {
  counters.ignored += 1;
  counters.ignoredReasons[reason] = (counters.ignoredReasons[reason] ?? 0) + 1;
}

function hasClientAccountConflict(
  account: ExistingClientAccount | null,
  companyId: string | null,
  cnpj: string,
): boolean {
  const existingCnpj = account?.cnpj?.replace(/\D/g, "") || null;
  return Boolean(
    (account?.companyId && companyId && account.companyId !== companyId) ||
      (existingCnpj && cnpj && existingCnpj !== cnpj),
  );
}

function isIdenticalClientAccount(
  account: ExistingClientAccount | null,
  row: NormalizedClientImportRow,
  companyId: string | null,
): account is ExistingClientAccount {
  return Boolean(
    account &&
      (account.cnpj || null) === (row.cnpj || null) &&
      account.razaoSocial === row.nome &&
      (account.cidade || null) === (row.cidade || null) &&
      (account.uf || null) === row.uf &&
      account.companyId === companyId,
  );
}

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly companiesService: CompaniesService,
    private readonly leadsService: LeadsService,
    @Inject(CNPJ_PROVIDER) private readonly cnpjProvider: CnpjProvider,
  ) {}

  findAll() {
    return this.prisma.importJob.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  }

  async findById(id: string) {
    const job = await this.prisma.importJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException("Importação não encontrada");
    return job;
  }

  async importCnpj(dto: ImportCnpjDto) {
    const job = await this.prisma.importJob.create({
      data: {
        uf: dto.uf.toUpperCase(),
        cityName: dto.cityName,
        cityIbgeCode: dto.cityIbgeCode,
        cnaeCode: dto.cnaeCode.replace(/\D/g, ""),
        status: ImportStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    try {
      const companies = await this.cnpjProvider.searchCompaniesByCityAndCnae({
        uf: dto.uf.toUpperCase(),
        cityName: dto.cityName,
        cityIbgeCode: dto.cityIbgeCode,
        cnaeCode: dto.cnaeCode,
        limit: dto.limit,
      });

      const cnpjs = companies.map((c) => normalizeCnpj(c.cnpj)).filter(Boolean);
      const existingCompanies = await this.prisma.company.findMany({
        where: { cnpj: { in: cnpjs } },
        select: { id: true, cnpj: true },
      });
      const existingMap = new Map(existingCompanies.map((c) => [c.cnpj, c.id]));

      const savedCompanies = [];
      const CHUNK_SIZE = 10;
      for (let i = 0; i < companies.length; i += CHUNK_SIZE) {
        const chunk = companies.slice(i, i + CHUNK_SIZE);
        const results = await Promise.all(
          chunk.map(async (companyData) => {
            try {
              const cleanCnpj = normalizeCnpj(companyData.cnpj);
              // Se a empresa já existe no banco, pula o re-upsert pesado
              if (existingMap.has(cleanCnpj)) {
                return { id: existingMap.get(cleanCnpj)!, cnpj: cleanCnpj };
              }
              const company = await this.companiesService.upsertCompany({
                ...companyData,
                uf: dto.uf.toUpperCase(),
                cidade: companyData.cidade || dto.cityName,
                cnaePrincipal: companyData.cnaePrincipal,
                cnaes: companyData.cnaes?.length ? companyData.cnaes : [dto.cnaeCode],
              });
              await this.leadsService.upsertLeadForCompany(company.id);
              return company;
            } catch (err) {
              this.logger.warn(`Falha ao importar empresa ${companyData.cnpj}: ${err instanceof Error ? err.message : String(err)}`);
              return null;
            }
          }),
        );
        savedCompanies.push(...results.filter(Boolean));
      }
      const totalSaved = savedCompanies.length;

      const updatedJob = await this.prisma.importJob.update({
        where: { id: job.id },
        data: {
          status: ImportStatus.SUCCESS,
          totalFound: companies.length,
          totalSaved,
          finishedAt: new Date(),
        },
      });

      return { job: updatedJob, companies: savedCompanies };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Erro crítico no importCnpj: ${errorMsg}`, error instanceof Error ? error.stack : undefined);
      await this.prisma.importJob.update({
        where: { id: job.id },
        data: {
          status: ImportStatus.ERROR,
          errorMessage: errorMsg,
          finishedAt: new Date(),
        },
      });
      throw new InternalServerErrorException({
        message: "A importação falhou. Consulte o histórico para verificar o erro registrado.",
        jobId: job.id,
      });
    }
  }

  async importClientsFromExcelBuffer(fileBuffer: Buffer, originalName = "clientes.xlsx") {
    const rawData = await this.readClientImportRows(fileBuffer, originalName);
    if (rawData.length === 0) throw new BadRequestException("Planilha vazia ou inválida.");
    if (rawData.length > 5000) {
      throw new BadRequestException("A planilha excede o limite de 5.000 linhas por importação.");
    }

    const counters = createClientImportCounters();
    for (const row of rawData) {
      await this.processClientImportRow(row, counters);
    }

    const abateSummary = await this.buildRegionalSummary();

    return {
      success: true,
      totalLinhasProcessadas: rawData.length,
      clientesInalterados: counters.unchanged,
      clientesAtualizados: counters.updated,
      novosClientesCriados: counters.created,
      clientesMatcheados: counters.matched,
      clientesSemEmpresaCorrespondente: counters.unmatched,
      linhasIgnoradas: counters.ignored,
      motivosIgnoracao: counters.ignoredReasons,
      resumoAbateRegional: abateSummary,
    };
  }

  private async readClientImportRows(fileBuffer: Buffer, originalName: string) {
    const normalizedName = originalName.toLowerCase();
    try {
      if (normalizedName.endsWith(".csv")) {
        return rowsToObjects(parseDelimitedRows(fileBuffer.toString("utf8")));
      }
      if (normalizedName.endsWith(".xlsx")) {
        await assertSafeXlsxArchive(fileBuffer);
        return rowsToObjects(await readSheet(fileBuffer));
      }
      throw new BadRequestException("Formato não suportado. Envie .xlsx ou .csv.");
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException("Planilha inválida ou corrompida.");
    }
  }

  private async processClientImportRow(
    rawRow: Record<string, unknown>,
    counters: ClientImportCounters,
  ): Promise<void> {
    const row = normalizeClientImportRow(rawRow);
    const ignoreReason = getClientImportIgnoreReason(row);
    if (ignoreReason) {
      ignoreClientImportRow(counters, ignoreReason);
      return;
    }

    const clientCode = row.explicitClientCode || `CNPJ-${row.cnpj}`;
    const [company, existingAccount] = await Promise.all([
      row.cnpj
        ? this.prisma.company.findUnique({ where: { cnpj: row.cnpj }, select: { id: true } })
        : null,
      this.prisma.clientAccount.findUnique({
        where: { codigoClienteDeusa: clientCode },
        select: {
          id: true,
          companyId: true,
          cnpj: true,
          razaoSocial: true,
          cidade: true,
          uf: true,
        },
      }),
    ]);
    const companyId = company?.id ?? existingAccount?.companyId ?? null;
    if (hasClientAccountConflict(existingAccount, company?.id ?? null, row.cnpj)) {
      ignoreClientImportRow(counters, "codigo_cliente_conflitante");
      return;
    }

    const importedAt = new Date();
    if (isIdenticalClientAccount(existingAccount, row, companyId)) {
      await this.prisma.clientAccount.update({
        where: { id: existingAccount.id },
        data: { lastImportAt: importedAt },
      });
      counters.unchanged += 1;
    } else {
      await this.persistClientImport(row, clientCode, companyId, importedAt);
      if (existingAccount) counters.updated += 1;
      else counters.created += 1;
    }

    if (companyId) counters.matched += 1;
    else counters.unmatched += 1;
  }

  private async persistClientImport(
    row: NormalizedClientImportRow,
    clientCode: string,
    companyId: string | null,
    importedAt: Date,
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      if (companyId) {
        await transaction.lead.upsert({
          where: { companyId },
          update: { status: "CONVERTED" },
          create: { companyId, status: "CONVERTED" },
        });
      }

      const data = {
        cnpj: row.cnpj || null,
        razaoSocial: row.nome,
        nomeFantasia: row.nome,
        cidade: row.cidade || null,
        uf: row.uf,
        companyId,
        isCurrentClient: true,
        lastImportAt: importedAt,
      };
      await transaction.clientAccount.upsert({
        where: { codigoClienteDeusa: clientCode },
        update: data,
        create: { codigoClienteDeusa: clientCode, ...data },
      });
    });
  }

  private async buildRegionalSummary() {
    const summary: Record<
      string,
      {
        clientesAtivos: number;
        prospectsAtivos: number;
        totalMercadosMapeados: number;
        taxaPenetracao: string;
      }
    > = {};

    for (const city of ["Ribeirão Preto", "Franca"]) {
      const [totalClientes, totalProspects] = await Promise.all([
        this.prisma.clientAccount.count({
          where: { isCurrentClient: true, cidade: { equals: city, mode: "insensitive" } },
        }),
        this.prisma.lead.count({
          where: {
            status: { not: "CONVERTED" },
            company: { cidade: { equals: city, mode: "insensitive" } },
          },
        }),
      ]);
      const totalMapeado = totalClientes + totalProspects;
      summary[city] = {
        clientesAtivos: totalClientes,
        prospectsAtivos: totalProspects,
        totalMercadosMapeados: totalMapeado,
        taxaPenetracao:
          totalMapeado > 0 ? `${((totalClientes / totalMapeado) * 100).toFixed(1)}%` : "0%",
      };
    }
    return summary;
  }

}
