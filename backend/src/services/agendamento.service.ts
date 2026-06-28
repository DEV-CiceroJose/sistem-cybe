export type Frequencia = "DIARIA" | "SEMANAL" | "MENSAL";

/** Calcula a próxima data de execução a partir de uma base, conforme a frequência. */
export function calcularProximaExecucao(freq: Frequencia, base: Date): Date {
  const d = new Date(base);
  if (freq === "DIARIA") d.setDate(d.getDate() + 1);
  else if (freq === "SEMANAL") d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

/** Filtra os agendamentos ativos cuja próxima execução já venceu. */
export function filtrarVencidos<T extends { ativo: boolean; proximaExecucao: Date }>(
  lista: T[],
  agora: Date,
): T[] {
  return lista.filter((a) => a.ativo && a.proximaExecucao.getTime() <= agora.getTime());
}
