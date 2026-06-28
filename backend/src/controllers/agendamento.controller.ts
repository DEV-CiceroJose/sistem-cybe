import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../database/prisma";
import { calcularProximaExecucao } from "../services/agendamento.service";
import { HttpError } from "../middlewares/error.middleware";

const criarSchema = z.object({
  url: z.string().min(1, "A URL é obrigatória.").max(2048),
  frequencia: z.enum(["DIARIA", "SEMANAL", "MENSAL"]),
});

const atualizarSchema = z.object({
  ativo: z.boolean().optional(),
  frequencia: z.enum(["DIARIA", "SEMANAL", "MENSAL"]).optional(),
});

export async function criarAgendamento(req: Request, res: Response) {
  const parse = criarSchema.safeParse(req.body);
  if (!parse.success) throw new HttpError(400, parse.error.issues[0]?.message || "Dados inválidos.");
  let { url } = parse.data;
  const { frequencia } = parse.data;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  const ag = await prisma.agendamento.create({
    data: { url, frequencia, proximaExecucao: calcularProximaExecucao(frequencia, new Date()) },
  });
  res.status(201).json({ sucesso: true, dados: ag });
}

export async function listarAgendamentos(_req: Request, res: Response) {
  const dados = await prisma.agendamento.findMany({ orderBy: { criadoEm: "desc" } });
  res.json({ sucesso: true, dados });
}

export async function atualizarAgendamento(req: Request, res: Response) {
  const parse = atualizarSchema.safeParse(req.body);
  if (!parse.success) throw new HttpError(400, parse.error.issues[0]?.message || "Dados inválidos.");
  const existente = await prisma.agendamento.findUnique({ where: { id: req.params.id } });
  if (!existente) throw new HttpError(404, "Agendamento não encontrado.");
  const data: { ativo?: boolean; frequencia?: string; proximaExecucao?: Date } = { ...parse.data };
  if (parse.data.frequencia) data.proximaExecucao = calcularProximaExecucao(parse.data.frequencia, new Date());
  const ag = await prisma.agendamento.update({ where: { id: req.params.id }, data });
  res.json({ sucesso: true, dados: ag });
}

export async function excluirAgendamento(req: Request, res: Response) {
  const existente = await prisma.agendamento.findUnique({ where: { id: req.params.id } });
  if (!existente) throw new HttpError(404, "Agendamento não encontrado.");
  await prisma.agendamento.delete({ where: { id: req.params.id } });
  res.json({ sucesso: true });
}
