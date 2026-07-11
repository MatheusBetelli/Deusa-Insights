import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CityQueryDto } from "./dto/city-query.dto";
import { CreateCityDto } from "./dto/create-city.dto";
import { UpdateCityDto } from "./dto/update-city.dto";

@Injectable()
export class CitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: CityQueryDto = {}) {
    if (query.page !== undefined || query.pageSize !== undefined) {
      return this.findPage(query);
    }

    return this.prisma.city.findMany({ orderBy: [{ uf: "asc" }, { name: "asc" }] });
  }

  private async findPage(query: CityQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(Math.max(1, query.pageSize ?? 25), 100);
    const direction = query.sortOrder === "desc" ? "desc" : "asc";
    const where = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" as const } },
            { uf: { contains: query.search, mode: "insensitive" as const } },
            { ibgeCode: { contains: query.search } },
          ],
        }
      : {};

    const [total, cities] = await this.prisma.$transaction([
      this.prisma.city.count({ where }),
      this.prisma.city.findMany({ where, orderBy: [{ uf: "asc" }, { name: "asc" }] }),
    ]);
    const companyCounts = await this.prisma.company.groupBy({
      by: ["cidade", "uf"],
      _count: { _all: true },
    });
    const countByCity = new Map(
      companyCounts.map((item) => [
        `${item.cidade.toLowerCase()}|${item.uf.toUpperCase()}`,
        item._count._all,
      ]),
    );
    const items = cities
      .map((city) => ({
        ...city,
        companyCount: countByCity.get(`${city.name.toLowerCase()}|${city.uf.toUpperCase()}`) ?? 0,
      }))
      .sort((a, b) => {
        if (query.sortBy === "companyCount") {
          return direction === "asc"
            ? a.companyCount - b.companyCount
            : b.companyCount - a.companyCount;
        }
        if (query.sortBy === "uf") {
          return direction === "asc" ? a.uf.localeCompare(b.uf) : b.uf.localeCompare(a.uf);
        }
        return direction === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
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

  create(dto: CreateCityDto) {
    return this.prisma.city.create({
      data: { ...dto, uf: dto.uf.toUpperCase() },
    });
  }

  update(id: string, dto: UpdateCityDto) {
    return this.prisma.city.update({
      where: { id },
      data: { ...dto, uf: dto.uf?.toUpperCase() },
    });
  }
}
