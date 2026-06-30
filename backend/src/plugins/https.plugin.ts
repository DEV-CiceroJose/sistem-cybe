import { inspecionarHttps } from "../scanner/https.scanner";
import type { PluginScanner } from "./tipos";

export const httpsPlugin: PluginScanner = {
  id: "https",
  nome: "HTTPS/TLS",
  descricao: "Inspeciona certificado e configuração TLS do host.",
  async coletar(ctx) {
    return { https: await inspecionarHttps(ctx.hostname) };
  },
};
