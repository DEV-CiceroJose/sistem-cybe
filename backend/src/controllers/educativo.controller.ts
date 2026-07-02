import type { Request, Response } from "express";
import { listarConteudos, listarGlossario } from "../services/educativo.catalog";

export async function obterEducativoApi(_req: Request, res: Response) {
  const conteudos = Object.fromEntries(listarConteudos().map((c) => [c.refId, c]));
  res.json({ sucesso: true, dados: { conteudos, glossario: listarGlossario() } });
}
