import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../database/prisma";
import { paginar } from "../utils/paginacao";
import { HttpError } from "../middlewares/error.middleware";

const lidoSchema = z.object({ lido: z.boolean() });

export async function listarAlertas(req: Request, res: Response) {
  const { limite, offset } = paginar(req.query);
  const where =
    req.query.lido === "false" ? { lido: false } : req.query.lido === "true" ? { lido: true } : undefined;
  const [dados, total] = await Promise.all([
    prisma.alerta.findMany({ where, orderBy: { criadoEm: "desc" }, take: limite, skip: offset }),
    prisma.alerta.count({ where }),
  ]);
  res.json({ sucesso: true, dados, paginacao: { total, limite, offset } });
}

export async function marcarAlertaLido(req: Request, res: Response) {
  const parse = lidoSchema.safeParse(req.body);
  if (!parse.success) throw new HttpError(400, "Dados inválidos.");
  const existente = await prisma.alerta.findUnique({ where: { id: req.params.id } });
  if (!existente) throw new HttpError(404, "Alerta não encontrado.");
  const dados = await prisma.alerta.update({ where: { id: req.params.id }, data: { lido: parse.data.lido } });
  res.json({ sucesso: true, dados });
}

export async function marcarAlertasLidos(_req: Request, res: Response) {
  await prisma.alerta.updateMany({ where: { lido: false }, data: { lido: true } });
  res.json({ sucesso: true });
}
