import type { DnsResolver } from "./dns.resolver";
import { resolverPadrao } from "./dns.resolver";
import type { DnsInfo, MxRecord } from "../types/scanner.types";

/** DnsInfo "vazio" — usado como default de persistência e fallback de erro. */
export const DNS_VAZIO: DnsInfo = {
  a: [],
  aaaa: [],
  mx: [],
  txt: [],
  ns: [],
  cname: [],
  email: {
    spf: { presente: false, registro: null },
    dkim: { selectoresEncontrados: [] },
    dmarc: { presente: false, politica: null, registro: null },
  },
};

async function seguro<T>(fn: () => Promise<T>, vazio: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return vazio;
  }
}

/** Resolve os registros DNS básicos do hostname (tolerante a falhas por registro). */
export async function consultarDns(
  hostname: string,
  resolver: DnsResolver = resolverPadrao,
): Promise<Omit<DnsInfo, "email">> {
  const [a, aaaa, mxBruto, txtBruto, ns, cname] = await Promise.all([
    seguro(() => resolver.resolve4(hostname), [] as string[]),
    seguro(() => resolver.resolve6(hostname), [] as string[]),
    seguro(() => resolver.resolveMx(hostname), [] as { exchange: string; priority: number }[]),
    seguro(() => resolver.resolveTxt(hostname), [] as string[][]),
    seguro(() => resolver.resolveNs(hostname), [] as string[]),
    seguro(() => resolver.resolveCname(hostname), [] as string[]),
  ]);

  const mx: MxRecord[] = mxBruto.map((m) => ({ exchange: m.exchange, prioridade: m.priority }));
  const txt = txtBruto.map((partes) => partes.join(""));

  return { a, aaaa, mx, txt, ns, cname };
}
