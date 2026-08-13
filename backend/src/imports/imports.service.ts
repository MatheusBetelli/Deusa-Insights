import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ImportStatus } from "@prisma/client";
import { CompaniesService } from "../companies/companies.service";
import { LeadsService } from "../leads/leads.service";
import { PrismaService } from "../prisma/prisma.service";
import { ImportCnpjDto } from "./dto/import-cnpj.dto";
import { CNPJ_PROVIDER, CnpjProvider } from "./providers/cnpj-provider.interface";

@Injectable()
export class ImportsService {
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

      let totalSaved = 0;
      const savedCompanies = [];

      for (const companyData of companies) {
        const company = await this.companiesService.upsertCompany({
          ...companyData,
          uf: dto.uf.toUpperCase(),
          cidade: companyData.cidade || dto.cityName,
          cnaePrincipal: companyData.cnaePrincipal || dto.cnaeCode,
          cnaes: companyData.cnaes?.length ? companyData.cnaes : [dto.cnaeCode],
        });
        await this.leadsService.upsertLeadForCompany(company.id);
        totalSaved += 1;
        savedCompanies.push(company);
      }

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
      const updatedJob = await this.prisma.importJob.update({
        where: { id: job.id },
        data: {
          status: ImportStatus.ERROR,
          errorMessage: error instanceof Error ? error.message : "Erro desconhecido",
          finishedAt: new Date(),
        },
      });
      return { job: updatedJob, companies: [] };
    }
  }

  async importClientsFromExcelBuffer(fileBuffer: Buffer) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require("xlsx");
    const workbook = XLSX.read(fileBuffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error("Planilha vazia ou inválida.");

    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet) as Record<string, any>[];

    let matchedCount = 0;
    let createdCount = 0;
    const processedCompanies = [];

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
        "Cliente Excel";
      const cidade =
        normalizedRow.cidade ||
        normalizedRow.municipio ||
        normalizedRow.cidadeuf ||
        "Ribeirão Preto";
      const uf = (normalizedRow.uf || normalizedRow.estado || "SP").toUpperCase();
      const logradouro = normalizedRow.endereco || normalizedRow.logradouro || "";
      const numero = normalizedRow.numero || "";
      const bairro = normalizedRow.bairro || "";
      const cep = (normalizedRow.cep || "").replace(/\D/g, "");

      let company = null;

      // 1. Busca por CNPJ
      if (cnpj.length === 14) {
        company = await this.prisma.company.findFirst({
          where: { cnpj: { contains: cnpj } },
        });
      }

      // 2. Busca por Nome + Cidade se CNPJ não encontrou
      if (!company && nome && cidade) {
        company = await this.prisma.company.findFirst({
          where: {
            cidade: { equals: cidade, mode: "insensitive" },
            OR: [
              { razaoSocial: { contains: nome, mode: "insensitive" } },
              { nomeFantasia: { contains: nome, mode: "insensitive" } },
            ],
          },
        });
      }

      if (company) {
        // Marca lead existente como CONVERTED (Cliente)
        await this.prisma.lead.upsert({
          where: { companyId: company.id },
          update: { status: "CONVERTED" },
          create: { companyId: company.id, status: "CONVERTED", score: 100, potentialLevel: "HIGH" },
        });
        matchedCount++;
        processedCompanies.push(company);
      } else {
        // Cria nova empresa como Cliente (CONVERTED)
        const fakeCnpj = cnpj.length === 14 ? cnpj : `CLIENTE-EXCEL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const newCompany = await this.companiesService.upsertCompany({
          cnpj: fakeCnpj,
          razaoSocial: nome,
          nomeFantasia: nome,
          situacaoCadastral: "ATIVA",
          cidade,
          uf,
          logradouro,
          numero,
          bairro,
          cep,
          source: "excel_client_import",
        });

        await this.prisma.lead.upsert({
          where: { companyId: newCompany.id },
          update: { status: "CONVERTED" },
          create: { companyId: newCompany.id, status: "CONVERTED", score: 100, potentialLevel: "HIGH" },
        });
        createdCount++;
        processedCompanies.push(newCompany);
      }
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
      resumoAbateRegional: abateSummary,
    };
  }
}
