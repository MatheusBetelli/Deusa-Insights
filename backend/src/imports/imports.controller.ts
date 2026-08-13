import { Body, Controller, Get, Param, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ImportCnpjDto } from "./dto/import-cnpj.dto";
import { ImportsService } from "./imports.service";

@Controller("imports")
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post("cnpj")
  importCnpj(@Body() dto: ImportCnpjDto) {
    return this.importsService.importCnpj(dto);
  }

  @Post("excel-clients")
  @UseInterceptors(FileInterceptor("file"))
  importExcelClients(@UploadedFile() file: Express.Multer.File) {
    if (!file || !file.buffer) {
      throw new Error("Arquivo Excel (.xlsx, .xls) não fornecido.");
    }
    return this.importsService.importClientsFromExcelBuffer(file.buffer);
  }

  @Get()
  findAll() {
    return this.importsService.findAll();
  }

  @Get(":id")
  findById(@Param("id") id: string) {
    return this.importsService.findById(id);
  }
}
