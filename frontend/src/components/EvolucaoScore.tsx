interface Ponto {
  data: string;
  score: number;
}

export function EvolucaoScore({ pontos }: { pontos: Ponto[] }) {
  if (pontos.length === 0) return null;
  const w = 280;
  const h = 60;
  const pad = 6;
  const xs = (i: number) => (pontos.length === 1 ? w / 2 : pad + (i * (w - 2 * pad)) / (pontos.length - 1));
  const ys = (s: number) => h - pad - (s / 100) * (h - 2 * pad);
  const pathD = pontos.map((p, i) => `${i === 0 ? "M" : "L"} ${xs(i).toFixed(1)} ${ys(p.score).toFixed(1)}`).join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="text-accent">
      {pontos.length > 1 && <path d={pathD} fill="none" stroke="currentColor" strokeWidth="2" />}
      {pontos.map((p, i) => (
        <circle key={i} cx={xs(i)} cy={ys(p.score)} r="2.5" fill="currentColor" />
      ))}
    </svg>
  );
}
