import { verificarArquivo } from "./exposicao.scanner";
import { validarFormatoUrl, resolverEValidarHost } from "../utils/ssrfGuard";
import { env } from "../config/env";
import { registrarPluginsEmbutidos } from "../plugins";
import { idsPlugins, executarPlugins } from "../plugins/registro";
import type { ContextoScan } from "../plugins/tipos";
import type { ScanResultado } from "../types/scanner.types";

export class ScanError extends Error {}

async function buscarComLimite(url: string, timeoutMs: number, maxBytes: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const inicio = Date.now();

  try {
    const resp = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "WebSecurityAnalyzer/1.0 (+passive-scan)" },
    });

    const tempoRespostaMs = Date.now() - inicio;

    const reader = resp.body?.getReader();
    let recebido = 0;
    const chunks: Uint8Array[] = [];

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          recebido += value.byteLength;
          if (recebido > maxBytes) {
            controller.abort();
            throw new ScanError("Resposta excedeu o tamanho máximo permitido para análise.");
          }
          chunks.push(value);
        }
      }
    }

    const html = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf-8");
    return { resp, html, tempoRespostaMs };
  } finally {
    clearTimeout(timeout);
  }
}

export async function executarScan(
  rawUrl: string,
  idsAtivos?: Set<string>,
): Promise<{ resultado: ScanResultado; urlFinal: string }> {
  const validacaoFormato = validarFormatoUrl(rawUrl);
  if (!validacaoFormato.valido || !validacaoFormato.hostname) {
    throw new ScanError(validacaoFormato.motivo || "URL inválida.");
  }

  const validacaoHost = await resolverEValidarHost(validacaoFormato.hostname);
  if (!validacaoHost.valido) {
    throw new ScanError(validacaoHost.motivo || "Host não permitido.");
  }

  let fetchResult;
  try {
    fetchResult = await buscarComLimite(rawUrl, env.scanTimeoutMs, env.maxResponseBytes);
  } catch (e: any) {
    if (e instanceof ScanError) throw e;
    if (e.name === "AbortError") throw new ScanError("Timeout ao acessar a URL informada.");
    throw new ScanError(`Não foi possível acessar a URL: ${e.message || "erro de rede/DNS."}`);
  }

  const { resp, html, tempoRespostaMs } = fetchResult;
  const urlFinal = resp.url || rawUrl;
  const hostnameFinal = new URL(urlFinal).hostname;

  const setCookieRaw = (resp.headers as any).raw
    ? (resp.headers as any).raw()["set-cookie"] || []
    : resp.headers.get("set-cookie")
      ? [resp.headers.get("set-cookie")!]
      : [];

  const [robotsTxtExiste, sitemapXmlExiste] = await Promise.all([
    verificarArquivo(urlFinal, "/robots.txt", 4000),
    verificarArquivo(urlFinal, "/sitemap.xml", 4000),
  ]);

  registrarPluginsEmbutidos();
  const ctx: ContextoScan = {
    urlFinal,
    hostname: hostnameFinal,
    headers: resp.headers,
    html,
    tempoRespostaMs,
    setCookieRaw,
    robotsTxtExiste,
    sitemapXmlExiste,
  };
  const ativos = idsAtivos ?? new Set(idsPlugins());
  const resultado = await executarPlugins(ctx, ativos);

  return { resultado, urlFinal };
}
