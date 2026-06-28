import { Routes, Route } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { NovaAuditoria } from "./pages/NovaAuditoria";
import { Historico } from "./pages/Historico";
import { Monitoramento } from "./pages/Monitoramento";
import { VisualizadorRelatorio } from "./pages/VisualizadorRelatorio";
import { Configuracoes } from "./pages/Configuracoes";
import { Login } from "./pages/Login";
import { RotaProtegida } from "./components/RotaProtegida";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <RotaProtegida>
            <div className="flex min-h-screen bg-bg">
              <Sidebar />
              <div className="flex-1 flex flex-col min-w-0">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/nova-auditoria" element={<NovaAuditoria />} />
                  <Route path="/historico" element={<Historico />} />
                  <Route path="/monitoramento" element={<Monitoramento />} />
                  <Route path="/auditorias/:id" element={<VisualizadorRelatorio />} />
                  <Route path="/configuracoes" element={<Configuracoes />} />
                </Routes>
              </div>
            </div>
          </RotaProtegida>
        }
      />
    </Routes>
  );
}
