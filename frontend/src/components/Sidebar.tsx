import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { listarAlertas } from "../services/api";
import { useAuth } from "../context/AuthContext";

const links = [
  { to: "/", label: "Dashboard", icon: "◧" },
  { to: "/nova-auditoria", label: "Nova Auditoria", icon: "▣" },
  { to: "/historico", label: "Histórico", icon: "≡" },
  { to: "/monitoramento", label: "Monitoramento", icon: "📈" },
  { to: "/configuracoes", label: "Configurações", icon: "⚙" },
];

export function Sidebar() {
  const [naoLidos, setNaoLidos] = useState(0);
  const { logout } = useAuth();
  const navigate = useNavigate();

  function sair() {
    logout();
    navigate("/login");
  }

  useEffect(() => {
    listarAlertas(false)
      .then((a) => setNaoLidos(a.length))
      .catch(() => {});
  }, []);

  return (
    <aside className="hidden md:flex md:w-60 flex-col border-r border-line bg-bg-panel/60 px-4 py-6">
      <div className="mb-8 px-2">
        <div className="flex items-center gap-2">
          <span className="text-accent text-lg font-display">▢</span>
          <span className="font-display text-sm tracking-widest text-slate-100">WEBSEC</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500 tracking-wide">ANALYZER · SPRINT 0</p>
      </div>

      <nav className="flex flex-col gap-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-accent/10 text-accent border border-accent/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-bg-raised border border-transparent"
              }`
            }
          >
            <span className="font-display text-xs">{link.icon}</span>
            {link.label}
            {link.to === "/monitoramento" && naoLidos > 0 && (
              <span className="ml-auto rounded-full bg-danger/20 px-1.5 py-0.5 text-[10px] font-medium text-danger">
                {naoLidos}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={sair}
        className="mt-auto flex items-center gap-3 rounded-md border border-transparent px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-bg-raised hover:text-slate-200"
      >
        <span className="font-display text-xs">⎋</span>
        Sair
      </button>

      <div className="px-2 pt-6 text-[11px] text-slate-600 leading-relaxed">
        <p>Verificações exclusivamente passivas.</p>
        <p>Sem exploração de vulnerabilidades.</p>
      </div>
    </aside>
  );
}
