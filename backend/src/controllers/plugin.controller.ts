import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../database/prisma";
import { registrarPluginsEmbutidos } from "../plugins";
import { listarPlugins, idsPlugins } from "../plugins/registro";
import { listarPluginsComStatus } from "../services/plugins.service";
import { HttpError } from "../middlewares/error.middleware";

const patchSchema = z.object({ ativo: z.boolean() });

export async function listarPluginsApi(_req: Request, res: Response) {
  registrarPluginsEmbutidos();
  const configs = await prisma.configuracao.findMany();
  const plugins = listarPlugins().map((p) => ({ id: p.id, nome: p.nome, descricao: p.descricao }));
  res.json({ sucesso: true, dados: listarPluginsComStatus(plugins, configs) });
}

export async function atualizarPluginApi(req: Request, res: Response) {
  registrarPluginsEmbutidos();
  const parse = patchSchema.safeParse(req.body);
  if (!parse.success) throw new HttpError(400, "Dados inválidos.");
  const id = req.params.id;
  if (!idsPlugins().includes(id)) throw new HttpError(404, "Plugin não encontrado.");

  const chave = `plugin.${id}.ativo`;
  const valor = String(parse.data.ativo);
  await prisma.configuracao.upsert({
    where: { chave },
    update: { valor },
    create: { chave, valor },
  });
  res.json({ sucesso: true, dados: { id, ativo: parse.data.ativo } });
}
