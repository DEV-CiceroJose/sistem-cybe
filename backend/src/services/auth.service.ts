import jwt from "jsonwebtoken";

export interface Credenciais {
  usuario: string;
  senha: string;
}

/** Compara credenciais informadas com as esperadas (vindas do ambiente). */
export function validarCredenciais(entrada: Credenciais, esperado: Credenciais): boolean {
  return entrada.usuario === esperado.usuario && entrada.senha === esperado.senha;
}

/** Emite um JWT assinado com o segredo informado. */
export function gerarToken(segredo: string, expiraEm = "8h"): string {
  return jwt.sign({ sub: "api" }, segredo, { expiresIn: expiraEm });
}

/** Verifica o JWT; devolve o payload mínimo ou null se inválido/expirado. */
export function verificarToken(token: string, segredo: string): { sub: string } | null {
  try {
    const payload = jwt.verify(token, segredo);
    if (typeof payload === "object" && payload && typeof payload.sub === "string") {
      return { sub: payload.sub };
    }
    return null;
  } catch {
    return null;
  }
}
