import { describe, it, expect } from "vitest";
import { consultarDns } from "./dns.scanner";
import type { DnsResolver } from "./dns.resolver";

function fakeResolver(over: Partial<DnsResolver> = {}): DnsResolver {
  const vazio = async () => {
    throw Object.assign(new Error("ENODATA"), { code: "ENODATA" });
  };
  return {
    resolve4: over.resolve4 ?? (async () => ["1.2.3.4"]),
    resolve6: over.resolve6 ?? (async () => ["::1"]),
    resolveMx: over.resolveMx ?? (async () => [{ exchange: "mx.exemplo.com", priority: 10 }]),
    resolveTxt: over.resolveTxt ?? (async () => [["v=spf1 -all"]]),
    resolveNs: over.resolveNs ?? (async () => ["ns1.exemplo.com"]),
    resolveCname: over.resolveCname ?? (vazio as DnsResolver["resolveCname"]),
  };
}

describe("consultarDns", () => {
  it("mapeia A/AAAA/MX/TXT/NS", async () => {
    const dns = await consultarDns("exemplo.com", fakeResolver());
    expect(dns.a).toEqual(["1.2.3.4"]);
    expect(dns.aaaa).toEqual(["::1"]);
    expect(dns.mx).toEqual([{ exchange: "mx.exemplo.com", prioridade: 10 }]);
    expect(dns.txt).toContain("v=spf1 -all");
    expect(dns.ns).toEqual(["ns1.exemplo.com"]);
  });

  it("registro que falha vira lista vazia sem quebrar os demais", async () => {
    const dns = await consultarDns(
      "exemplo.com",
      fakeResolver({
        resolveCname: async () => {
          throw new Error("ENOTFOUND");
        },
      }),
    );
    expect(dns.cname).toEqual([]);
    expect(dns.a).toEqual(["1.2.3.4"]);
  });

  it("junta partes de TXT multi-string", async () => {
    const dns = await consultarDns(
      "exemplo.com",
      fakeResolver({
        resolveTxt: async () => [["v=spf1 ", "include:_spf.google.com -all"]],
      }),
    );
    expect(dns.txt).toContain("v=spf1 include:_spf.google.com -all");
  });
});
