import type { StatusAuditoria } from "../types";

const ESTILOS: Record<StatusAuditoria, string> = {
  PENDENTE: "bg-slate-700/40 text-slate-300 border-slate-600/40",
  EM_ANDAMENTO: "bg-accent/10 text-accent border-accent/30",
  CONCLUIDA: "bg-ok/10 text-ok border-ok/30",
  ERRO: "bg-danger/10 text-danger border-danger/30",
};

const LABELS: Record<StatusAuditoria, string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  ERRO: "Erro",
};

export function StatusBadge({ status }: { status: StatusAuditoria }) {
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${ESTILOS[status]}`}>
      {LABELS[status]}
    </span>
  );
}
