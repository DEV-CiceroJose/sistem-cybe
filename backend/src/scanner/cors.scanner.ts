import type { CorsInfo } from "../types/scanner.types";

/** Lê os cabeçalhos de CORS relevantes para avaliação de configuração insegura. */
export function extrairCors(headers: Headers): CorsInfo {
  const cred = headers.get("access-control-allow-credentials");
  return {
    accessControlAllowOrigin: headers.get("access-control-allow-origin"),
    accessControlAllowCredentials: (cred || "").toLowerCase() === "true",
  };
}
