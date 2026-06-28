import { useEffect, useState } from "react";
import type { Alerta } from "../types";
import { Card } from "./Card";
import { listarAlertas, marcarAlertaLido, marcarAlertasLidos } from "../services/api";

const ROTULO: Record<Alerta["tipo"], string> = {
  NOVO_ACHADO: "Novo achado",
  QUEDA_SCORE: "Queda de score",
  QUEDA_CONFORMIDADE: "Queda de conformidade",
};

export function AlertasPanel() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);

  async function carregar() {
    setAlertas(await listarAlertas());
  }
  useEffect(() => {
    carregar().catch(() => {});
  }, []);

  async function marcar(id: string) {
    await marcarAlertaLido(id, true);
    await carregar();
  }
  async function marcarTodos() {
    await marcarAlertasLidos();
    await carregar();
  }

  const naoLidos = alertas.filter((a) => !a.lido);

  return (
    <Card
      title={`Alertas (${naoLidos.length} não lido(s))`}
      action={
        naoLidos.length > 0 ? (
          <button onClick={marcarTodos} className="text-xs text-accent hover:underline">
            Marcar todos como lidos
          </button>
        ) : undefined
      }
    >
      {alertas.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum alerta.</p>
      ) : (
        <div className="space-y-2">
          {alertas.map((a) => (
            <div
              key={a.id}
              className={`flex items-start gap-3 rounded-lg border border-line p-2.5 ${a.lido ? "opacity-50" : "bg-bg-raised/40"}`}
            >
              <span className="shrink-0 rounded-full border border-warn/30 bg-warn/10 px-2 py-0.5 text-[11px] text-warn">
                {ROTULO[a.tipo]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-200">{a.mensagem}</p>
                <p className="text-[11px] text-slate-500">
                  {a.url} · {new Date(a.criadoEm).toLocaleString("pt-BR")}
                </p>
              </div>
              {!a.lido && (
                <button onClick={() => marcar(a.id)} className="shrink-0 text-[11px] text-accent hover:underline">
                  marcar lido
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
