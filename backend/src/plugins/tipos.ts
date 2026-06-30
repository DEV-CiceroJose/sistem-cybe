import type { ScanResultado } from "../types/scanner.types";

/** Contexto compartilhado montado pelo scanner após o fetch único da página. */
export interface ContextoScan {
  urlFinal: string;
  hostname: string;
  headers: Headers;
  html: string;
  tempoRespostaMs: number;
  setCookieRaw: string[];
  robotsTxtExiste: boolean;
  sitemapXmlExiste: boolean;
}

/** Um plugin de coleta: recebe o contexto e devolve sua fatia do ScanResultado. */
export interface PluginScanner {
  id: string;
  nome: string;
  descricao: string;
  coletar(ctx: ContextoScan): Promise<Partial<ScanResultado>>;
}
