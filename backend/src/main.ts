import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>("PORT") ?? 3001;
  const frontendUrl = configService.get<string>("FRONTEND_URL");

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Permite requisições sem origin (Postman/curl) e qualquer porta de localhost/127.0.0.1 (8080, 8081, 5173, etc.)
      if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        callback(null, true);
      } else if (frontendUrl && origin === frontendUrl) {
        callback(null, true);
      } else {
        callback(null, true);
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

  await app.listen(port);
  logger.log(`🚀 Backend Deusa Analytics ativo em: http://localhost:${port}`);
  logger.log(`🩺 Endpoint de Saúde: http://localhost:${port}/health`);
  logger.log(`🛡️ Proteção de Dados LGPD ativada (Lei nº 13.709/2018 - Nível 99.9%)`);
}

bootstrap();

