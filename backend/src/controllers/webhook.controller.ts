import type { Request, Response } from "express";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { prisma } from "../database/prisma";
import { paginar } from "../utils/paginacao";
import { HttpError } from "../middlewares/error.middleware";

const criarSchema = z.object({ url: z.string().url("URL inválida.") });
const patchSchema = z.object({ ativo: z.boolean() });

export async function criarWebhook(req: Request, res: Response) {
  const parse = criarSchema.safeParse(req.body);
  if (!parse.success) throw new HttpError(400, parse.error.issues[0]?.message || "Dados inválidos.");
  const secret = randomBytes(24).toString("hex");
  const dados = await prisma.webhook.create({ data: { url: parse.data.url, secret } });
  res.status(201).json({ sucesso: true, dados });
}

export async function listarWebhooks(_req: Request, res: Response) {
  const dados = await prisma.webhook.findMany({ orderBy: { criadoEm: "desc" } });
  res.json({ sucesso: true, dados });
}

export async function atualizarWebhook(req: Request, res: Response) {
  const parse = patchSchema.safeParse(req.body);
  if (!parse.success) throw new HttpError(400, "Dados inválidos.");
  const existente = await prisma.webhook.findUnique({ where: { id: req.params.id } });
  if (!existente) throw new HttpError(404, "Webhook não encontrado.");
  const dados = await prisma.webhook.update({ where: { id: req.params.id }, data: { ativo: parse.data.ativo } });
  res.json({ sucesso: true, dados });
}

export async function excluirWebhook(req: Request, res: Response) {
  const existente = await prisma.webhook.findUnique({ where: { id: req.params.id } });
  if (!existente) throw new HttpError(404, "Webhook não encontrado.");
  await prisma.webhookEntrega.deleteMany({ where: { webhookId: req.params.id } });
  await prisma.webhook.delete({ where: { id: req.params.id } });
  res.json({ sucesso: true });
}

export async function listarEntregas(req: Request, res: Response) {
  const { limite, offset } = paginar(req.query);
  const where = { webhookId: req.params.id };
  const [dados, total] = await Promise.all([
    prisma.webhookEntrega.findMany({ where, orderBy: { criadoEm: "desc" }, take: limite, skip: offset }),
    prisma.webhookEntrega.count({ where }),
  ]);
  res.json({ sucesso: true, dados, paginacao: { total, limite, offset } });
}
