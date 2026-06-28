import type { Request, Response } from "express";
import { z } from "zod";
import { env } from "../config/env";
import { validarCredenciais, gerarToken } from "../services/auth.service";
import { HttpError } from "../middlewares/error.middleware";

const loginSchema = z.object({ usuario: z.string().min(1), senha: z.string().min(1) });

export async function login(req: Request, res: Response) {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) throw new HttpError(400, "Dados inválidos.");
  const ok = validarCredenciais(parse.data, { usuario: env.authUsuario, senha: env.authSenha });
  if (!ok) throw new HttpError(401, "Credenciais inválidas.");
  const token = gerarToken(env.jwtSecret);
  res.json({ sucesso: true, dados: { token } });
}
