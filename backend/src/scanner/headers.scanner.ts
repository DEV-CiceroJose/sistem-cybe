import type { HeadersInfo, CookieInfo } from "../types/scanner.types";

export function extrairHeaders(headers: Headers): HeadersInfo {
  return {
    contentSecurityPolicy: headers.get("content-security-policy"),
    strictTransportSecurity: headers.get("strict-transport-security"),
    xFrameOptions: headers.get("x-frame-options"),
    xContentTypeOptions: headers.get("x-content-type-options"),
    referrerPolicy: headers.get("referrer-policy"),
    permissionsPolicy: headers.get("permissions-policy"),
  };
}

/**
 * Faz parsing simples de cabeçalhos Set-Cookie (pode haver múltiplos).
 */
export function extrairCookies(setCookieHeaders: string[]): CookieInfo[] {
  return setCookieHeaders.map((raw) => {
    const partes = raw.split(";").map((p) => p.trim());
    const [nomeValor] = partes;
    const nome = nomeValor.split("=")[0];

    const secure = partes.some((p) => p.toLowerCase() === "secure");
    const httpOnly = partes.some((p) => p.toLowerCase() === "httponly");
    const sameSitePart = partes.find((p) => p.toLowerCase().startsWith("samesite"));
    const sameSite = sameSitePart ? sameSitePart.split("=")[1] || "Strict" : null;

    return { nome, secure, httpOnly, sameSite };
  });
}
