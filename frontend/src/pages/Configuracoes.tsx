import { useEffect, useState } from "react";
import { Navbar } from "../components/Navbar";
import { Card } from "../components/Card";
import { Alert } from "../components/Alert";
import { api, extrairMensagemErro } from "../services/api";

export function Configuracoes() {
  const [tema, setTema] = useState<"escuro" | "claro">("escuro");
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", tema === "escuro");
  }, [tema]);

  async function handleSalvar() {
    setSalvo(false);
    setErro(null);
    try {
      await api.put("/configuracoes", { chave: "tema", valor: tema });
      setSalvo(true);
    } catch (e) {
      setErro(extrairMensagemErro(e));
    }
  }

  return (
    <>
      <Navbar title="Configurações" subtitle="Preferências do sistema" />
      <main className="flex-1 overflow-y-auto p-6">
        <Card className="max-w-md" title="Aparência">
          <div className="space-y-3">
            <label className="flex items-center justify-between text-sm">
              <span className="text-slate-300">Tema</span>
              <select
                value={tema}
                onChange={(e) => setTema(e.target.value as "escuro" | "claro")}
                className="rounded-md border border-line bg-bg-raised px-3 py-1.5 text-sm text-slate-200 outline-none"
              >
                <option value="escuro">Escuro</option>
                <option value="claro">Claro (em breve)</option>
              </select>
            </label>
            <p className="text-xs text-slate-500">O tema claro será disponibilizado em uma sprint futura.</p>
          </div>

          {erro && <div className="mt-4"><Alert tipo="erro">{erro}</Alert></div>}
          {salvo && <div className="mt-4"><Alert tipo="sucesso">Preferências salvas.</Alert></div>}

          <button
            onClick={handleSalvar}
            className="mt-5 w-full rounded-md bg-accent py-2 text-sm font-medium text-bg hover:opacity-90 transition-opacity"
          >
            Salvar
          </button>
        </Card>
      </main>
    </>
  );
}
