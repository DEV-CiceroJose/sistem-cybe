import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { Card } from "../components/Card";
import { Loader } from "../components/Loader";
import { Alert } from "../components/Alert";
import { EvolucaoScore } from "../components/EvolucaoScore";
import { listarHistorico, extrairMensagemErro } from "../services/api";
import type { Auditoria } from "../types";

export function Monitoramento() {
  const [auditorias, setAuditorias] = useState<Auditoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    listarHistorico(100)
      .then(setAuditorias)
      .catch((e) => setErro(extrairMensagemErro(e)))
      .finally(() => setCarregando(false));
  }, []);

  const concluidas = auditorias.filter((a) => a.status === "CONCLUIDA");
  const porUrl = new Map<string, Auditoria[]>();
  for (const a of concluidas) {
    const lista = porUrl.get(a.url) ?? [];
    lista.push(a);
    porUrl.set(a.url, lista);
  }

  return (
    <>
      <Navbar title="Monitoramento" subtitle="Evolução do score por URL" />
      <main className="flex-1 overflow-y-auto p-6 space-y-4">
        {carregando && <Loader texto="Carregando" />}
        {erro && <Alert tipo="erro">{erro}</Alert>}
        {!carregando && !erro && porUrl.size === 0 && (
          <p className="text-sm text-slate-500">Nenhuma auditoria concluída ainda.</p>
        )}
        {[...porUrl.entries()].map(([url, lista]) => {
          const ordenadas = [...lista].sort(
            (a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime(),
          );
          const recente = ordenadas[ordenadas.length - 1];
          const pontos = ordenadas.map((a) => ({ data: a.criadoEm, score: a.score ?? 0 }));
          return (
            <Card
              key={url}
              title={url}
              action={
                <Link to={`/auditorias/${recente.id}`} className="text-xs text-accent hover:underline">
                  Ver última →
                </Link>
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-display text-3xl text-accent">{recente.score ?? "—"}</p>
                  <p className="text-xs text-slate-500">{ordenadas.length} auditoria(s)</p>
                </div>
                <EvolucaoScore pontos={pontos} />
              </div>
            </Card>
          );
        })}
      </main>
    </>
  );
}
