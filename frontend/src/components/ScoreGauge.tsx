import type { Classificacao } from "../types";

const CORES: Record<Classificacao, string> = {
  EXCELENTE: "#3DD6B0",
  BOA: "#A8DD6B",
  ATENCAO: "#F2B84B",
  CRITICA: "#F2545B",
};

const LABELS: Record<Classificacao, string> = {
  EXCELENTE: "🟢 Excelente",
  BOA: "🟡 Boa",
  ATENCAO: "🟠 Atenção",
  CRITICA: "🔴 Crítica",
};

interface ScoreGaugeProps {
  score: number;
  classificacao: Classificacao;
  size?: number;
}

export function ScoreGauge({ score, classificacao, size = 160 }: ScoreGaugeProps) {
  const cor = CORES[classificacao];
  const raio = size / 2 - 10;
  const circunferencia = 2 * Math.PI * raio;
  const offset = circunferencia - (score / 100) * circunferencia;
  const centro = size / 2;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={centro} cy={centro} r={raio} stroke="#1E2733" strokeWidth={10} fill="none" />
          <circle
            cx={centro}
            cy={centro}
            r={raio}
            stroke={cor}
            strokeWidth={10}
            fill="none"
            strokeDasharray={circunferencia}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-3xl text-slate-100">{score}</span>
          <span className="text-[10px] text-slate-500 tracking-widest">/ 100</span>
        </div>
      </div>
      <span className="text-sm font-medium" style={{ color: cor }}>{LABELS[classificacao]}</span>
    </div>
  );
}
