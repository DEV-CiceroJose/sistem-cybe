import { detectarTecnologias } from "../scanner/tecnologias.scanner";
import type { PluginScanner } from "./tipos";

export const tecnologiasPlugin: PluginScanner = {
  id: "tecnologias",
  nome: "Tecnologias",
  descricao: "Identifica frameworks, CMS, servidor e bibliotecas.",
  async coletar(ctx) {
    return { tecnologias: detectarTecnologias(ctx.html, ctx.headers) };
  },
};
