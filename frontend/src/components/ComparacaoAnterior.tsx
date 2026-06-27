import type { ComparacaoResultado } from "../types";
import { Card } from "./Card";
import { SeverityBadge } from "./SeverityBadge";

function Delta({ rotulo, anterior, atual, delta }: { rotulo: string; anterior: number; atual: number; delta: number }) {
  const cor = delta > 0 ? "text-ok" : delta < 0 ? "text-danger" : "text-slate-400";
  const seta = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
  return (
    <div className="flex items-center justify-between rounded-lg border border-line bg-bg-raised/40 px-3 py-2">
      <span className="text-sm text-slate-400">{rotulo}</span>
      <span className="text-sm text-slate-300">
        {anterior} → {atual}{" "}
        <span className={`ml-1 font-display ${cor}`}>
          {seta} {delta > 0 ? "+" : ""}
          {delta}
        </span>
      </span>
    </div>
  );
}

export function ComparacaoAnterior({ comparacao }: { comparacao: ComparacaoResultado }) {
  return (
    <Card title="Comparação com a auditoria anterior">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Delta rotulo="Score" anterior={comparacao.scoreAnterior} atual={comparacao.scoreAtual} delta={comparacao.scoreDelta} />
        <Delta rotulo="Conformidade (%)" anterior={comparacao.conformidadeAnterior} atual={comparacao.conformidadeAtual} delta={comparacao.conformidadeDelta} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <h4 className="mb-1.5 text-sm text-ok">Resolvidos ({comparacao.resolvidos.length})</h4>
          <ul className="space-y-1">
            {comparacao.resolvidos.length === 0 ? (
              <li className="text-xs text-slate-500">Nenhum.</li>
            ) : (
              comparacao.resolvidos.map((a, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-slate-300">
                  ✅ {a.titulo}
                  {a.detalhe ? ` (${a.detalhe})` : ""}
                </li>
              ))
            )}
          </ul>
        </div>
        <div>
          <h4 className="mb-1.5 text-sm text-danger">Novos ({comparacao.novos.length})</h4>
          <ul className="space-y-1">
            {comparacao.novos.length === 0 ? (
              <li className="text-xs text-slate-500">Nenhum.</li>
            ) : (
              comparacao.novos.map((a, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-slate-300">
                  <SeverityBadge severidade={a.severidade} /> {a.titulo}
                  {a.detalhe ? ` (${a.detalhe})` : ""}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </Card>
  );
}
