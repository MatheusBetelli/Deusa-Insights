import { Module } from "@nestjs/common";
import { CNPJ_PROVIDER } from "../imports/providers/cnpj-provider.interface";
import { ReceitaFederalProvider } from "../imports/providers/receita-federal.provider";
import { CompaniesController } from "./companies.controller";
import { CompaniesService } from "./companies.service";
import { GeocodingService } from "../common/geocoding.service";

@Module({
  controllers: [CompaniesController],
  providers: [
    CompaniesService,
    GeocodingService,
    { provide: CNPJ_PROVIDER, useClass: ReceitaFederalProvider },
  ],
  exports: [CompaniesService],
})
export class CompaniesModule {}

