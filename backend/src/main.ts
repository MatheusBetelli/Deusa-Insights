import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { createOriginProtectionMiddleware } from "./common/origin-protection.middleware";
import { validateProductionConfig } from "./common/production-config";
import { createRequestIdMiddleware } from "./common/request-id.middleware";

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

function validateProductionEnv(
  configService: ConfigService,
  logger: Logger,
  jwtSecret: string,
): void {
  const errors = validateProductionConfig({
    databaseUrl: configService.get<string>("DATABASE_URL"),
    directUrl: configService.get<string>("DIRECT_URL"),
    jwtSecret,
    frontendUrl: configService.get<string>("FRONTEND_URL"),
    allowedOrigins: configService.get<string>("ALLOWED_ORIGINS"),
    authCookieSameSite: configService.get<string>("AUTH_COOKIE_SAME_SITE"),
    resendApiKey: configService.get<string>("RESEND_API_KEY"),
    resendFromEmail: configService.get<string>("RESEND_FROM_EMAIL"),
    resendTestRecipient: configService.get<string>("RESEND_TEST_RECIPIENT"),
    enableLeadMutations: configService.get<string>("ENABLE_LEAD_MUTATIONS"),
    enableCommercialActions: configService.get<string>("ENABLE_COMMERCIAL_ACTIONS"),
  });

  if (errors.length > 0) {
    errors.forEach((error) => logger.error(`❌ CONFIGURAÇÃO DE PRODUÇÃO: ${error}`));
    process.exit(1);
  }
}

function validateEnv(configService: ConfigService, logger: Logger): void {
  const nodeEnv = (configService.get<string>("NODE_ENV") ?? "development").trim().toLowerCase();
  const jwtSecret = configService.get<string>("JWT_SECRET");

  if (!configService.get<string>("DATABASE_URL")) {
    logger.error(
      "❌ DATABASE_URL não está definida. Configure a variável de ambiente antes de iniciar.",
    );
    process.exit(1);
  }
  if (!jwtSecret) {
    logger.error(
      "❌ JWT_SECRET não está definida. Configure a variável de ambiente antes de iniciar.",
    );
    process.exit(1);
  }
  if (nodeEnv === "production") {
    validateProductionEnv(configService, logger, jwtSecret);
  }
}

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  app.set("trust proxy", 1);
  app.enableShutdownHooks();

  // ── Validação de Segurança de Variáveis de Ambiente ──────────────────────
  validateEnv(configService, logger);

  const port = configService.get<number>("PORT") ?? 3001;
  const nodeEnv = (configService.get<string>("NODE_ENV") ?? "development").trim().toLowerCase();
  const isProduction = nodeEnv === "production";
  const allowedOrigins = getConfiguredAllowedOrigins(configService);
  const allowedOriginSet = new Set(allowedOrigins);

  // ── Helmet — Headers de Segurança HTTP (substitui headers manuais) ──────
  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'none'"],
              baseUri: ["'none'"],
              formAction: ["'none'"],
              frameAncestors: ["'none'"],
              objectSrc: ["'none'"],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false, // necessário para mapas Leaflet
      hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    }),
  );

  // Headers customizados de conformidade LGPD
  app.use(
    (
      _request: unknown,
      response: { setHeader(name: string, value: string): void },
      next: () => void,
    ) => {
      response.setHeader("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
      response.setHeader("X-LGPD-Compliance", "Enforced (Lei 13.709/2018)");
      next();
    },
  );

  // ── Cookie Parser — Processa cookies para autenticação httpOnly ─────────
  app.use(cookieParser());
  app.use(createRequestIdMiddleware());
  app.use(
    "/auth",
    (
      _request: unknown,
      response: { setHeader(name: string, value: string): void },
      next: () => void,
    ) => {
      response.setHeader("Cache-Control", "no-store");
      next();
    },
  );

  // Cookies de sessao exigem bloqueio ativo de CSRF; CORS sozinho nao impede o envio da requisicao.
  app.use(createOriginProtectionMiddleware(isProduction, allowedOriginSet));

  // ── CORS — restritivo em produção, permissivo em desenvolvimento ────────
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
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
    allowedHeaders: ["Content-Type", "Authorization", "Cookie", "X-Request-ID"],
    exposedHeaders: ["X-Request-ID"],
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
          "Documentação dos endpoints de autenticação, leads, empresas, importações, mapa e dashboard.",
      )
      .setVersion("1.0.0")
      .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "JWT")
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
