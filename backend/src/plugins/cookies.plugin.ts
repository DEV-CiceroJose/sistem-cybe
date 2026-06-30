import { extrairCookies } from "../scanner/headers.scanner";
import type { PluginScanner } from "./tipos";

export const cookiesPlugin: PluginScanner = {
  id: "cookies",
  nome: "Cookies",
  descricao: "Avalia os atributos de segurança dos cookies.",
  async coletar(ctx) {
    return { cookies: extrairCookies(ctx.setCookieRaw) };
  },
};
