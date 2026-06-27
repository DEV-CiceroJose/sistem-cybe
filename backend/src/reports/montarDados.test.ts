import { describe, it, expect } from "vitest";
import { montarDadosRelatorio } from "./montarDados";

const auditoria = {
  url: "https://exemplo.com",
  criadoEm: new Date("2026-06-27T10:00:00Z"),
  concluidoEm: new Date("2026-06-27T10:00:03Z"),
  score: 72,
  classificacao: "BOA" as const,
};
const resultado = {
  https: { habilitado: true },
  headers: { contentSecurityPolicy: null, strictTransportSecurity: null, xFrameOptions: null, xContentTypeOptions: null, referrerPolicy: null, permissionsPolicy: null },
  cookies: [],
  exposicao: { server: null, xPoweredBy: null, comentariosHtmlEncontrados: 0, robotsTxtExiste: false, sitemapXmlExiste: false },
  tecnologias: { frameworks: [], cms: [], servidorWeb: null, cdn: [], bibliotecasJs: [], linguagem: null },
  performance: { tempoRespostaMs: 100, compressao: null, cache: null, tamanhoPaginaBytes: 1, quantidadeRequisicoesIniciais: 1 },
  cors: { accessControlAllowOrigin: null, accessControlAllowCredentials: false },
  scoreDetalhe: [{ categoria: "HTTPS", pontos: 30, pontosMaximos: 30, problemas: [], aprovados: [] }],
  vulnerabilidades: [{ id: "v1", refId: "header-csp-ausente", titulo: "CSP ausente", descricao: "d", categoria: "Headers", severidade: "ALTA" as const, cvss: 6.1, impacto: 4, facilidadeCorrecao: 2, tempoEstimado: "2-4h", tempoEstimadoMin: 180, recomendacao: "Defina CSP" }],
};

describe("montarDadosRelatorio", () => {
  it("monta DadosRelatorio combinando auditoria, resultado e marca", () => {
    const d = montarDadosRelatorio(auditoria, resultado, [{ chave: "relatorio.empresa", valor: "ACME" }]);
    expect(d.url).toBe("https://exemplo.com");
    expect(d.score).toBe(72);
    expect(d.categorias).toHaveLength(1);
    expect(d.vulnerabilidades).toHaveLength(1);
    expect(d.marca.empresa).toBe("ACME");
    expect(d.resumoPrioridades.total).toBe(1);
    expect(d.resumoPrioridades.porSeveridade.ALTA).toBe(1);
  });

  it("converte datas para ISO string", () => {
    const d = montarDadosRelatorio(auditoria, resultado, []);
    expect(typeof d.criadoEm).toBe("string");
    expect(d.criadoEm).toContain("2026-06-27");
  });

  it("inclui conformidade calculada do resultado", () => {
    const d = montarDadosRelatorio(auditoria, resultado, []);
    expect(d.conformidade).toBeDefined();
    expect(d.conformidade.grupos.length).toBe(5);
    expect(typeof d.conformidade.percentual).toBe("number");
  });
});
