import type { ScanResultado } from "../types/scanner.types";
import { DNS_VAZIO } from "../scanner/dns.scanner";
import type { ContextoScan, PluginScanner } from "./tipos";

/** ScanResultado neutro: base sobre a qual as fatias dos plugins ativos são mescladas. */
export const RESULTADO_VAZIO: ScanResultado = {
  https: { habilitado: false },
  headers: {
    contentSecurityPolicy: null,
    strictTransportSecurity: null,
    xFrameOptions: null,
    xContentTypeOptions: null,
    referrerPolicy: null,
    permissionsPolicy: null,
  },
  cookies: [],
  exposicao: {
    server: null,
    xPoweredBy: null,
    comentariosHtmlEncontrados: 0,
    robotsTxtExiste: false,
    sitemapXmlExiste: false,
  },
  tecnologias: { frameworks: [], cms: [], servidorWeb: null, cdn: [], bibliotecasJs: [], linguagem: null },
  performance: { tempoRespostaMs: 0, compressao: null, cache: null, tamanhoPaginaBytes: 0, quantidadeRequisicoesIniciais: 0 },
  cors: { accessControlAllowOrigin: null, accessControlAllowCredentials: false },
  dns: DNS_VAZIO,
};

const registro = new Map<string, PluginScanner>();

export function registrarPlugin(p: PluginScanner): void {
  registro.set(p.id, p);
}

export function listarPlugins(): PluginScanner[] {
  return [...registro.values()];
}

export function idsPlugins(): string[] {
  return [...registro.keys()];
}

export function limparRegistro(): void {
  registro.clear();
}

function clonarVazio(): ScanResultado {
  return JSON.parse(JSON.stringify(RESULTADO_VAZIO)) as ScanResultado;
}

/** Executa os plugins ativos e mescla suas fatias sobre o resultado base. */
export async function executarPlugins(ctx: ContextoScan, idsAtivos: Set<string>): Promise<ScanResultado> {
  const resultado = clonarVazio();
  const ativos = listarPlugins().filter((p) => idsAtivos.has(p.id));
  await Promise.all(
    ativos.map(async (p) => {
      try {
        const fatia = await p.coletar(ctx);
        Object.assign(resultado, fatia);
      } catch (e) {
        console.error(`[plugin:${p.id}]`, (e as Error).message);
      }
    }),
  );
  return resultado;
}
