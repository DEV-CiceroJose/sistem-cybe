import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { Card } from "../components/Card";
import { Loader } from "../components/Loader";
import { Alert } from "../components/Alert";
import { StatusBadge } from "../components/StatusBadge";
import { listarHistorico, excluirAuditoria, extrairMensagemErro } from "../services/api";
import type { Auditoria } from "../types";

export function Historico() {
  const [auditorias, setAuditorias] = useState<Auditoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  function carregar() {
    setCarregando(true);
    listarHistorico(100)
      .then(setAuditorias)
      .catch((e) => setErro(extrairMensagemErro(e)))
      .finally(() => setCarregando(false));
  }

  useEffect(() => { carregar(); }, []);

  async function handleExcluir(id: string) {
    try {
      await excluirAuditoria(id);
      setAuditorias((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      setErro(extrairMensagemErro(e));
    }
  }

  return (
    <>
      <Navbar title="Histórico" subtitle="Todas as análises realizadas" />
      <main className="flex-1 overflow-y-auto p-6">
        <Card>
          {carregando && <Loader texto="Carregando histórico" />}
          {erro && <Alert tipo="erro">{erro}</Alert>}
          {!carregando && !erro && auditorias.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-500">Nenhuma análise no histórico.</p>
          )}
          {!carregando && auditorias.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-slate-500">
                  <th className="py-2 font-normal">URL</th>
                  <th className="py-2 font-normal">Status</th>
                  <th className="py-2 font-normal">Score</th>
                  <th className="py-2 font-normal">Classificação</th>
                  <th className="py-2 font-normal">Data</th>
                  <th className="py-2 font-normal"></th>
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
                    <td className="py-2.5 text-slate-400">{a.classificacao ?? "—"}</td>
                    <td className="py-2.5 text-slate-500">{new Date(a.criadoEm).toLocaleString("pt-BR")}</td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => handleExcluir(a.id)}
                        className="text-xs text-slate-500 hover:text-danger transition-colors"
                      >
                        Excluir
                      </button>
                    </td>
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
