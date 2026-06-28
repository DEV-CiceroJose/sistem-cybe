import type { Request, Response, NextFunction } from "express";
import { prisma } from "../database/prisma";

/** Grava um RequestLog ao final de cada resposta (sem bloquear o fluxo). */
export function registrarRequisicao(req: Request, res: Response, next: NextFunction) {
  const inicio = Date.now();
  res.on("finish", () => {
    const duracaoMs = Date.now() - inicio;
    prisma.requestLog
      .create({ data: { metodo: req.method, caminho: req.originalUrl, status: res.statusCode, duracaoMs } })
      .catch((e) => console.error("[requestLog]", (e as Error).message));
  });
  next();
}
