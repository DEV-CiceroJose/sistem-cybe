import { medirPerformance } from "../scanner/performance.scanner";
import type { PluginScanner } from "./tipos";

export const performancePlugin: PluginScanner = {
  id: "performance",
  nome: "Performance",
  descricao: "Mede tempo de resposta, compressão e cache.",
  async coletar(ctx) {
    return { performance: medirPerformance(ctx.headers, ctx.html, ctx.tempoRespostaMs) };
  },
};
