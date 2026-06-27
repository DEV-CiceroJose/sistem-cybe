import { inspecionarHttps } from "./https.scanner";
import { extrairHeaders, extrairCookies } from "./headers.scanner";
import { detectarExposicao, verificarArquivo } from "./exposicao.scanner";
import { detectarTecnologias } from "./tecnologias.scanner";
import { medirPerformance } from "./performance.scanner";
import { extrairCors } from "./cors.scanner";
import { consultarDns, DNS_VAZIO } from "./dns.scanner";
import { analisarEmail } from "./email.scanner";
import { validarFormatoUrl, resolverEValidarHost } from "../utils/ssrfGuard";
import { env } from "../config/env";
import type { ScanResultado, DnsInfo } from "../types/scanner.types";

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

export async function executarScan(rawUrl: string): Promise<{ resultado: ScanResultado; urlFinal: string }> {
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

  const setCookieRaw = (resp.headers as any).raw ? (resp.headers as any).raw()["set-cookie"] || [] : resp.headers.get("set-cookie") ? [resp.headers.get("set-cookie")!] : [];

  const [https, robotsExiste, sitemapExiste] = await Promise.all([
    inspecionarHttps(hostnameFinal),
    verificarArquivo(urlFinal, "/robots.txt", 4000),
    verificarArquivo(urlFinal, "/sitemap.xml", 4000),
  ]);

  const headersInfo = extrairHeaders(resp.headers);
  const cookies = extrairCookies(setCookieRaw);
  const exposicaoBase = detectarExposicao(resp.headers, html);
  const tecnologias = detectarTecnologias(html, resp.headers);
  const performance = medirPerformance(resp.headers, html, tempoRespostaMs);
  const cors = extrairCors(resp.headers);

  let dns: DnsInfo;
  try {
    const [base, email] = await Promise.all([
      consultarDns(hostnameFinal),
      analisarEmail(hostnameFinal),
    ]);
    dns = { ...base, email };
  } catch (e: any) {
    dns = { ...DNS_VAZIO, erro: e?.message || "Falha ao consultar DNS." };
  }

  const resultado: ScanResultado = {
    https,
    headers: headersInfo,
    cookies,
    exposicao: {
      ...exposicaoBase,
      robotsTxtExiste: robotsExiste,
      sitemapXmlExiste: sitemapExiste,
    },
    tecnologias,
    performance,
    cors,
    dns,
  };

  return { resultado, urlFinal };
}
