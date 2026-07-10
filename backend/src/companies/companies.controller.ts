import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CompaniesService } from "./companies.service";
import { CompanyQueryDto } from "./dto/company-query.dto";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";
import { VerifyGoogleBatchQueryDto } from "./dto/verify-google-batch-query.dto";

@Controller("companies")
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  findAll(@Query() query: CompanyQueryDto) {
    return this.companiesService.findAll(query);
  }

  @Get(":id")
  findById(@Param("id") id: string) {
    return this.companiesService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(id, dto);
  }

  @Post("sync/:cnpj")
  syncByCnpj(@Param("cnpj") cnpj: string) {
    return this.companiesService.syncByCnpj(cnpj);
  }

  @Post("verify-google-batch")
  verifyGoogleBatch(@Query() query: VerifyGoogleBatchQueryDto) {
    return this.companiesService.verifyGoogleBatch(query);
  }
}
