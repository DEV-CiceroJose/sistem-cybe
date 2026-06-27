import type { ScoreCategoria, Severidade } from "../types/scanner.types";

const COR = {
  accent: "#2A9D85",
  trilho: "#E2E8F0",
  texto: "#0F172A",
  critica: "#DC2626",
  alta: "#EA580C",
  media: "#D97706",
  baixa: "#2563EB",
  informativa: "#64748B",
};

function escapar(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Donut com o score (0-100) ao centro e a classificação abaixo. */
export function donutScore(score: number, classificacao: string): string {
  const v = Math.max(0, Math.min(100, score));
  const r = 52;
  const circ = 2 * Math.PI * r;
  const preenchido = (v / 100) * circ;
  return `<svg width="140" height="140" viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Score ${v}">
  <circle cx="70" cy="70" r="${r}" fill="none" stroke="${COR.trilho}" stroke-width="14"/>
  <circle cx="70" cy="70" r="${r}" fill="none" stroke="${COR.accent}" stroke-width="14"
    stroke-dasharray="${preenchido.toFixed(2)} ${circ.toFixed(2)}" stroke-linecap="round"
    transform="rotate(-90 70 70)"/>
  <text x="70" y="68" text-anchor="middle" font-size="30" font-weight="700" fill="${COR.texto}">${v}</text>
  <text x="70" y="88" text-anchor="middle" font-size="11" fill="${COR.informativa}">${escapar(classificacao)}</text>
</svg>`;
}

/** Barras horizontais de pontos por categoria. */
export function barrasCategorias(categorias: ScoreCategoria[]): string {
  const larguraBarra = 280;
  const alturaLinha = 28;
  const altura = Math.max(alturaLinha, categorias.length * alturaLinha) + 10;
  const linhas = categorias
    .map((c, i) => {
      const y = i * alturaLinha + 6;
      const frac = c.pontosMaximos ? c.pontos / c.pontosMaximos : 0;
      const w = Math.round(frac * larguraBarra);
      return `<text x="0" y="${y + 12}" font-size="11" fill="${COR.texto}">${escapar(c.categoria)}</text>
  <rect x="120" y="${y}" width="${larguraBarra}" height="16" rx="3" fill="${COR.trilho}"/>
  <rect x="120" y="${y}" width="${w}" height="16" rx="3" fill="${COR.accent}"/>
  <text x="${120 + larguraBarra + 6}" y="${y + 12}" font-size="10" fill="${COR.informativa}">${c.pontos}/${c.pontosMaximos}</text>`;
    })
    .join("\n  ");
  return `<svg width="460" height="${altura}" viewBox="0 0 460 ${altura}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Pontos por categoria">
  ${linhas}
</svg>`;
}

/** Barras horizontais com a contagem de achados por severidade. */
export function barrasSeveridade(porSeveridade: Record<Severidade, number>): string {
  const ordem: { chave: Severidade; rotulo: string; cor: string }[] = [
    { chave: "CRITICA", rotulo: "Crítica", cor: COR.critica },
    { chave: "ALTA", rotulo: "Alta", cor: COR.alta },
    { chave: "MEDIA", rotulo: "Média", cor: COR.media },
    { chave: "BAIXA", rotulo: "Baixa", cor: COR.baixa },
    { chave: "INFORMATIVA", rotulo: "Informativa", cor: COR.informativa },
  ];
  const max = Math.max(1, ...ordem.map((o) => porSeveridade[o.chave]));
  const larguraBarra = 240;
  const alturaLinha = 26;
  const altura = ordem.length * alturaLinha + 10;
  const linhas = ordem
    .map((o, i) => {
      const y = i * alturaLinha + 6;
      const w = Math.round((porSeveridade[o.chave] / max) * larguraBarra);
      return `<text x="0" y="${y + 12}" font-size="11" fill="${COR.texto}">${o.rotulo}</text>
  <rect x="90" y="${y}" width="${larguraBarra}" height="16" rx="3" fill="${COR.trilho}"/>
  <rect x="90" y="${y}" width="${w}" height="16" rx="3" fill="${o.cor}"/>
  <text x="${90 + larguraBarra + 6}" y="${y + 12}" font-size="10" fill="${COR.informativa}">${porSeveridade[o.chave]}</text>`;
    })
    .join("\n  ");
  return `<svg width="380" height="${altura}" viewBox="0 0 380 ${altura}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Achados por severidade">
  ${linhas}
</svg>`;
}
