import type { Severidade } from "../types";
import { SEVERIDADE_ESTILO, SEVERIDADE_LABEL } from "../utils/severidade";

interface SeverityBadgeProps {
  severidade: Severidade;
  className?: string;
}

export function SeverityBadge({ severidade, className = "" }: SeverityBadgeProps) {
  const estilo = SEVERIDADE_ESTILO[severidade];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${estilo.badge} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${estilo.ponto}`} />
      {SEVERIDADE_LABEL[severidade]}
    </span>
  );
}
