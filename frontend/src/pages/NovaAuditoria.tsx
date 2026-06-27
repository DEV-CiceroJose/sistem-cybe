import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { Card } from "../components/Card";
import { Loader } from "../components/Loader";
import { Alert } from "../components/Alert";
import { ProgressBar } from "../components/ProgressBar";
import { criarAuditoria, extrairMensagemErro } from "../services/api";

export function NovaAuditoria() {
  const [url, setUrl] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) {
      setErro("Informe uma URL para iniciar a análise.");
      return;
    }

    setErro(null);
    setCarregando(true);
    setProgresso(8);

    const intervalo = setInterval(() => {
      setProgresso((p) => (p < 90 ? p + Math.random() * 12 : p));
    }, 400);

    try {
      const auditoria = await criarAuditoria(url.trim());
      setProgresso(100);
      clearInterval(intervalo);
      setTimeout(() => navigate(`/auditorias/${auditoria.id}`), 300);
    } catch (e) {
      clearInterval(intervalo);
      setErro(extrairMensagemErro(e));
      setCarregando(false);
      setProgresso(0);
    }
  }

  return (
    <>
      <Navbar title="Nova Auditoria" subtitle="Insira a URL que deseja analisar" />
      <main className="flex-1 overflow-y-auto p-6">
        <Card className="max-w-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">URL do site</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://exemplo.com.br"
                disabled={carregando}
                className="w-full rounded-md border border-line bg-bg-raised px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 disabled:opacity-50"
              />
            </div>

            {erro && <Alert tipo="erro">{erro}</Alert>}

            {carregando && (
              <div className="space-y-3">
                <ProgressBar progresso={progresso} label="Executando verificações passivas de segurança..." />
                <Loader texto="Analisando" />
              </div>
            )}

            <button
              type="submit"
              disabled={carregando}
              className="w-full rounded-md bg-accent py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {carregando ? "Analisando..." : "Iniciar Análise"}
            </button>
          </form>
        </Card>

        <p className="mt-4 max-w-xl text-xs text-slate-500">
          As verificações são exclusivamente passivas (HTTPS, cabeçalhos, cookies, informações expostas,
          tecnologias e performance) e não realizam exploração de vulnerabilidades.
        </p>
      </main>
    </>
  );
}
