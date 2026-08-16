import { BadRequestException, Body, Controller, Get, Param, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { AuthGuard } from "../auth/auth.guard";
import { ImportCnpjDto } from "./dto/import-cnpj.dto";
import { ImportsService } from "./imports.service";

const MAX_EXCEL_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_UPLOAD_EXTENSIONS = /\.(xlsx|xls|csv)$/i;
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
]);

type UploadedImportFile = {
  buffer?: Buffer;
  mimetype?: string;
  originalname?: string;
  size?: number;
};

@UseGuards(AuthGuard)
@Controller("imports")
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post("cnpj")
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  importCnpj(@Body() dto: ImportCnpjDto) {
    return this.importsService.importCnpj(dto);
  }

  @Post("excel-clients")
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @UseInterceptors(FileInterceptor("file", {
    limits: { fileSize: MAX_EXCEL_UPLOAD_BYTES, files: 1 },
    fileFilter: (_req: unknown, file: UploadedImportFile, callback: (error: Error | null, acceptFile: boolean) => void) => {
      const mimeAllowed = file.mimetype ? ALLOWED_UPLOAD_MIME_TYPES.has(file.mimetype) : false;
      const extensionAllowed = file.originalname ? ALLOWED_UPLOAD_EXTENSIONS.test(file.originalname) : false;
      if (mimeAllowed || extensionAllowed) {
        callback(null, true);
        return;
      }
      callback(new BadRequestException("Tipo de arquivo não permitido. Envie .xlsx, .xls ou .csv."), false);
    },
  }))
  importExcelClients(@UploadedFile() file: UploadedImportFile) {
    if (!file || !file.buffer) {
      throw new BadRequestException("Arquivo Excel (.xlsx, .xls, .csv) não fornecido.");
    }
    if (file.size && file.size > MAX_EXCEL_UPLOAD_BYTES) {
      throw new BadRequestException("Arquivo excede o limite de 5 MB.");
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
