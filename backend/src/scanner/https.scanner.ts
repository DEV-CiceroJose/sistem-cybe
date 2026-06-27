import tls from "node:tls";
import type { HttpsInfo } from "../types/scanner.types";

export function inspecionarHttps(hostname: string, porta = 443, timeoutMs = 8000): Promise<HttpsInfo> {
  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host: hostname,
        port: porta,
        servername: hostname,
        timeout: timeoutMs,
        rejectUnauthorized: false, // queremos inspecionar mesmo certificados inválidos
      },
      () => {
        try {
          const cert = socket.getPeerCertificate(true);
          const protocolo = socket.getProtocol() || undefined;
          const autorizado = socket.authorized;

          if (!cert || Object.keys(cert).length === 0) {
            resolve({ habilitado: true, erro: "Não foi possível obter o certificado." });
            socket.end();
            return;
          }

          const validoAte = cert.valid_to ? new Date(cert.valid_to) : null;
          const diasParaExpirar = validoAte
            ? Math.ceil((validoAte.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : undefined;

          const emissorRaw = cert.issuer?.O || cert.issuer?.CN;
          const emissor = Array.isArray(emissorRaw) ? emissorRaw[0] : emissorRaw;

          resolve({
            habilitado: true,
            versaoTLS: protocolo,
            emissor,
            validoDe: cert.valid_from,
            validoAte: cert.valid_to,
            diasParaExpirar,
            cadeiaConfiavel: autorizado,
          });
        } catch (e) {
          resolve({ habilitado: true, erro: "Erro ao processar certificado TLS." });
        } finally {
          socket.end();
        }
      }
    );

    socket.on("error", () => {
      resolve({ habilitado: false, erro: "Conexão HTTPS não estabelecida (porta 443 indisponível ou TLS ausente)." });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({ habilitado: false, erro: "Timeout ao conectar via HTTPS." });
    });
  });
}
