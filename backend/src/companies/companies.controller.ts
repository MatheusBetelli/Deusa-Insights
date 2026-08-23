import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthGuard } from "../auth/auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { DatasetFreezeGuard } from "../common/dataset-freeze.guard";
import { UserRole } from "@prisma/client";
import { CompaniesService } from "./companies.service";
import { CompanyQueryDto } from "./dto/company-query.dto";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { GeocodeBatchQueryDto } from "./dto/geocode-batch-query.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";
import { VerifyGoogleBatchQueryDto } from "./dto/verify-google-batch-query.dto";
import { CompanyDetailsDto } from "./dto/company-details.dto";
import { ValidateLocationDto } from "./dto/validate-location.dto";
import { LocationCandidatesRequestDto } from "./dto/location-candidates-request.dto";
import { UpdateCommercialProfileDto } from "./dto/update-commercial-profile.dto";

@UseGuards(AuthGuard, RolesGuard, DatasetFreezeGuard)
@Controller("companies")
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  findAll(@Query() query: CompanyQueryDto) {
    return this.companiesService.findAll(query);
  }

  @Get("google-maps-readiness")
  @Roles(UserRole.ADMIN)
  getGoogleMapsReadiness() {
    return this.companiesService.getGoogleMapsReadiness();
  }

  @Post("geocode-batch-process")
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { ttl: 60000, limit: 6 } })
  geocodeBatchProcess(@Query() query: GeocodeBatchQueryDto) {
    return this.companiesService.geocodeBatchCompanies(
      query.cnaeCode || "4712100",
      query.limit ?? 50,
      query.force ?? false,
    );
  }

  @Get(":id")
  findById(@Param("id") id: string) {
    return this.companiesService.findById(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  update(@Param("id") id: string, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(id, dto);
  }

  @Post("sync/:cnpj")
  @Roles(UserRole.ADMIN)
  syncByCnpj(@Param("cnpj") cnpj: string) {
    return this.companiesService.syncByCnpj(cnpj);
  }

  @Post("verify-google-batch")
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  verifyGoogleBatch(@Query() query: VerifyGoogleBatchQueryDto) {
    return this.companiesService.verifyGoogleBatch(query);
  }

  @Get(":id/details")
  getDetails(@Param("id") id: string) {
    return this.companiesService.getDetails(id);
  }

  @Post(":id/details")
  createDetails(@Param("id") id: string, @Body() dto: CompanyDetailsDto) {
    return this.companiesService.upsertDetails(id, dto);
  }

  @Patch(":id/details")
  updateDetails(@Param("id") id: string, @Body() dto: CompanyDetailsDto) {
    return this.companiesService.upsertDetails(id, dto);
  }

  @Patch(":id/commercial-profile")
  updateCommercialProfile(@Param("id") id: string, @Body() dto: UpdateCommercialProfileDto) {
    return this.companiesService.updateCommercialProfile(id, dto);
  }

  @Post(":id/validate-location")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  validateLocation(@Param("id") id: string, @Body() dto: ValidateLocationDto) {
    return this.companiesService.validateLocation(id, dto);
  }

  @Post(":id/location-candidates")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  getLocationCandidates(@Param("id") id: string, @Body() dto: LocationCandidatesRequestDto) {
    return this.companiesService.getLocationCandidates(id, dto.confirmPaidRequest);
  }
}
