import { Module } from "@nestjs/common";
import { CompaniesModule } from "../companies/companies.module";
import { LeadsModule } from "../leads/leads.module";
import { ImportsController } from "./imports.controller";
import { ImportsService } from "./imports.service";
import { CNPJ_PROVIDER } from "./providers/cnpj-provider.interface";
import { ReceitaFederalProvider } from "./providers/receita-federal.provider";

@Module({
  imports: [CompaniesModule, LeadsModule],
  controllers: [ImportsController],
  providers: [ImportsService, { provide: CNPJ_PROVIDER, useClass: ReceitaFederalProvider }],
})
export class ImportsModule {}

