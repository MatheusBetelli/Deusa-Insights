import { Module } from "@nestjs/common";
import { CompaniesModule } from "../companies/companies.module";
import { LeadsModule } from "../leads/leads.module";
import { ImportsController } from "./imports.controller";
import { ImportsService } from "./imports.service";

@Module({
  imports: [CompaniesModule, LeadsModule],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
