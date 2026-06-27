import type { DnsResolver } from "./dns.resolver";
import { resolverPadrao } from "./dns.resolver";
import type { EmailSeguranca } from "../types/scanner.types";

export const SELECTORS_DKIM_COMUNS = [
  "default", "google", "selector1", "selector2", "dkim", "mail", "k1", "s1", "s2", "smtp",
];

async function txtSeguro(resolver: DnsResolver, host: string): Promise<string[]> {
  try {
    const partes = await resolver.resolveTxt(host);
    return partes.map((p) => p.join(""));
  } catch {
    return [];
  }
}

/** Verifica SPF, DMARC e DKIM (best-effort por selectors comuns) do domínio. */
export async function analisarEmail(
  hostname: string,
  resolver: DnsResolver = resolverPadrao,
): Promise<EmailSeguranca> {
  const dominio = hostname.replace(/^www\./, "");

  const txtDominio = await txtSeguro(resolver, dominio);
  const spfRegistro = txtDominio.find((t) => t.toLowerCase().startsWith("v=spf1")) ?? null;

  const txtDmarc = await txtSeguro(resolver, `_dmarc.${dominio}`);
  const dmarcRegistro = txtDmarc.find((t) => t.toLowerCase().includes("v=dmarc1")) ?? null;
  const politica = dmarcRegistro ? (dmarcRegistro.match(/p=(\w+)/i)?.[1]?.toLowerCase() ?? null) : null;

  const selectoresEncontrados: string[] = [];
  await Promise.all(
    SELECTORS_DKIM_COMUNS.map(async (sel) => {
      const txt = await txtSeguro(resolver, `${sel}._domainkey.${dominio}`);
      if (txt.some((t) => /v=dkim1/i.test(t) || /(^|;)\s*p=/i.test(t))) {
        selectoresEncontrados.push(sel);
      }
    }),
  );

  return {
    spf: { presente: !!spfRegistro, registro: spfRegistro },
    dmarc: { presente: !!dmarcRegistro, politica, registro: dmarcRegistro },
    dkim: { selectoresEncontrados: selectoresEncontrados.sort() },
  };
}
