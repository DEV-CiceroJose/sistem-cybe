import { describe, it, expect } from "vitest";
import { gerarApendiceEducativoMd, gerarApendiceEducativoHtml } from "./educativo.report";
import { obterConteudoEducativo } from "../services/educativo.catalog";

describe("educativo.report", () => {
  it("Markdown inclui a explicação simples e ao menos uma referência do refId", () => {
    const md = gerarApendiceEducativoMd(["header-csp-ausente"]);
    const c = obterConteudoEducativo("header-csp-ausente")!;
    expect(md).toContain(c.explicacaoSimples);
    expect(md).toContain(c.referencias[0].url);
  });

  it("Markdown deduplica refIds repetidos", () => {
    const md = gerarApendiceEducativoMd(["header-csp-ausente", "header-csp-ausente"]);
    const c = obterConteudoEducativo("header-csp-ausente")!;
    const ocorrencias = md.split(c.explicacaoSimples).length - 1;
    expect(ocorrencias).toBe(1);
  });

  it("Markdown ignora refIds desconhecidos", () => {
    const md = gerarApendiceEducativoMd(["nao-existe"]);
    expect(md).toContain("Nenhum achado");
  });

  it("Markdown com lista vazia mostra texto de nenhum achado", () => {
    expect(gerarApendiceEducativoMd([])).toContain("Nenhum achado");
  });

  it("HTML inclui a explicação simples e escapa o conteúdo", () => {
    const html = gerarApendiceEducativoHtml(["header-csp-ausente"]);
    const c = obterConteudoEducativo("header-csp-ausente")!;
    expect(html).toContain(c.explicacaoSimples);
    expect(html).toContain(c.referencias[0].url);
    expect(html).not.toContain("<script>");
  });

  it("HTML com lista vazia mostra texto de nenhum achado", () => {
    expect(gerarApendiceEducativoHtml([])).toContain("Nenhum achado");
  });
});
