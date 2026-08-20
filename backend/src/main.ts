import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";

const DEV_JWT_SECRET = "dev-secret-change-me";

function getConfiguredAllowedOrigins(configService: ConfigService): string[] {
  const configured = configService.get<string>("ALLOWED_ORIGINS");
  const frontendUrl = configService.get<string>("FRONTEND_URL");
  const origins = [
    ...(configured ? configured.split(",") : []),
    ...(frontendUrl ? [frontendUrl] : []),
  ]
    .map((origin) => origin.trim())
    .filter(Boolean);

  return Array.from(new Set(origins));
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function isValidProductionOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return parsed.protocol === "https:" && parsed.origin === origin && !isLocalhostOrigin(origin);
  } catch {
    return false;
  }
}

function validateEnv(configService: ConfigService, logger: Logger): void {
  const nodeEnv = configService.get<string>("NODE_ENV") ?? "development";
  const jwtSecret = configService.get<string>("JWT_SECRET");
  const databaseUrl = configService.get<string>("DATABASE_URL");
  const frontendUrl = configService.get<string>("FRONTEND_URL")?.trim();

  if (!databaseUrl) {
    logger.error("❌ DATABASE_URL não está definida. Configure a variável de ambiente antes de iniciar.");
    process.exit(1);
  }

  if (!jwtSecret) {
    logger.error("❌ JWT_SECRET não está definida. Configure a variável de ambiente antes de iniciar.");
    process.exit(1);
  }

  const normalizedJwtSecret = jwtSecret.toLowerCase();
  const weakSecretMarkers = [DEV_JWT_SECRET, "change-me", "dev-secret", "placeholder", "gere_um_segredo"];
  if (nodeEnv === "production" && weakSecretMarkers.some((marker) => normalizedJwtSecret.includes(marker))) {
    logger.error(
      "❌ SEGURANÇA: JWT_SECRET parece usar valor padrão, placeholder ou segredo de desenvolvimento em NODE_ENV=production. " +
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

  // Validar allowlist de origens obrigatória em produção
  if (nodeEnv === "production") {
    const allowedOrigins = getConfiguredAllowedOrigins(configService);
    if (allowedOrigins.length === 0 || allowedOrigins.some((origin) => !isValidProductionOrigin(origin))) {
      logger.error(
        "❌ SEGURANÇA: ALLOWED_ORIGINS contém origem inválida. Use somente origens HTTPS completas, sem caminho ou barra final.",
      );
      process.exit(1);
    }
    if (!frontendUrl || !isValidProductionOrigin(frontendUrl)) {
      logger.error(
        "❌ SEGURANÇA: FRONTEND_URL deve ser uma origem HTTPS válida para gerar links de recuperação de senha.",
      );
      process.exit(1);
    }
    if (!configService.get<string>("RESEND_API_KEY") || !configService.get<string>("RESEND_FROM_EMAIL")) {
      logger.error(
        "❌ CONFIGURAÇÃO: RESEND_API_KEY e RESEND_FROM_EMAIL são obrigatórias em produção para recuperação de senha.",
      );
      process.exit(1);
    }
  }
}

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // ── Validação de Segurança de Variáveis de Ambiente ──────────────────────
  validateEnv(configService, logger);

  const port = configService.get<number>("PORT") ?? 3001;
  const nodeEnv = configService.get<string>("NODE_ENV") ?? "development";
  const isProduction = nodeEnv === "production";
  const allowedOrigins = getConfiguredAllowedOrigins(configService);

  // ── Helmet — Headers de Segurança HTTP (substitui headers manuais) ──────
  app.use(
    helmet({
      contentSecurityPolicy: isProduction ? undefined : false, // desabilitar CSP em dev (Swagger)
      crossOriginEmbedderPolicy: false, // necessário para mapas Leaflet
      hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    }),
  );

  // Headers customizados de conformidade LGPD
  app.use((req: any, res: any, next: any) => {
    res.setHeader("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
    res.setHeader("X-LGPD-Compliance", "Enforced (Lei 13.709/2018)");
    next();
  });

  // ── CORS — restritivo em produção, permissivo em desenvolvimento ────────
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Sem origin = server-to-server (curl, Postman) → permitir em dev, bloquear em prod
      if (!origin) {
        callback(null, !isProduction);
        return;
      }

      // Em desenvolvimento: permitir qualquer localhost
      if (!isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        callback(null, true);
        return;
      }

      // Origens explicitamente configuradas por ambiente
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS bloqueado: origem não permitida → ${origin}`), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400, // Cache preflight por 24h
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
  if (!isProduction) {
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

  await app.listen(port, "0.0.0.0");
  logger.log(`🚀 Backend Deusa Analytics ativo em: http://0.0.0.0:${port} (porta ${port})`);
  logger.log(`🩺 Endpoint de Saúde: http://localhost:${port}/health`);
  logger.log(`🌍 Ambiente: ${nodeEnv.toUpperCase()}`);
  logger.log(`🛡️ Helmet ativado — Headers de segurança HTTP configurados`);
  logger.log(`🛡️ Proteção de Dados LGPD ativada (Lei nº 13.709/2018)`);
}

bootstrap();
