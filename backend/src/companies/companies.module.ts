import { Module } from "@nestjs/common";
import { CNPJ_PROVIDER } from "../imports/providers/cnpj-provider.interface";
import { ReceitaFederalProvider } from "../imports/providers/receita-federal.provider";
import { CompaniesController } from "./companies.controller";
import { CompaniesService } from "./companies.service";
import { ClassificationModule } from "../classification/classification.module";

@Module({
  imports: [ClassificationModule],
  controllers: [CompaniesController],
  providers: [
    CompaniesService,
    { provide: CNPJ_PROVIDER, useClass: ReceitaFederalProvider },
  ],
  exports: [CompaniesService, CNPJ_PROVIDER],
})
export class CompaniesModule {}
