import { describe, it, expect } from "vitest";
import { criarVulnerabilidade, SEVERIDADE_RANK, SEVERIDADE_LABEL } from "./vulnerabilidades.catalog";

describe("criarVulnerabilidade", () => {
  it("cria uma vulnerabilidade a partir de um refId conhecido", () => {
    const v = criarVulnerabilidade("https-ausente");
    expect(v.refId).toBe("https-ausente");
    expect(v.severidade).toBe("CRITICA");
    expect(v.categoria).toBe("HTTPS");
    expect(v.cvss).toBeGreaterThan(0);
    expect(v.tempoEstimadoMin).toBeGreaterThan(0);
    expect(v.impacto).toBeGreaterThanOrEqual(1);
    expect(v.facilidadeCorrecao).toBeGreaterThanOrEqual(1);
  });

  it("aplica overrides de severidade, cvss e detalhe", () => {
    const v = criarVulnerabilidade("cert-expirado", { detalhe: "há 3 dias", severidade: "ALTA", cvss: 9.1 });
    expect(v.severidade).toBe("ALTA");
    expect(v.cvss).toBe(9.1);
    expect(v.detalhe).toBe("há 3 dias");
  });

  it("gera ids únicos por instância", () => {
    const a = criarVulnerabilidade("https-ausente");
    const b = criarVulnerabilidade("https-ausente");
    expect(a.id).not.toBe(b.id);
  });

  it("lança erro para refId desconhecido", () => {
    expect(() => criarVulnerabilidade("nao-existe")).toThrow();
  });

  it("expõe SEVERIDADE_RANK ordenando CRITICA acima de INFORMATIVA", () => {
    expect(SEVERIDADE_RANK.CRITICA).toBeGreaterThan(SEVERIDADE_RANK.INFORMATIVA);
    expect(SEVERIDADE_RANK.ALTA).toBeGreaterThan(SEVERIDADE_RANK.MEDIA);
  });

  it("expõe rótulos legíveis por severidade", () => {
    expect(SEVERIDADE_LABEL.CRITICA).toBe("Crítica");
    expect(SEVERIDADE_LABEL.INFORMATIVA).toBe("Informativa");
  });
});
