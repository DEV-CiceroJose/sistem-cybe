import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Alert } from "../components/Alert";
import { extrairMensagemErro } from "../services/api";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      await login(usuario, senha);
      navigate("/");
    } catch (err) {
      setErro(extrairMensagemErro(err));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-bg">
      <form onSubmit={entrar} className="w-full max-w-sm space-y-4 rounded-lg border border-line bg-bg-panel/70 p-6">
        <h1 className="font-display text-xl text-slate-100">Web Security Analyzer</h1>
        <p className="text-sm text-slate-500">Entre para acessar o painel.</p>
        {erro && <Alert tipo="erro">{erro}</Alert>}
        <input
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          placeholder="Usuário"
          className="w-full rounded-md border border-line bg-bg-raised px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600"
        />
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Senha"
          className="w-full rounded-md border border-line bg-bg-raised px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600"
        />
        <button
          disabled={carregando}
          className="w-full rounded-md bg-accent py-2 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-50"
        >
          {carregando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
