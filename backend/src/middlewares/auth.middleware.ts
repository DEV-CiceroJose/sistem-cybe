import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { verificarToken } from "../services/auth.service";
import { HttpError } from "./error.middleware";

/** Exige um JWT válido no cabeçalho Authorization: Bearer <token>. */
export function autenticar(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const [tipo, token] = header.split(" ");
  if (tipo !== "Bearer" || !token) throw new HttpError(401, "Token de autenticação ausente.");
  const payload = verificarToken(token, env.jwtSecret);
  if (!payload) throw new HttpError(401, "Token inválido ou expirado.");
  next();
}
