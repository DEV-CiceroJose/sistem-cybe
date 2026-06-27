import { describe, it, expect } from "vitest";
import { gerarRelatorioHtml } from "./html.report";
import { DNS_VAZIO } from "../scanner/dns.scanner";
import type { DadosRelatorio } from "./relatorio.types";

function dados(over: Partial<DadosRelatorio> = {}): DadosRelatorio {
  return {
    url: "https://exemplo.com",
    criadoEm: "2026-06-27T10:00:00.000Z",
    concluidoEm: "2026-06-27T10:00:03.000Z",
    score: 72,
    classificacao: "BOA",
    resultado: {
      https: { habilitado: true, versaoTLS: "TLSv1.3", emissor: "R3", diasParaExpirar: 80, cadeiaConfiavel: true },
      headers: { contentSecurityPolicy: null, strictTransportSecurity: "x", xFrameOptions: "x", xContentTypeOptions: "x", referrerPolicy: "x", permissionsPolicy: "x" },
      cookies: [{ nome: "sid", secure: true, httpOnly: true, sameSite: "Lax" }],
      exposicao: { server: "nginx", xPoweredBy: null, comentariosHtmlEncontrados: 2, robotsTxtExiste: true, sitemapXmlExiste: false },
      tecnologias: { frameworks: ["React"], cms: [], servidorWeb: "nginx", cdn: [], bibliotecasJs: [], linguagem: null },
      performance: { tempoRespostaMs: 320, compressao: "br", cache: "max-age=60", tamanhoPaginaBytes: 2048, quantidadeRequisicoesIniciais: 5 },
      cors: { accessControlAllowOrigin: null, accessControlAllowCredentials: false },
      dns: { ...DNS_VAZIO, a: ["1.2.3.4"], mx: [{ exchange: "mx.acme.com", prioridade: 10 }], email: { spf: { presente: true, registro: "v=spf1 -all" }, dkim: { selectoresEncontrados: ["google"] }, dmarc: { presente: true, politica: "reject", registro: "v=DMARC1; p=reject" } } },
    },
    categorias: [
      { categoria: "HTTPS", pontos: 30, pontosMaximos: 30, problemas: [], aprovados: ["ok"] },
      { categoria: "Headers", pontos: 20, pontosMaximos: 25, problemas: ["CSP ausente"], aprovados: [] },
    ],
    vulnerabilidades: [
      { id: "v1", refId: "header-csp-ausente", titulo: "CSP ausente", descricao: "d", categoria: "Headers", severidade: "ALTA", cvss: 6.1, impacto: 4, facilidadeCorrecao: 2, tempoEstimado: "2-4h", tempoEstimadoMin: 180, recomendacao: "Defina CSP" },
    ],
    resumoPrioridades: { total: 1, porSeveridade: { CRITICA: 0, ALTA: 1, MEDIA: 0, BAIXA: 0, INFORMATIVA: 0 }, tempoTotalEstimadoMin: 180, corrijaPrimeiro: [] },
    conformidade: { grupos: [{ grupo: "HTTPS/TLS", itens: [{ id: "https-habilitado", titulo: "Conexão HTTPS habilitada", status: "CONFORME", referenciaOwasp: "A02:2021 – Cryptographic Failures", explicacao: "e", recomendacao: "r" }], conformes: 1, total: 1, percentual: 100 }], conformes: 1, total: 1, percentual: 100 },
    marca: { empresa: "ACME Seg", site: "acme.com", auditor: "Cícero", contato: "ci@acme.com", logoUrl: "" },
    ...over,
  };
}

describe("gerarRelatorioHtml", () => {
  it("é um documento HTML completo", () => {
    const html = gerarRelatorioHtml(dados());
    expect(html).toContain("<!DOCTYPE html>");
    expect(html.toLowerCase()).toContain("<html");
    expect(html).toContain("</html>");
  });

  it("capa traz empresa, site e URL auditada", () => {
    const html = gerarRelatorioHtml(dados());
    expect(html).toContain("ACME Seg");
    expect(html).toContain("acme.com");
    expect(html).toContain("https://exemplo.com");
  });

  it("inclui índice clicável com âncoras que existem como ids de seção", () => {
    const html = gerarRelatorioHtml(dados());
    for (const id of ["resumo", "graficos", "linha-do-tempo", "evidencias", "dns", "plano-de-acao", "recomendacoes", "conformidade", "assinatura"]) {
      expect(html).toContain(`href="#${id}"`);
      expect(html).toContain(`id="${id}"`);
    }
  });

  it("embute os gráficos SVG", () => {
    const html = gerarRelatorioHtml(dados());
    expect((html.match(/<svg/g) || []).length).toBeGreaterThanOrEqual(3);
  });

  it("mostra evidências técnicas (cookie e certificado)", () => {
    const html = gerarRelatorioHtml(dados());
    expect(html).toContain("sid");
    expect(html).toContain("TLSv1.3");
  });

  it("lista os achados do plano de ação com severidade", () => {
    const html = gerarRelatorioHtml(dados());
    expect(html).toContain("CSP ausente");
    expect(html).toContain("Alta");
  });

  it("assinatura mostra auditor e empresa", () => {
    const html = gerarRelatorioHtml(dados());
    const fim = html.slice(html.indexOf('id="assinatura"'));
    expect(fim).toContain("Cícero");
    expect(fim).toContain("ACME Seg");
  });

  it("traz CSS de impressão com quebra de página", () => {
    const html = gerarRelatorioHtml(dados());
    expect(html).toContain("@media print");
    expect(html).toContain("break-before");
  });

  it("sem vulnerabilidades, o plano mostra estado positivo", () => {
    const html = gerarRelatorioHtml(dados({ vulnerabilidades: [], resumoPrioridades: { total: 0, porSeveridade: { CRITICA: 0, ALTA: 0, MEDIA: 0, BAIXA: 0, INFORMATIVA: 0 }, tempoTotalEstimadoMin: 0, corrijaPrimeiro: [] } }));
    expect(html).toContain("Nenhuma vulnerabilidade");
  });

  it("inclui a seção DNS & E-mail com registros e status de e-mail", () => {
    const html = gerarRelatorioHtml(dados());
    expect(html).toContain('id="dns"');
    expect(html).toContain("1.2.3.4");
    expect(html).toContain("mx.acme.com");
    expect(html).toContain("SPF");
  });

  it("inclui a seção de conformidade com a porcentagem", () => {
    const html = gerarRelatorioHtml(dados());
    expect(html).toContain('id="conformidade"');
    expect(html).toContain("Conformidade");
    expect(html).toContain("100%");
  });

  it("escapa HTML vindo dos dados (sem injeção)", () => {
    const html = gerarRelatorioHtml(dados({ url: "https://x.com/<script>alert(1)</script>" }));
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});
