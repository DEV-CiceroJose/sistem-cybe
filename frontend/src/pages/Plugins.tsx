import { useEffect, useState } from "react";
import { Navbar } from "../components/Navbar";
import { Card } from "../components/Card";
import { Loader } from "../components/Loader";
import { Alert } from "../components/Alert";
import { listarPlugins, atualizarPlugin, extrairMensagemErro } from "../services/api";
import type { PluginInfo } from "../types";

export function Plugins() {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setPlugins(await listarPlugins());
  }
  useEffect(() => {
    carregar()
      .catch((e) => setErro(extrairMensagemErro(e)))
      .finally(() => setCarregando(false));
  }, []);

  async function alternar(p: PluginInfo) {
    try {
      await atualizarPlugin(p.id, !p.ativo);
      await carregar();
    } catch (e) {
      setErro(extrairMensagemErro(e));
    }
  }

  return (
    <>
      <Navbar title="Plugins" subtitle="Módulos de análise (marketplace local)" />
      <main className="flex-1 overflow-y-auto p-6 space-y-4">
        {carregando && <Loader texto="Carregando" />}
        {erro && <Alert tipo="erro">{erro}</Alert>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {plugins.map((p) => (
            <Card
              key={p.id}
              title={p.nome}
              action={
                <button
                  onClick={() => alternar(p)}
                  className={`rounded-full border px-3 py-1 text-xs ${p.ativo ? "border-ok/30 bg-ok/10 text-ok" : "border-line bg-bg-raised/40 text-slate-500"}`}
                >
                  {p.ativo ? "Ativo" : "Inativo"}
                </button>
              }
            >
              <p className="text-sm text-slate-400">{p.descricao}</p>
              <p className="mt-2 text-[11px] text-slate-600">id: {p.id}</p>
            </Card>
          ))}
        </div>
      </main>
    </>
  );
}
