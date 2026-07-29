import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

const DEV_JWT_SECRET = "dev-secret-change-me";

function validateEnv(configService: ConfigService, logger: Logger): void {
  const nodeEnv = configService.get<string>("NODE_ENV") ?? "development";
  const jwtSecret = configService.get<string>("JWT_SECRET");
  const databaseUrl = configService.get<string>("DATABASE_URL");

  if (!databaseUrl) {
    logger.error("❌ DATABASE_URL não está definida. Configure a variável de ambiente antes de iniciar.");
    process.exit(1);
  }

  if (!jwtSecret) {
    logger.error("❌ JWT_SECRET não está definida. Configure a variável de ambiente antes de iniciar.");
    process.exit(1);
  }

  if (nodeEnv === "production" && jwtSecret === DEV_JWT_SECRET) {
    logger.error(
      "❌ SEGURANÇA: JWT_SECRET está usando o valor padrão de desenvolvimento em NODE_ENV=production. " +
      "Defina um segredo forte antes de continuar.",
    );
    process.exit(1);
  }

  if (nodeEnv === "production" && jwtSecret.length < 32) {
    logger.error(
      `❌ SEGURANÇA: JWT_SECRET possui apenas ${jwtSecret.length} caracteres. ` +
      "Em produção, use pelo menos 32 caracteres aleatórios.",
    );
    process.exit(1);
  }
}

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // ── Validação de Segurança de Variáveis de Ambiente ──────────────────────
  validateEnv(configService, logger);

  const port = configService.get<number>("PORT") ?? 3001;
  const frontendUrl = configService.get<string>("FRONTEND_URL");
  const nodeEnv = configService.get<string>("NODE_ENV") ?? "development";

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Permite requisições sem origin (Postman/curl) e qualquer porta de localhost/127.0.0.1 (8080, 8081, 5173, etc.)
      if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        callback(null, true);
      } else if (frontendUrl && origin === frontendUrl) {
        callback(null, true);
      } else {
        callback(new Error(`CORS bloqueado: origem não permitida → ${origin}`), false);
      }
    },
    credentials: true,
  });

  // Middleware de Cabeçalhos de Segurança (Art. 46 LGPD)
  app.use((req: any, res: any, next: any) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
    res.setHeader("X-LGPD-Compliance", "Enforced (Lei 13.709/2018)");
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Swagger / OpenAPI — disponível apenas fora de produção ─────────────────
  if (nodeEnv !== "production") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Deusa Analytics API")
      .setDescription(
        "API REST da plataforma de inteligência comercial B2B da Deusa Alimentos. " +
        "Documentação dos endpoints de autenticação, leads, empresas, importações, mapa e dashboard."
      )
      .setVersion("1.0.0")
      .addBearerAuth(
        { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        "JWT",
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("api-docs", app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    logger.log(`📖 Swagger UI disponível em: http://localhost:${port}/api-docs`);
  }

  await app.listen(port);
  logger.log(`🚀 Backend Deusa Analytics ativo em: http://localhost:${port}`);
  logger.log(`🩺 Endpoint de Saúde: http://localhost:${port}/health`);
  logger.log(`🌍 Ambiente: ${nodeEnv.toUpperCase()}`);
  logger.log(`🛡️ Proteção de Dados LGPD ativada (Lei nº 13.709/2018)`);
}

bootstrap();

