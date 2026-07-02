import { useState } from "react";
import type { TermoGlossario } from "../types";
import { Card } from "./Card";

interface GlossarioCardProps {
  termos: TermoGlossario[];
}

/** Glossário de termos de segurança, com busca simples. */
export function GlossarioCard({ termos }: GlossarioCardProps) {
  const [busca, setBusca] = useState("");

  if (termos.length === 0) return null;

  const filtro = busca.trim().toLowerCase();
  const visiveis = filtro
    ? termos.filter(
        (t) => t.termo.toLowerCase().includes(filtro) || t.definicao.toLowerCase().includes(filtro),
      )
    : termos;

  return (
    <Card
      title="Glossário de Segurança"
      action={
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar termo…"
          className="rounded-md border border-line bg-bg-raised/40 px-2.5 py-1 text-xs text-slate-200 placeholder:text-slate-500 focus:border-accent/50 focus:outline-none"
        />
      }
    >
      {visiveis.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">Nenhum termo encontrado.</p>
      ) : (
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visiveis.map((t) => (
            <div key={t.termo} className="rounded-lg border border-line bg-bg-raised/30 p-3">
              <dt className="font-display text-sm text-accent">{t.termo}</dt>
              <dd className="mt-1 text-xs text-slate-400">{t.definicao}</dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}
