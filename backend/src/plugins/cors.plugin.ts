import { extrairCors } from "../scanner/cors.scanner";
import type { PluginScanner } from "./tipos";

export const corsPlugin: PluginScanner = {
  id: "cors",
  nome: "CORS",
  descricao: "Lê a política de CORS da resposta.",
  async coletar(ctx) {
    return { cors: extrairCors(ctx.headers) };
  },
};
