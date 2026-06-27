import type {
  AuditoriaComparavel,
  AchadoDiff,
  ComparacaoResultado,
  Vulnerabilidade,
} from "../types/scanner.types";
import { SEVERIDADE_RANK } from "./vulnerabilidades.catalog";

function chave(v: Vulnerabilidade): string {
  return `${v.refId}|${v.detalhe ?? ""}`;
}

function paraDiff(v: Vulnerabilidade): AchadoDiff {
  return { refId: v.refId, titulo: v.titulo, severidade: v.severidade, detalhe: v.detalhe };
}

function ordenar(itens: AchadoDiff[]): AchadoDiff[] {
  return [...itens].sort((a, b) => SEVERIDADE_RANK[b.severidade] - SEVERIDADE_RANK[a.severidade]);
}

/** Compara duas auditorias da mesma URL, classificando os achados e calculando deltas. */
export function compararAuditorias(
  anterior: AuditoriaComparavel,
  atual: AuditoriaComparavel,
): ComparacaoResultado {
  const mapaAnterior = new Map(anterior.vulnerabilidades.map((v) => [chave(v), v]));
  const mapaAtual = new Map(atual.vulnerabilidades.map((v) => [chave(v), v]));

  const novos: AchadoDiff[] = [];
  const mantidos: AchadoDiff[] = [];
  for (const [k, v] of mapaAtual) {
    if (mapaAnterior.has(k)) mantidos.push(paraDiff(v));
    else novos.push(paraDiff(v));
  }

  const resolvidos: AchadoDiff[] = [];
  for (const [k, v] of mapaAnterior) {
    if (!mapaAtual.has(k)) resolvidos.push(paraDiff(v));
  }

  return {
    baseId: anterior.id,
    atualId: atual.id,
    scoreAnterior: anterior.score,
    scoreAtual: atual.score,
    scoreDelta: atual.score - anterior.score,
    conformidadeAnterior: anterior.conformidadePercentual,
    conformidadeAtual: atual.conformidadePercentual,
    conformidadeDelta: atual.conformidadePercentual - anterior.conformidadePercentual,
    novos: ordenar(novos),
    resolvidos: ordenar(resolvidos),
    mantidos: ordenar(mantidos),
  };
}
