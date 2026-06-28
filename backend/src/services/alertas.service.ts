import type { ComparacaoResultado, AlertaGerado } from "../types/scanner.types";

export interface OpcoesAlerta {
  limiarScore?: number;
}

/**
 * Deriva alertas a partir da comparação com a auditoria anterior:
 * novos achados, queda de score (>= limiar) e queda de conformidade.
 */
export function gerarAlertas(
  comparacao: ComparacaoResultado,
  opts: OpcoesAlerta = {},
): AlertaGerado[] {
  const limiarScore = opts.limiarScore ?? 5;
  const alertas: AlertaGerado[] = [];

  if (comparacao.novos.length > 0) {
    alertas.push({
      tipo: "NOVO_ACHADO",
      mensagem: `${comparacao.novos.length} novo(s) achado(s) de segurança detectado(s).`,
    });
  }
  if (comparacao.scoreDelta <= -limiarScore) {
    alertas.push({
      tipo: "QUEDA_SCORE",
      mensagem: `Score caiu de ${comparacao.scoreAnterior} para ${comparacao.scoreAtual} (${comparacao.scoreDelta}).`,
    });
  }
  if (comparacao.conformidadeDelta < 0) {
    alertas.push({
      tipo: "QUEDA_CONFORMIDADE",
      mensagem: `Conformidade caiu de ${comparacao.conformidadeAnterior}% para ${comparacao.conformidadeAtual}%.`,
    });
  }
  return alertas;
}
