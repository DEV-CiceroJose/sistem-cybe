import { useState } from "react";
import type { ConformidadeResultado, StatusConformidade } from "../types";
import { Card } from "./Card";
import { ProgressBar } from "./ProgressBar";

const STATUS_INFO: Record<StatusConformidade, { rotulo: string; icone: string; cor: string }> = {
  CONFORME: { rotulo: "Conforme", icone: "✓", cor: "text-ok" },
  PARCIAL: { rotulo: "Parcial", icone: "≈", cor: "text-warn" },
  NAO_CONFORME: { rotulo: "Não conforme", icone: "✕", cor: "text-danger" },
};

export function ChecklistConformidade({ conformidade }: { conformidade: ConformidadeResultado }) {
  const [filtro, setFiltro] = useState<StatusConformidade | "TODOS">("TODOS");

  return (
    <Card title={`Conformidade (OWASP Top 10) — ${conformidade.percentual}%`}>
      <ProgressBar
        progresso={conformidade.percentual}
        label={`${conformidade.conformes} de ${conformidade.total} controles atendidos`}
      />

      <div className="mt-3 mb-4 flex flex-wrap gap-2">
        {(["TODOS", "NAO_CONFORME", "PARCIAL", "CONFORME"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              filtro === f
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-line bg-bg-raised/40 text-slate-400 hover:text-slate-200"
            }`}
          >
            {f === "TODOS" ? "Todos" : STATUS_INFO[f].rotulo}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {conformidade.grupos.map((g) => {
          const itens = g.itens.filter((i) => filtro === "TODOS" || i.status === filtro);
          if (itens.length === 0) return null;
          return (
            <div key={g.grupo}>
              <div className="mb-1.5 flex items-center justify-between">
                <h4 className="text-sm text-slate-200">{g.grupo}</h4>
                <span className="text-xs text-slate-500">{g.percentual}%</span>
              </div>
              <div className="space-y-1.5">
                {itens.map((i) => (
                  <div key={i.id} className="rounded-lg border border-line bg-bg-panel/40 p-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`font-display ${STATUS_INFO[i.status].cor}`}>{STATUS_INFO[i.status].icone}</span>
                      <span className="text-sm text-slate-200">{i.titulo}</span>
                      <span className="ml-auto text-[11px] text-slate-500">{i.referenciaOwasp}</span>
                    </div>
                    {i.detalhe && <p className="mt-0.5 pl-6 text-xs text-slate-500">{i.detalhe}</p>}
                    {i.status !== "CONFORME" && (
                      <p className="mt-1 pl-6 text-xs text-slate-400">
                        <span className="text-slate-500">Recomendação:</span> {i.recomendacao}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
