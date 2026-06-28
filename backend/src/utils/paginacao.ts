export interface Paginacao {
  limite: number;
  offset: number;
}

function inteiroPositivo(valor: unknown, padrao: number): number {
  const n = Number(valor);
  return Number.isInteger(n) && n >= 0 ? n : padrao;
}

/** Extrai limite/offset de uma query, com defaults e teto seguros. */
export function paginar(
  query: { limite?: unknown; offset?: unknown },
  limitePadrao = 20,
  limiteMax = 100,
): Paginacao {
  const limiteBruto = inteiroPositivo(query.limite, limitePadrao);
  const limite = Math.min(Math.max(1, limiteBruto), limiteMax);
  const offset = inteiroPositivo(query.offset, 0);
  return { limite, offset };
}
