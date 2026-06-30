import { detectarExposicao } from "../scanner/exposicao.scanner";
import type { PluginScanner } from "./tipos";

export const exposicaoPlugin: PluginScanner = {
  id: "exposicao",
  nome: "Informações Expostas",
  descricao: "Detecta exposição de software, comentários e arquivos.",
  async coletar(ctx) {
    const base = detectarExposicao(ctx.headers, ctx.html);
    return {
      exposicao: {
        ...base,
        robotsTxtExiste: ctx.robotsTxtExiste,
        sitemapXmlExiste: ctx.sitemapXmlExiste,
      },
    };
  },
};
