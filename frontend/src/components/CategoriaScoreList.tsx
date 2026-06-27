import type { ScoreCategoria } from "../types";

export function CategoriaScoreList({ categorias }: { categorias: ScoreCategoria[] }) {
  return (
    <div className="space-y-3">
      {categorias.map((cat) => {
        const pct = Math.round((cat.pontos / cat.pontosMaximos) * 100);
        return (
          <div key={cat.categoria}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-slate-300">{cat.categoria}</span>
              <span className="text-slate-500">{cat.pontos}/{cat.pontosMaximos}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-raised">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
