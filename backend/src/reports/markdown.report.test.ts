import { describe, it, expect } from "vitest";
import { gerarRelatorioMarkdown } from "./markdown.report";
import { calcularScore } from "../services/scoring.service";
import { DNS_VAZIO } from "../scanner/dns.scanner";
import type { ScanResultado } from "../types/scanner.types";

function base(): ScanResultado {
  return {
    https: { habilitado: true, versaoTLS: "TLSv1.3", emissor: "R3", diasParaExpirar: 90, cadeiaConfiavel: true },
    headers: { contentSecurityPolicy: null, strictTransportSecurity: "x", xFrameOptions: "x", xContentTypeOptions: "x", referrerPolicy: "x", permissionsPolicy: "x" },
    cookies: [{ nome: "sid", secure: true, httpOnly: true, sameSite: "Lax" }],
    exposicao: { server: "nginx", xPoweredBy: null, comentariosHtmlEncontrados: 0, robotsTxtExiste: true, sitemapXmlExiste: true },
    tecnologias: { frameworks: [], cms: [], servidorWeb: "nginx", cdn: [], bibliotecasJs: [], linguagem: null },
    performance: { tempoRespostaMs: 200, compressao: "br", cache: "max-age=60", tamanhoPaginaBytes: 1000, quantidadeRequisicoesIniciais: 3 },
    cors: { accessControlAllowOrigin: null, accessControlAllowCredentials: false },
    dns: DNS_VAZIO,
  };
}

describe("gerarRelatorioMarkdown (aprimorado)", () => {
  it("mantém o plano de ação priorizado da Sprint 1", () => {
    const r = base();
    const md = gerarRelatorioMarkdown("https://exemplo.com", r, calcularScore(r));
    expect(md).toContain("Plano de Ação Priorizado");
  });

  it("inclui seção de evidências técnicas", () => {
    const r = base();
    const md = gerarRelatorioMarkdown("https://exemplo.com", r, calcularScore(r));
    expect(md).toContain("## Evidências Técnicas");
    expect(md).toContain("TLSv1.3");
    expect(md).toContain("sid");
  });

  it("inclui assinatura ao final", () => {
    const r = base();
    const md = gerarRelatorioMarkdown("https://exemplo.com", r, calcularScore(r));
    expect(md).toContain("## Assinatura");
  });

  it("inclui a seção de conformidade", () => {
    const r = base();
    const md = gerarRelatorioMarkdown("https://exemplo.com", r, calcularScore(r));
    expect(md).toContain("## Conformidade (OWASP Top 10)");
    expect(md).toContain("Conformidade geral:");
  });

  it("inclui a seção DNS & E-mail", () => {
    const r = base();
    const md = gerarRelatorioMarkdown("https://exemplo.com", r, calcularScore(r));
    expect(md).toContain("## DNS & E-mail");
    expect(md).toContain("SPF");
  });
});
