import type { Request, Response, NextFunction } from "express";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const status = err instanceof HttpError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Erro interno inesperado.";

  if (status >= 500) {
    console.error("[ERRO]", err);
  }

  res.status(status).json({
    sucesso: false,
    erro: message,
  });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ sucesso: false, erro: "Recurso não encontrado." });
}
