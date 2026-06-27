import { describe, it, expect } from "vitest";
import { calcularScore } from "./scoring.service";
import type { ScanResultado } from "../types/scanner.types";

/** ScanResultado de um site "perfeito" — sem nenhum achado. */
function base(): ScanResultado {
  return {
    https: { habilitado: true, cadeiaConfiavel: true, diasParaExpirar: 200 },
    headers: {
      contentSecurityPolicy: "x",
      strictTransportSecurity: "x",
      xFrameOptions: "x",
      xContentTypeOptions: "x",
      referrerPolicy: "x",
      permissionsPolicy: "x",
    },
    cookies: [],
    exposicao: {
      server: null,
      xPoweredBy: null,
      comentariosHtmlEncontrados: 0,
      robotsTxtExiste: true,
      sitemapXmlExiste: true,
    },
    tecnologias: { frameworks: [], cms: [], servidorWeb: null, cdn: [], bibliotecasJs: [], linguagem: null },
    performance: {
      tempoRespostaMs: 100,
      compressao: "br",
      cache: "max-age=60",
      tamanhoPaginaBytes: 1000,
      quantidadeRequisicoesIniciais: 1,
    },
    cors: { accessControlAllowOrigin: null, accessControlAllowCredentials: false },
  };
}

describe("calcularScore", () => {
  it("site perfeito => score 100, EXCELENTE, sem vulnerabilidades", () => {
    const s = calcularScore(base());
    expect(s.score).toBe(100);
    expect(s.classificacao).toBe("EXCELENTE");
    expect(s.vulnerabilidades).toHaveLength(0);
    expect(s.resumoPrioridades.total).toBe(0);
  });

  it("sem HTTPS => achado crítico https-ausente e score reduzido", () => {
    const r = base();
    r.https = { habilitado: false };
    const s = calcularScore(r);
    expect(s.vulnerabilidades.some((v) => v.refId === "https-ausente")).toBe(true);
    expect(s.score).toBeLessThan(100);
  });

  it("certificado expirado => achado cert-expirado severidade CRITICA", () => {
    const r = base();
    r.https = { habilitado: true, cadeiaConfiavel: true, diasParaExpirar: -2 };
    const s = calcularScore(r);
    const achado = s.vulnerabilidades.find((v) => v.refId === "cert-expirado");
    expect(achado).toBeDefined();
    expect(achado?.severidade).toBe("CRITICA");
  });

  it("certificado expirando (<15d) => achado cert-expirando severidade MEDIA", () => {
    const r = base();
    r.https = { habilitado: true, cadeiaConfiavel: true, diasParaExpirar: 5 };
    const s = calcularScore(r);
    const achado = s.vulnerabilidades.find((v) => v.refId === "cert-expirando");
    expect(achado).toBeDefined();
    expect(achado?.severidade).toBe("MEDIA");
  });

  it("cookie sem atributos => três achados com nome do cookie no detalhe", () => {
    const r = base();
    r.cookies = [{ nome: "sid", secure: false, httpOnly: false, sameSite: null }];
    const s = calcularScore(r);
    const doCookie = s.vulnerabilidades.filter((v) => v.categoria === "Cookies");
    expect(doCookie).toHaveLength(3);
    expect(doCookie.every((v) => v.detalhe?.includes("sid"))).toBe(true);
  });

  it("headers ausentes geram um achado por cabeçalho", () => {
    const r = base();
    r.headers = {
      contentSecurityPolicy: null,
      strictTransportSecurity: null,
      xFrameOptions: null,
      xContentTypeOptions: null,
      referrerPolicy: null,
      permissionsPolicy: null,
    };
    const s = calcularScore(r);
    expect(s.vulnerabilidades.filter((v) => v.categoria === "Headers")).toHaveLength(6);
  });

  it("exposição (server, x-powered-by, comentários) gera três achados", () => {
    const r = base();
    r.exposicao = {
      server: "nginx/1.0",
      xPoweredBy: "PHP/8",
      comentariosHtmlEncontrados: 10,
      robotsTxtExiste: true,
      sitemapXmlExiste: true,
    };
    const s = calcularScore(r);
    expect(s.vulnerabilidades.filter((v) => v.categoria === "Informações Expostas")).toHaveLength(3);
  });

  it("performance ruim gera achados de tempo, compressão e cache", () => {
    const r = base();
    r.performance = {
      tempoRespostaMs: 5000,
      compressao: null,
      cache: null,
      tamanhoPaginaBytes: 1,
      quantidadeRequisicoesIniciais: 1,
    };
    const s = calcularScore(r);
    const refs = s.vulnerabilidades.map((v) => v.refId);
    expect(refs).toContain("perf-tempo-elevado");
    expect(refs).toContain("perf-sem-compressao");
    expect(refs).toContain("perf-sem-cache");
  });

  it("retorna vulnerabilidades já ordenadas por severidade", () => {
    const r = base();
    r.https = { habilitado: false }; // crítico
    r.headers.xContentTypeOptions = null; // baixa
    const s = calcularScore(r);
    expect(s.vulnerabilidades[0].severidade).toBe("CRITICA");
  });

  it("classifica site totalmente ruim como CRITICA", () => {
    const r = base();
    r.https = { habilitado: false };
    r.headers = {
      contentSecurityPolicy: null,
      strictTransportSecurity: null,
      xFrameOptions: null,
      xContentTypeOptions: null,
      referrerPolicy: null,
      permissionsPolicy: null,
    };
    r.exposicao = {
      server: "nginx",
      xPoweredBy: "PHP",
      comentariosHtmlEncontrados: 10,
      robotsTxtExiste: false,
      sitemapXmlExiste: false,
    };
    r.performance = {
      tempoRespostaMs: 5000,
      compressao: null,
      cache: null,
      tamanhoPaginaBytes: 1,
      quantidadeRequisicoesIniciais: 1,
    };
    const s = calcularScore(r);
    expect(s.classificacao).toBe("CRITICA");
  });

  it("mantém as 5 categorias no detalhe de score", () => {
    const s = calcularScore(base());
    expect(s.categorias.map((c) => c.categoria)).toEqual([
      "HTTPS",
      "Headers",
      "Cookies",
      "Informações Expostas",
      "Performance",
    ]);
  });
});
