import { extrairHeaders } from "../scanner/headers.scanner";
import type { PluginScanner } from "./tipos";

export const headersPlugin: PluginScanner = {
  id: "headers",
  nome: "Cabeçalhos HTTP",
  descricao: "Verifica os cabeçalhos de segurança da resposta.",
  async coletar(ctx) {
    return { headers: extrairHeaders(ctx.headers) };
  },
};
