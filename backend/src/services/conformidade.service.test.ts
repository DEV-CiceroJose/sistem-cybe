import { describe, it, expect } from "vitest";
import { avaliarConformidade } from "./conformidade.service";
import { DNS_VAZIO } from "../scanner/dns.scanner";
import type { ScanResultado } from "../types/scanner.types";

function base(): ScanResultado {
  return {
    https: { habilitado: true, cadeiaConfiavel: true, diasParaExpirar: 200 },
    headers: { contentSecurityPolicy: "x", strictTransportSecurity: "x", xFrameOptions: "x", xContentTypeOptions: "x", referrerPolicy: "x", permissionsPolicy: "x" },
    cookies: [],
    exposicao: { server: null, xPoweredBy: null, comentariosHtmlEncontrados: 0, robotsTxtExiste: true, sitemapXmlExiste: true },
    tecnologias: { frameworks: [], cms: [], servidorWeb: null, cdn: [], bibliotecasJs: [], linguagem: null },
    performance: { tempoRespostaMs: 100, compressao: "br", cache: "max-age=60", tamanhoPaginaBytes: 1, quantidadeRequisicoesIniciais: 1 },
    cors: { accessControlAllowOrigin: null, accessControlAllowCredentials: false },
    dns: {
      ...DNS_VAZIO,
      email: {
        spf: { presente: true, registro: "v=spf1 -all" },
        dkim: { selectoresEncontrados: ["google"] },
        dmarc: { presente: true, politica: "reject", registro: "v=DMARC1; p=reject" },
      },
    },
  };
}

describe("avaliarConformidade", () => {
  it("site perfeito => 100% e todos os grupos presentes", () => {
    const c = avaliarConformidade(base());
    expect(c.percentual).toBe(100);
    expect(c.grupos.map((g) => g.grupo)).toEqual([
      "HTTPS/TLS", "Cabeçalhos HTTP", "Cookies", "CORS", "Exposição de Informação", "Segurança de E-mail",
    ]);
    expect(c.grupos.every((g) => g.itens.every((i) => i.status === "CONFORME"))).toBe(true);
  });

  it("sem HTTPS => itens do grupo HTTPS ficam NAO_CONFORME e % cai", () => {
    const r = base();
    r.https = { habilitado: false };
    const c = avaliarConformidade(r);
    const grupo = c.grupos.find((g) => g.grupo === "HTTPS/TLS")!;
    expect(grupo.itens.find((i) => i.id === "https-habilitado")!.status).toBe("NAO_CONFORME");
    expect(c.percentual).toBeLessThan(100);
  });

  it("cookie sem Secure => cookie-secure NAO_CONFORME", () => {
    const r = base();
    r.cookies = [{ nome: "sid", secure: false, httpOnly: true, sameSite: "Lax" }];
    const c = avaliarConformidade(r);
    const grupo = c.grupos.find((g) => g.grupo === "Cookies")!;
    expect(grupo.itens.find((i) => i.id === "cookie-secure")!.status).toBe("NAO_CONFORME");
    expect(grupo.itens.find((i) => i.id === "cookie-httponly")!.status).toBe("CONFORME");
  });

  it("sem cookies => grupo Cookies é CONFORME", () => {
    const c = avaliarConformidade(base());
    const grupo = c.grupos.find((g) => g.grupo === "Cookies")!;
    expect(grupo.itens.every((i) => i.status === "CONFORME")).toBe(true);
  });

  it("CORS '*' com credenciais => cors-sem-wildcard-credenciais NAO_CONFORME", () => {
    const r = base();
    r.cors = { accessControlAllowOrigin: "*", accessControlAllowCredentials: true };
    const c = avaliarConformidade(r);
    const grupo = c.grupos.find((g) => g.grupo === "CORS")!;
    expect(grupo.itens.find((i) => i.id === "cors-sem-wildcard-credenciais")!.status).toBe("NAO_CONFORME");
  });

  it("CORS '*' sem credenciais => cors-restritivo PARCIAL", () => {
    const r = base();
    r.cors = { accessControlAllowOrigin: "*", accessControlAllowCredentials: false };
    const c = avaliarConformidade(r);
    const grupo = c.grupos.find((g) => g.grupo === "CORS")!;
    expect(grupo.itens.find((i) => i.id === "cors-restritivo")!.status).toBe("PARCIAL");
  });

  it("grupo Segurança de E-mail: SPF+DMARC reject+DKIM => CONFORME", () => {
    const c = avaliarConformidade(base());
    const grupo = c.grupos.find((g) => g.grupo === "Segurança de E-mail")!;
    expect(grupo.itens.every((i) => i.status === "CONFORME")).toBe(true);
  });

  it("DMARC p=none => política PARCIAL; sem DKIM => email-dkim PARCIAL", () => {
    const r = base();
    r.dns = {
      ...r.dns,
      email: {
        spf: { presente: true, registro: "v=spf1 -all" },
        dkim: { selectoresEncontrados: [] },
        dmarc: { presente: true, politica: "none", registro: "v=DMARC1; p=none" },
      },
    };
    const c = avaliarConformidade(r);
    const grupo = c.grupos.find((g) => g.grupo === "Segurança de E-mail")!;
    expect(grupo.itens.find((i) => i.id === "email-dmarc-politica")!.status).toBe("PARCIAL");
    expect(grupo.itens.find((i) => i.id === "email-dkim")!.status).toBe("PARCIAL");
  });

  it("sem SPF/DMARC => itens NAO_CONFORME", () => {
    const r = base();
    r.dns = { ...r.dns, email: { spf: { presente: false, registro: null }, dkim: { selectoresEncontrados: [] }, dmarc: { presente: false, politica: null, registro: null } } };
    const c = avaliarConformidade(r);
    const grupo = c.grupos.find((g) => g.grupo === "Segurança de E-mail")!;
    expect(grupo.itens.find((i) => i.id === "email-spf")!.status).toBe("NAO_CONFORME");
    expect(grupo.itens.find((i) => i.id === "email-dmarc")!.status).toBe("NAO_CONFORME");
  });

  it("percentual do grupo de cabeçalhos: 5 de 6 presentes => 83%", () => {
    const r = base();
    r.headers.contentSecurityPolicy = null;
    const c = avaliarConformidade(r);
    const grupo = c.grupos.find((g) => g.grupo === "Cabeçalhos HTTP")!;
    expect(grupo.total).toBe(6);
    expect(grupo.percentual).toBe(Math.round((5 / 6) * 100));
  });
});
