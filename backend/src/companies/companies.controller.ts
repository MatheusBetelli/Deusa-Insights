import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthGuard } from "../auth/auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import {
  CommercialActionMutation,
  DatasetFreezeGuard,
  ManualLocationAdjustmentMutation,
} from "../common/dataset-freeze.guard";
import { UserRole } from "@prisma/client";
import { AuthenticatedHttpRequest } from "../common/auditable-http.types";
import { CompaniesService } from "./companies.service";
import { CompanyQueryDto } from "./dto/company-query.dto";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";
import { CompanyDetailsDto } from "./dto/company-details.dto";
import { ValidateLocationDto } from "./dto/validate-location.dto";
import { UpdateCompanyLocationDto } from "./dto/update-company-location.dto";
import { LocationCandidatesRequestDto } from "./dto/location-candidates-request.dto";
import { UpdateCommercialProfileDto } from "./dto/update-commercial-profile.dto";
import { CreateCompanyContactDto, UpdateCompanyContactDto } from "./dto/company-contact.dto";

@UseGuards(AuthGuard, RolesGuard, DatasetFreezeGuard)
@Controller("companies")
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  findAll(@Query() query: CompanyQueryDto, @Req() request: AuthenticatedHttpRequest) {
    return this.companiesService.findAll(query, request.user);
  }

  @Get(":id")
  findById(@Param("id") id: string, @Req() request: AuthenticatedHttpRequest) {
    return this.companiesService.findById(id, request.user);
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

  @Patch(":id/location")
  @Roles(UserRole.ADMIN)
  @ManualLocationAdjustmentMutation()
  updateLocation(
    @Param("id") id: string,
    @Body() dto: UpdateCompanyLocationDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.companiesService.updateLocation(id, dto, request.user);
  }

  @Post("sync/:cnpj")
  @Roles(UserRole.ADMIN)
  syncByCnpj(@Param("cnpj") cnpj: string) {
    return this.companiesService.syncByCnpj(cnpj);
  }

  @Get(":id/details")
  getDetails(@Param("id") id: string, @Req() request: AuthenticatedHttpRequest) {
    return this.companiesService.getDetails(id, request.user);
  }

  @Post(":id/details")
  createDetails(
    @Param("id") id: string,
    @Body() dto: CompanyDetailsDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.companiesService.upsertDetails(id, dto, request.user);
  }

  @Patch(":id/details")
  updateDetails(
    @Param("id") id: string,
    @Body() dto: CompanyDetailsDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.companiesService.upsertDetails(id, dto, request.user);
  }

  @Patch(":id/commercial-profile")
  updateCommercialProfile(
    @Param("id") id: string,
    @Body() dto: UpdateCommercialProfileDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.companiesService.updateCommercialProfile(id, dto, request.user);
  }

  @Get(":id/contacts")
  listContacts(@Param("id") id: string, @Req() request: AuthenticatedHttpRequest) {
    return this.companiesService.listContacts(id, request.user);
  }

  @Post(":id/contacts")
  @CommercialActionMutation()
  createContact(
    @Param("id") id: string,
    @Body() dto: CreateCompanyContactDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.companiesService.createContact(id, dto, request.user);
  }

  @Patch(":id/contacts/:contactId")
  @CommercialActionMutation()
  updateContact(
    @Param("id") id: string,
    @Param("contactId") contactId: string,
    @Body() dto: UpdateCompanyContactDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.companiesService.updateContact(id, contactId, dto, request.user);
  }

  @Post(":id/validate-location")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  validateLocation(
    @Param("id") id: string,
    @Body() dto: ValidateLocationDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.companiesService.validateLocation(id, dto, request.user);
  }

  @Post(":id/location-candidates")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  getLocationCandidates(@Param("id") id: string, @Body() dto: LocationCandidatesRequestDto) {
    return this.companiesService.getLocationCandidates(id, dto.confirmPaidRequest);
  }
}
