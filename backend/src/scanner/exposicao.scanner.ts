import type { ExposicaoInfo } from "../types/scanner.types";

export function detectarExposicao(headers: Headers, html: string): Omit<ExposicaoInfo, "robotsTxtExiste" | "sitemapXmlExiste"> {
  const comentarios = html.match(/<!--[\s\S]*?-->/g) || [];

  return {
    server: headers.get("server"),
    xPoweredBy: headers.get("x-powered-by"),
    comentariosHtmlEncontrados: comentarios.length,
  };
}

export async function verificarArquivo(baseUrl: string, caminho: string, timeoutMs: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(new URL(caminho, baseUrl).toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return resp.ok;
  } catch {
    return false;
  }
}
