import type { PerformanceInfo } from "../types/scanner.types";

export function medirPerformance(
  headers: Headers,
  html: string,
  tempoRespostaMs: number
): PerformanceInfo {
  const contentEncoding = headers.get("content-encoding");
  const cacheControl = headers.get("cache-control");

  const tamanhoPaginaBytes = Buffer.byteLength(html, "utf-8");

  const scriptTags = html.match(/<script[\s>]/gi) || [];
  const linkTags = html.match(/<link[^>]+rel=["']?stylesheet/gi) || [];
  const imgTags = html.match(/<img[\s>]/gi) || [];

  return {
    tempoRespostaMs,
    compressao: contentEncoding,
    cache: cacheControl,
    tamanhoPaginaBytes,
    quantidadeRequisicoesIniciais: scriptTags.length + linkTags.length + imgTags.length,
  };
}
