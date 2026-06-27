import { describe, it, expect } from "vitest";
import { analisarEmail } from "./email.scanner";
import type { DnsResolver } from "./dns.resolver";

function resolverComTxt(porHost: Record<string, string[][]>): DnsResolver {
  const txt = async (host: string) => {
    if (porHost[host]) return porHost[host];
    throw Object.assign(new Error("ENODATA"), { code: "ENODATA" });
  };
  const vazio = async () => {
    throw new Error("ENODATA");
  };
  return {
    resolve4: vazio as DnsResolver["resolve4"],
    resolve6: vazio as DnsResolver["resolve6"],
    resolveMx: vazio as DnsResolver["resolveMx"],
    resolveTxt: txt,
    resolveNs: vazio as DnsResolver["resolveNs"],
    resolveCname: vazio as DnsResolver["resolveCname"],
  };
}

describe("analisarEmail", () => {
  it("detecta SPF, DMARC com política e DKIM por selector", async () => {
    const r = resolverComTxt({
      "exemplo.com": [["v=spf1 include:_spf.google.com -all"]],
      "_dmarc.exemplo.com": [["v=DMARC1; p=reject; rua=mailto:a@exemplo.com"]],
      "google._domainkey.exemplo.com": [["v=DKIM1; k=rsa; p=ABC"]],
    });
    const e = await analisarEmail("exemplo.com", r);
    expect(e.spf.presente).toBe(true);
    expect(e.spf.registro).toContain("v=spf1");
    expect(e.dmarc.presente).toBe(true);
    expect(e.dmarc.politica).toBe("reject");
    expect(e.dkim.selectoresEncontrados).toContain("google");
  });

  it("ausência total => flags false e listas vazias", async () => {
    const e = await analisarEmail("exemplo.com", resolverComTxt({}));
    expect(e.spf.presente).toBe(false);
    expect(e.dmarc.presente).toBe(false);
    expect(e.dkim.selectoresEncontrados).toEqual([]);
  });

  it("usa o domínio sem www.", async () => {
    const r = resolverComTxt({ "exemplo.com": [["v=spf1 -all"]] });
    const e = await analisarEmail("www.exemplo.com", r);
    expect(e.spf.presente).toBe(true);
  });
});
