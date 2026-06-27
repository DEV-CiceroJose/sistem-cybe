import type { MarcaRelatorio } from "./relatorio.types";

const PADRAO: MarcaRelatorio = {
  empresa: "Web Security Analyzer",
  site: "",
  auditor: "",
  contato: "",
  logoUrl: "",
};

const MAPA: Record<string, keyof MarcaRelatorio> = {
  "relatorio.empresa": "empresa",
  "relatorio.site": "site",
  "relatorio.auditor": "auditor",
  "relatorio.contato": "contato",
  "relatorio.logoUrl": "logoUrl",
};

/** Constrói a marca do relatório a partir das configurações chave/valor. */
export function lerMarca(configs: { chave: string; valor: string }[]): MarcaRelatorio {
  const marca: MarcaRelatorio = { ...PADRAO };
  for (const { chave, valor } of configs) {
    const campo = MAPA[chave];
    if (campo && valor.trim() !== "") marca[campo] = valor;
  }
  return marca;
}
