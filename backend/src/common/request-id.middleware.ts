import { randomUUID } from "node:crypto";
import { NextFunction, Request, Response } from "express";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,100}$/;

export type RequestWithId = Request & { requestId?: string };

export function createRequestIdMiddleware() {
  return (request: RequestWithId, response: Response, next: NextFunction): void => {
    const candidate = request.get("x-request-id")?.trim();
    const requestId = candidate && REQUEST_ID_PATTERN.test(candidate) ? candidate : randomUUID();

    request.requestId = requestId;
    response.setHeader("X-Request-ID", requestId);
    next();
  };
}
