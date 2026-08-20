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

function parseDelimitedRows(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0)
    ? ";"
    : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (character === '"') {
      inQuotes = !inQuotes;
    } else if (character === delimiter && !inQuotes) {
      row.push(current.trim());
      current = "";
    } else if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(current.trim());
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      current = "";
    } else {
      current += character;
    }
  }

  row.push(current.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);
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
    const normalizedName = originalName.toLowerCase();
    let rawData: Record<string, unknown>[];
    try {
      if (normalizedName.endsWith(".csv")) {
        rawData = rowsToObjects(parseDelimitedRows(fileBuffer.toString("utf8")));
      } else if (normalizedName.endsWith(".xlsx")) {
        await assertSafeXlsxArchive(fileBuffer);
        rawData = rowsToObjects(await readSheet(fileBuffer));
      } else {
        throw new BadRequestException("Formato não suportado. Envie .xlsx ou .csv.");
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException("Planilha inválida ou corrompida.");
    }
    if (rawData.length === 0) throw new BadRequestException("Planilha vazia ou inválida.");
    if (rawData.length > 5000) {
      throw new BadRequestException("A planilha excede o limite de 5.000 linhas por importação.");
    }

    let matchedCount = 0;
    let createdCount = 0;
    let unmatchedCount = 0;
    let ignoredCount = 0;
    const ignoredReasons: Record<string, number> = {};

    const ignore = (reason: string) => {
      ignoredCount += 1;
      ignoredReasons[reason] = (ignoredReasons[reason] ?? 0) + 1;
    };

    for (const row of rawData) {
      // Normaliza chaves da linha para facilitar busca
      const normalizedRow: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) {
        const normKey = k
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");
        normalizedRow[normKey] = String(v ?? "").trim();
      }

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

      if (!nome) {
        ignore("nome_ausente");
        continue;
      }
      if (cnpj && !isValidCnpj(cnpj)) {
        ignore("cnpj_invalido");
        continue;
      }
      if (!explicitClientCode && !cnpj) {
        ignore("identificador_ausente");
        continue;
      }

      const clientCode = explicitClientCode || `CNPJ-${cnpj}`;
      const [company, existingAccount] = await Promise.all([
        cnpj ? this.prisma.company.findUnique({ where: { cnpj }, select: { id: true } }) : null,
        this.prisma.clientAccount.findUnique({
          where: { codigoClienteDeusa: clientCode },
          select: { id: true, companyId: true, cnpj: true },
        }),
      ]);
      const existingCnpj = existingAccount?.cnpj?.replace(/\D/g, "") || null;
      if (
        (existingAccount?.companyId && company?.id && existingAccount.companyId !== company.id) ||
        (existingCnpj && cnpj && existingCnpj !== cnpj)
      ) {
        ignore("codigo_cliente_conflitante");
        continue;
      }
      const companyId = company?.id ?? existingAccount?.companyId ?? null;
      const importedAt = new Date();

      await this.prisma.$transaction(async (transaction) => {
        if (companyId) {
          await transaction.lead.upsert({
            where: { companyId },
            update: { status: "CONVERTED" },
            create: {
              companyId,
              status: "CONVERTED",
            },
          });
        }

        await transaction.clientAccount.upsert({
          where: { codigoClienteDeusa: clientCode },
          update: {
            cnpj: cnpj || null,
            razaoSocial: nome,
            nomeFantasia: nome,
            cidade: cidade || null,
            uf,
            companyId,
            isCurrentClient: true,
            lastImportAt: importedAt,
          },
          create: {
            codigoClienteDeusa: clientCode,
            cnpj: cnpj || null,
            razaoSocial: nome,
            nomeFantasia: nome,
            cidade: cidade || null,
            uf,
            companyId,
            isCurrentClient: true,
            lastImportAt: importedAt,
          },
        });
      });

      if (companyId) matchedCount += 1;
      else unmatchedCount += 1;
      if (!existingAccount) createdCount += 1;
    }

    // Calcula resumo de Abate para a região (Ribeirão Preto & Franca)
    const targetCities = ["Ribeirão Preto", "Franca"];
    const abateSummary: Record<string, any> = {};

    for (const city of targetCities) {
      const totalClientes = await this.prisma.lead.count({
        where: {
          status: "CONVERTED",
          company: { cidade: { equals: city, mode: "insensitive" } },
        },
      });

      const totalProspects = await this.prisma.lead.count({
        where: {
          status: { not: "CONVERTED" },
          company: { cidade: { equals: city, mode: "insensitive" } },
        },
      });

      const totalMapeado = totalClientes + totalProspects;
      const taxaPenetracao = totalMapeado > 0 ? ((totalClientes / totalMapeado) * 100).toFixed(1) + "%" : "0%";

      abateSummary[city] = {
        clientesAtivos: totalClientes,
        prospectsAtivos: totalProspects,
        totalMercadosMapeados: totalMapeado,
        taxaPenetracao,
      };
    }

    return {
      success: true,
      totalLinhasProcessadas: rawData.length,
      clientesMatcheados: matchedCount,
      novosClientesCriados: createdCount,
      clientesSemEmpresaCorrespondente: unmatchedCount,
      linhasIgnoradas: ignoredCount,
      motivosIgnoracao: ignoredReasons,
      resumoAbateRegional: abateSummary,
    };
  }
}
