import { Injectable } from "@nestjs/common";
import { buildCnaeWhereInput } from "../common/opportunity-filter";
import { PrismaService } from "../prisma/prisma.service";
import { CnaeQueryDto } from "./dto/cnae-query.dto";
import { CreateCnaeDto } from "./dto/create-cnae.dto";
import { UpdateCnaeDto } from "./dto/update-cnae.dto";

function normalizeCnae(code: string) {
  return code.replace(/\D/g, "");
}

@Injectable()
export class CnaesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: CnaeQueryDto = {}) {
    if (query.page !== undefined || query.pageSize !== undefined) {
      return this.findPage(query);
    }

    return this.prisma.cnae.findMany({ orderBy: [{ isTarget: "desc" }, { code: "asc" }] });
  }

  private async findPage(query: CnaeQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(Math.max(1, query.pageSize ?? 25), 100);
    const direction = query.sortOrder === "desc" ? "desc" : "asc";
    const codeSearch = query.search ? normalizeCnae(query.search) : "";
    const where = query.search
      ? {
          OR: [
            ...(codeSearch ? [{ code: { contains: codeSearch } }] : []),
            { description: { contains: query.search, mode: "insensitive" as const } },
            { category: { contains: query.search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [total, cnaes] = await this.prisma.$transaction([
      this.prisma.cnae.count({ where }),
      this.prisma.cnae.findMany({ where, orderBy: [{ isTarget: "desc" }, { code: "asc" }] }),
    ]);
    const itemsWithCount = await Promise.all(
      cnaes.map(async (cnae) => ({
        ...cnae,
        companyCount: await this.prisma.company.count({
          where: buildCnaeWhereInput(cnae.code),
        }),
      })),
    );
    const items = itemsWithCount
      .sort((a, b) => {
        if (query.sortBy === "companyCount") {
          return direction === "asc"
            ? a.companyCount - b.companyCount
            : b.companyCount - a.companyCount;
        }
        if (query.sortBy === "description") {
          return direction === "asc"
            ? a.description.localeCompare(b.description)
            : b.description.localeCompare(a.description);
        }
        if (query.sortBy === "category") {
          return direction === "asc"
            ? (a.category ?? "").localeCompare(b.category ?? "")
            : (b.category ?? "").localeCompare(a.category ?? "");
        }
        return direction === "asc" ? a.code.localeCompare(b.code) : b.code.localeCompare(a.code);
      })
      .slice((page - 1) * pageSize, page * pageSize);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  create(dto: CreateCnaeDto) {
    return this.prisma.cnae.create({
      data: { ...dto, code: normalizeCnae(dto.code) },
    });
  }

  update(id: string, dto: UpdateCnaeDto) {
    return this.prisma.cnae.update({
      where: { id },
      data: { ...dto, code: dto.code ? normalizeCnae(dto.code) : undefined },
    });
  }
}
