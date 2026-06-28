import { useEffect, useState } from "react";
import type { Agendamento, Frequencia } from "../types";
import { Card } from "./Card";
import {
  listarAgendamentos,
  criarAgendamento,
  atualizarAgendamento,
  excluirAgendamento,
} from "../services/api";

const FREQ: { valor: Frequencia; rotulo: string }[] = [
  { valor: "DIARIA", rotulo: "Diária" },
  { valor: "SEMANAL", rotulo: "Semanal" },
  { valor: "MENSAL", rotulo: "Mensal" },
];

export function AgendamentosManager() {
  const [lista, setLista] = useState<Agendamento[]>([]);
  const [url, setUrl] = useState("");
  const [frequencia, setFrequencia] = useState<Frequencia>("SEMANAL");

  async function carregar() {
    setLista(await listarAgendamentos());
  }
  useEffect(() => {
    carregar().catch(() => {});
  }, []);

  async function adicionar() {
    if (!url.trim()) return;
    await criarAgendamento(url.trim(), frequencia);
    setUrl("");
    await carregar();
  }

  return (
    <Card title="Agendamentos">
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="exemplo.com"
          className="flex-1 rounded-md border border-line bg-bg-raised px-3 py-1.5 text-sm text-slate-200 outline-none placeholder:text-slate-600"
        />
        <select
          value={frequencia}
          onChange={(e) => setFrequencia(e.target.value as Frequencia)}
          className="rounded-md border border-line bg-bg-raised px-3 py-1.5 text-sm text-slate-200 outline-none"
        >
          {FREQ.map((f) => (
            <option key={f.valor} value={f.valor}>
              {f.rotulo}
            </option>
          ))}
        </select>
        <button onClick={adicionar} className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-bg hover:opacity-90">
          Agendar
        </button>
      </div>
      {lista.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum agendamento.</p>
      ) : (
        <div className="space-y-2">
          {lista.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-bg-raised/40 p-2.5 text-sm">
              <span className="text-slate-200">{a.url}</span>
              <span className="text-xs text-slate-500">{a.frequencia.toLowerCase()}</span>
              <span className="text-[11px] text-slate-500">
                próxima: {new Date(a.proximaExecucao).toLocaleString("pt-BR")}
              </span>
              <div className="ml-auto flex items-center gap-3">
                <button
                  onClick={async () => {
                    await atualizarAgendamento(a.id, { ativo: !a.ativo });
                    await carregar();
                  }}
                  className={`text-xs ${a.ativo ? "text-ok" : "text-slate-500"} hover:underline`}
                >
                  {a.ativo ? "ativo" : "inativo"}
                </button>
                <button
                  onClick={async () => {
                    await excluirAgendamento(a.id);
                    await carregar();
                  }}
                  className="text-xs text-danger hover:underline"
                >
                  excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
