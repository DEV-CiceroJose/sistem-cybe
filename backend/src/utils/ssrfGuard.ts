import dns from "node:dns";
import { Address4, Address6 } from "ip-address";

/**
 * Bloqueia URLs que apontam para redes privadas, loopback, link-local,
 * metadata endpoints de cloud, e protocolos não permitidos.
 * Isso evita que o scanner seja usado como vetor de SSRF.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
]);

function isPrivateIPv4(ip: string): boolean {
  try {
    const addr = new Address4(ip);
    const ranges = [
      "10.0.0.0/8",
      "172.16.0.0/12",
      "192.168.0.0/16",
      "127.0.0.0/8",
      "169.254.0.0/16", // link-local / cloud metadata (169.254.169.254)
      "0.0.0.0/8",
      "100.64.0.0/10", // shared address space (carrier-grade NAT)
    ];
    return ranges.some((range) => addr.isInSubnet(new Address4(range)));
  } catch {
    return false;
  }
}

function isPrivateIPv6(ip: string): boolean {
  try {
    const addr = new Address6(ip);
    const ranges = ["::1/128", "fc00::/7", "fe80::/10", "::ffff:0:0/96"];
    return ranges.some((range) => addr.isInSubnet(new Address6(range)));
  } catch {
    return false;
  }
}

export interface UrlValidationResult {
  valido: boolean;
  motivo?: string;
  hostname?: string;
  protocolo?: string;
}

export function validarFormatoUrl(rawUrl: string): UrlValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { valido: false, motivo: "URL malformada ou inválida." };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { valido: false, motivo: "Apenas os protocolos http e https são permitidos." };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { valido: false, motivo: "Host não permitido para análise." };
  }

  return { valido: true, hostname, protocolo: parsed.protocol };
}

/**
 * Resolve o hostname e garante que nenhum dos IPs resolvidos
 * pertence a um espaço de endereço privado/reservado.
 */
export async function resolverEValidarHost(hostname: string): Promise<UrlValidationResult> {
  return new Promise((resolve) => {
    dns.lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
      if (err || !addresses || addresses.length === 0) {
        resolve({ valido: false, motivo: "Não foi possível resolver o DNS do host." });
        return;
      }

      for (const { address, family } of addresses) {
        const blocked = family === 4 ? isPrivateIPv4(address) : isPrivateIPv6(address);
        if (blocked) {
          resolve({
            valido: false,
            motivo: "O host resolve para um endereço IP privado/reservado e não pode ser analisado (proteção contra SSRF).",
          });
          return;
        }
      }

      resolve({ valido: true, hostname });
    });
  });
}
