import type { Severidade, Vulnerabilidade } from "../types";

export const SEVERIDADE_LABEL: Record<Severidade, string> = {
  CRITICA: "Crítica",
  ALTA: "Alta",
  MEDIA: "Média",
  BAIXA: "Baixa",
  INFORMATIVA: "Informativa",
};

export const SEVERIDADE_ORDEM: Severidade[] = ["CRITICA", "ALTA", "MEDIA", "BAIXA", "INFORMATIVA"];

export const SEVERIDADE_RANK: Record<Severidade, number> = {
  CRITICA: 5,
  ALTA: 4,
  MEDIA: 3,
  BAIXA: 2,
  INFORMATIVA: 1,
};

/** Classes Tailwind por severidade (badge e barras). */
export const SEVERIDADE_ESTILO: Record<Severidade, { badge: string; ponto: string; barra: string; texto: string }> = {
  CRITICA: { badge: "bg-danger/10 text-danger border-danger/30", ponto: "bg-danger", barra: "bg-danger", texto: "text-danger" },
  ALTA: { badge: "bg-warn/10 text-warn border-warn/30", ponto: "bg-warn", barra: "bg-warn", texto: "text-warn" },
  MEDIA: { badge: "bg-amber-400/10 text-amber-300 border-amber-400/30", ponto: "bg-amber-400", barra: "bg-amber-400", texto: "text-amber-300" },
  BAIXA: { badge: "bg-sky-400/10 text-sky-300 border-sky-400/30", ponto: "bg-sky-400", barra: "bg-sky-400", texto: "text-sky-300" },
  INFORMATIVA: { badge: "bg-slate-600/20 text-slate-300 border-slate-500/30", ponto: "bg-slate-400", barra: "bg-slate-400", texto: "text-slate-300" },
};

export function formatarTempo(minutos: number): string {
  if (minutos <= 0) return "—";
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.round((minutos / 60) * 10) / 10;
  return `${horas}h`;
}

export function ordenarVulnerabilidades(vulns: Vulnerabilidade[]): Vulnerabilidade[] {
  return [...vulns].sort((a, b) => {
    const sev = SEVERIDADE_RANK[b.severidade] - SEVERIDADE_RANK[a.severidade];
    if (sev !== 0) return sev;
    if (b.cvss !== a.cvss) return b.cvss - a.cvss;
    if (b.facilidadeCorrecao !== a.facilidadeCorrecao) return b.facilidadeCorrecao - a.facilidadeCorrecao;
    return b.impacto - a.impacto;
  });
}
