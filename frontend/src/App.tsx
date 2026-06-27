import { Routes, Route } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { NovaAuditoria } from "./pages/NovaAuditoria";
import { Historico } from "./pages/Historico";
import { VisualizadorRelatorio } from "./pages/VisualizadorRelatorio";
import { Configuracoes } from "./pages/Configuracoes";

export default function App() {
  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/nova-auditoria" element={<NovaAuditoria />} />
          <Route path="/historico" element={<Historico />} />
          <Route path="/auditorias/:id" element={<VisualizadorRelatorio />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
        </Routes>
      </div>
    </div>
  );
}
