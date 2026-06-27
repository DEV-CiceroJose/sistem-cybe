import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { Card } from "../components/Card";
import { Loader } from "../components/Loader";
import { Alert } from "../components/Alert";
import { StatusBadge } from "../components/StatusBadge";
import { SeverityBadge } from "../components/SeverityBadge";
import { buscarAuditoria, listarHistorico, extrairMensagemErro } from "../services/api";
import { ordenarVulnerabilidades } from "../utils/severidade";
import type { Auditoria, Vulnerabilidade } from "../types";

export function Dashboard() {
  const [auditorias, setAuditorias] = useState<Auditoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [riscosCriticos, setRiscosCriticos] = useState<{ auditoriaId: string; itens: Vulnerabilidade[] } | null>(null);

  useEffect(() => {
    listarHistorico(8)
      .then(async (lista) => {
        setAuditorias(lista);
        // Carrega os riscos mais graves da auditoria concluída mais recente.
        const ultima = lista.find((a) => a.status === "CONCLUIDA");
        if (ultima) {
          try {
            const detalhe = await buscarAuditoria(ultima.id);
            const vulns = detalhe.resultado?.vulnerabilidades ?? [];
            const graves = ordenarVulnerabilidades(
              vulns.filter((v) => v.severidade === "CRITICA" || v.severidade === "ALTA"),
            ).slice(0, 5);
            if (graves.length > 0) setRiscosCriticos({ auditoriaId: ultima.id, itens: graves });
          } catch {
            /* painel opcional — ignora falhas */
          }
        }
      })
      .catch((e) => setErro(extrairMensagemErro(e)))
      .finally(() => setCarregando(false));
  }, []);

  const concluidas = auditorias.filter((a) => a.status === "CONCLUIDA");
  const scoreMedio = concluidas.length
    ? Math.round(concluidas.reduce((acc, a) => acc + (a.score || 0), 0) / concluidas.length)
    : null;
  const criticas = concluidas.filter((a) => a.classificacao === "CRITICA").length;

  return (
    <>
      <Navbar title="Dashboard" subtitle="Visão geral das análises de segurança" />
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card title="Análises realizadas">
            <p className="font-display text-3xl text-slate-100">{auditorias.length}</p>
          </Card>
          <Card title="Score médio">
            <p className="font-display text-3xl text-accent">{scoreMedio ?? "—"}</p>
          </Card>
          <Card title="Críticas (🔴)">
            <p className="font-display text-3xl text-danger">{criticas}</p>
          </Card>
        </div>

        {riscosCriticos && (
          <Card
            title="Riscos críticos — última análise"
            action={
              <Link to={`/auditorias/${riscosCriticos.auditoriaId}`} className="text-xs text-accent hover:underline">
                Ver plano de ação →
              </Link>
            }
          >
            <div className="space-y-2">
              {riscosCriticos.itens.map((v) => (
                <Link
                  key={v.id}
                  to={`/auditorias/${riscosCriticos.auditoriaId}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line bg-bg-raised/40 px-3 py-2 hover:bg-bg-raised/70"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <SeverityBadge severidade={v.severidade} />
                    <span className="truncate text-sm text-slate-200">{v.titulo}</span>
                  </div>
                  <span className="shrink-0 font-display text-xs text-slate-500">CVSS {v.cvss.toFixed(1)}</span>
                </Link>
              ))}
            </div>
          </Card>
        )}

        <Card title="Análises recentes" action={
          <Link to="/nova-auditoria" className="text-xs text-accent hover:underline">+ Nova análise</Link>
        }>
          {carregando && <Loader texto="Carregando" />}
          {erro && <Alert tipo="erro">{erro}</Alert>}
          {!carregando && !erro && auditorias.length === 0 && (
            <p className="text-sm text-slate-500 py-6 text-center">
              Nenhuma análise realizada ainda. <Link to="/nova-auditoria" className="text-accent hover:underline">Inicie sua primeira auditoria</Link>.
            </p>
          )}
          {!carregando && auditorias.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-line">
                  <th className="py-2 font-normal">URL</th>
                  <th className="py-2 font-normal">Status</th>
                  <th className="py-2 font-normal">Score</th>
                  <th className="py-2 font-normal">Data</th>
                </tr>
              </thead>
              <tbody>
                {auditorias.map((a) => (
                  <tr key={a.id} className="border-b border-line/50 hover:bg-bg-raised/40">
                    <td className="py-2.5">
                      <Link to={`/auditorias/${a.id}`} className="text-slate-200 hover:text-accent transition-colors">
                        {a.url}
                      </Link>
                    </td>
                    <td className="py-2.5"><StatusBadge status={a.status} /></td>
                    <td className="py-2.5 text-slate-300">{a.score ?? "—"}</td>
                    <td className="py-2.5 text-slate-500">{new Date(a.criadoEm).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </main>
    </>
  );
}
