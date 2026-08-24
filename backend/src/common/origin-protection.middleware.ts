import { NextFunction, Request, Response } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function createOriginProtectionMiddleware(
  isProduction: boolean,
  allowedOrigins: ReadonlySet<string>,
) {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (!isProduction || SAFE_METHODS.has(request.method.toUpperCase())) {
      next();
      return;
    }

    const origin = request.get("origin");
    if (!origin || !allowedOrigins.has(origin)) {
      response.status(403).json({
        statusCode: 403,
        error: "Forbidden",
        message: "Origem da requisicao nao autorizada",
      });
      return;
    }

    next();
  };
}
