import type { NextFunction, Request, Response } from "express";

type CorsCallback = (error: Error | null, allow?: boolean) => void;

export function createCorsOriginValidator(
  isProduction: boolean,
  allowedOrigins: ReadonlySet<string>,
) {
  return (origin: string | undefined, callback: CorsCallback): void => {
    // Sem Origin = chamada server-to-server. Em produção, não é uma origem de navegador válida.
    if (!origin) {
      callback(null, !isProduction);
      return;
    }

    if (!isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    // Origem rejeitada é um resultado esperado de segurança. Não lançar Error evita HTTP 500
    // e stack trace de ruído no log; a ausência de CORS mantém o navegador bloqueado.
    callback(null, false);
  };
}

export function createCorsPreflightGuard(
  isProduction: boolean,
  allowedOrigins: ReadonlySet<string>,
) {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (!isProduction || request.method.toUpperCase() !== "OPTIONS") {
      next();
      return;
    }

    const origin = request.get("origin");
    if (origin && allowedOrigins.has(origin)) {
      next();
      return;
    }

    response.status(403).json({
      statusCode: 403,
      error: "Forbidden",
      message: "Origem da requisicao nao autorizada",
    });
  };
}
