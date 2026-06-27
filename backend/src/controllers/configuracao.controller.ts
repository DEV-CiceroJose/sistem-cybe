import type { Request, Response } from "express";
import { prisma } from "../database/prisma";
import { HttpError } from "../middlewares/error.middleware";

export async function listarConfiguracoes(_req: Request, res: Response) {
  const configs = await prisma.configuracao.findMany();
  res.json({ sucesso: true, dados: configs });
}

export async function atualizarConfiguracao(req: Request, res: Response) {
  const { chave, valor } = req.body;
  if (!chave || typeof valor === "undefined") {
    throw new HttpError(400, "Os campos 'chave' e 'valor' são obrigatórios.");
  }

  const config = await prisma.configuracao.upsert({
    where: { chave },
    update: { valor: String(valor) },
    create: { chave, valor: String(valor) },
  });

  res.json({ sucesso: true, dados: config });
}
