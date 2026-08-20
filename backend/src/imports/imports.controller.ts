import { BadRequestException, Body, Controller, Get, Param, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { AuthGuard } from "../auth/auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { UserRole } from "@prisma/client";
import { ImportCnpjDto } from "./dto/import-cnpj.dto";
import { ImportsService } from "./imports.service";

const MAX_EXCEL_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_UPLOAD_EXTENSIONS = /\.(xlsx|csv)$/i;
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "application/csv",
]);

type UploadedImportFile = {
  buffer?: Buffer;
  mimetype?: string;
  originalname?: string;
  size?: number;
};

@Roles(UserRole.ADMIN)
@UseGuards(AuthGuard, RolesGuard)
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
      if (mimeAllowed && extensionAllowed) {
        callback(null, true);
        return;
      }
      callback(new BadRequestException("Tipo de arquivo não permitido. Envie .xlsx ou .csv."), false);
    },
  }))
  importExcelClients(@UploadedFile() file: UploadedImportFile) {
    if (!file || !file.buffer) {
      throw new BadRequestException("Arquivo de clientes (.xlsx ou .csv) não fornecido.");
    }
    if (file.size && file.size > MAX_EXCEL_UPLOAD_BYTES) {
      throw new BadRequestException("Arquivo excede o limite de 5 MB.");
    }
    return this.importsService.importClientsFromExcelBuffer(file.buffer, file.originalname);
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
