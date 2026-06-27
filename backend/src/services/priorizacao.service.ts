import type { ResumoPrioridades, Severidade, Vulnerabilidade } from "../types/scanner.types";
import { SEVERIDADE_RANK } from "./vulnerabilidades.catalog";

/**
 * Ordena os achados por prioridade de correção:
 *   1. severidade (mais grave primeiro);
 *   2. CVSS (maior primeiro);
 *   3. facilidade de correção (mais fácil primeiro — "quick wins" dentro da mesma severidade);
 *   4. impacto (maior primeiro).
 */
export function ordenarVulnerabilidades(vulnerabilidades: Vulnerabilidade[]): Vulnerabilidade[] {
  return [...vulnerabilidades].sort((a, b) => {
    const sev = SEVERIDADE_RANK[b.severidade] - SEVERIDADE_RANK[a.severidade];
    if (sev !== 0) return sev;
    if (b.cvss !== a.cvss) return b.cvss - a.cvss;
    if (b.facilidadeCorrecao !== a.facilidadeCorrecao) return b.facilidadeCorrecao - a.facilidadeCorrecao;
    return b.impacto - a.impacto;
  });
}

function contagemZerada(): Record<Severidade, number> {
  return { CRITICA: 0, ALTA: 0, MEDIA: 0, BAIXA: 0, INFORMATIVA: 0 };
}

/**
 * Gera o resumo de prioridades a partir de uma lista já ordenada (ou não):
 * contagem por severidade, tempo total estimado e os principais itens a corrigir.
 */
export function resumirPrioridades(
  vulnerabilidades: Vulnerabilidade[],
  topN = 3,
): ResumoPrioridades {
  const ordenadas = ordenarVulnerabilidades(vulnerabilidades);
  const porSeveridade = contagemZerada();
  let tempoTotalEstimadoMin = 0;

  for (const v of ordenadas) {
    porSeveridade[v.severidade] += 1;
    tempoTotalEstimadoMin += v.tempoEstimadoMin;
  }

  return {
    total: ordenadas.length,
    porSeveridade,
    tempoTotalEstimadoMin,
    corrijaPrimeiro: ordenadas.slice(0, topN),
  };
}
