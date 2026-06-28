import type { Request, Response } from "express";
import { prisma } from "../database/prisma";
import { paginar } from "../utils/paginacao";

export async function listarLogs(req: Request, res: Response) {
  const { limite, offset } = paginar(req.query);
  const [dados, total] = await Promise.all([
    prisma.requestLog.findMany({ orderBy: { criadoEm: "desc" }, take: limite, skip: offset }),
    prisma.requestLog.count(),
  ]);
  res.json({ sucesso: true, dados, paginacao: { total, limite, offset } });
}
