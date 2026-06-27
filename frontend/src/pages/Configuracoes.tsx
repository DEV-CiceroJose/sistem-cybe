import { useEffect, useState } from "react";
import { Navbar } from "../components/Navbar";
import { Card } from "../components/Card";
import { Alert } from "../components/Alert";
import { api, extrairMensagemErro, listarConfiguracoes, salvarConfiguracao } from "../services/api";

interface Marca {
  empresa: string;
  site: string;
  auditor: string;
  contato: string;
  logoUrl: string;
}

const CAMPOS_MARCA: { chave: keyof Marca; label: string; placeholder: string }[] = [
  { chave: "empresa", label: "Empresa", placeholder: "Web Security Analyzer" },
  { chave: "site", label: "Site", placeholder: "minhaempresa.com" },
  { chave: "auditor", label: "Auditor responsável", placeholder: "Nome do auditor" },
  { chave: "contato", label: "Contato", placeholder: "email@empresa.com" },
  { chave: "logoUrl", label: "Logo (URL)", placeholder: "https://.../logo.png" },
];

export function Configuracoes() {
  const [tema, setTema] = useState<"escuro" | "claro">("escuro");
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [marca, setMarca] = useState<Marca>({ empresa: "", site: "", auditor: "", contato: "", logoUrl: "" });
  const [marcaSalva, setMarcaSalva] = useState(false);
  const [marcaErro, setMarcaErro] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", tema === "escuro");
  }, [tema]);

  useEffect(() => {
    listarConfiguracoes()
      .then((cfgs) => {
        const get = (k: string) => cfgs.find((c) => c.chave === k)?.valor ?? "";
        setMarca({
          empresa: get("relatorio.empresa"),
          site: get("relatorio.site"),
          auditor: get("relatorio.auditor"),
          contato: get("relatorio.contato"),
          logoUrl: get("relatorio.logoUrl"),
        });
      })
      .catch(() => {});
  }, []);

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

  async function salvarMarca() {
    setMarcaSalva(false);
    setMarcaErro(null);
    try {
      await Promise.all(
        CAMPOS_MARCA.map((c) => salvarConfiguracao(`relatorio.${c.chave}`, marca[c.chave])),
      );
      setMarcaSalva(true);
    } catch (e) {
      setMarcaErro(extrairMensagemErro(e));
    }
  }

  return (
    <>
      <Navbar title="Configurações" subtitle="Preferências do sistema" />
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
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

        <Card className="max-w-md" title="Relatório / Marca">
          <p className="mb-4 text-xs text-slate-500">
            Esses dados aparecem na capa e na assinatura dos relatórios exportados.
          </p>
          <div className="space-y-3">
            {CAMPOS_MARCA.map((campo) => (
              <label key={campo.chave} className="block text-sm">
                <span className="text-slate-300">{campo.label}</span>
                <input
                  type="text"
                  value={marca[campo.chave]}
                  placeholder={campo.placeholder}
                  onChange={(e) => setMarca((m) => ({ ...m, [campo.chave]: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-line bg-bg-raised px-3 py-1.5 text-sm text-slate-200 outline-none placeholder:text-slate-600"
                />
              </label>
            ))}
          </div>

          {marcaErro && <div className="mt-4"><Alert tipo="erro">{marcaErro}</Alert></div>}
          {marcaSalva && <div className="mt-4"><Alert tipo="sucesso">Marca salva.</Alert></div>}

          <button
            onClick={salvarMarca}
            className="mt-5 w-full rounded-md bg-accent py-2 text-sm font-medium text-bg hover:opacity-90 transition-opacity"
          >
            Salvar marca
          </button>
        </Card>
      </main>
    </>
  );
}
