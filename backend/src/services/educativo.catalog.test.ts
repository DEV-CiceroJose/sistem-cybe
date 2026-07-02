import { describe, it, expect } from "vitest";
import { obterConteudoEducativo, listarConteudos, listarGlossario } from "./educativo.catalog";
import { REFIDS_CONHECIDOS } from "./vulnerabilidades.catalog";

describe("educativo.catalog", () => {
  it("tem conteúdo para todos os refIds do catálogo de vulnerabilidades", () => {
    for (const refId of REFIDS_CONHECIDOS) {
      expect(obterConteudoEducativo(refId), `faltou conteúdo para ${refId}`).not.toBeNull();
    }
  });

  it("cada conteúdo tem explicações não vazias e ao menos uma referência http", () => {
    for (const c of listarConteudos()) {
      expect(c.explicacaoSimples.length).toBeGreaterThan(0);
      expect(c.explicacaoTecnica.length).toBeGreaterThan(0);
      expect(c.exemploAtaque.length).toBeGreaterThan(0);
      expect(c.referencias.length).toBeGreaterThanOrEqual(1);
      expect(c.referencias.every((r) => /^https?:\/\//.test(r.url))).toBe(true);
    }
  });

  it("refId desconhecido retorna null", () => {
    expect(obterConteudoEducativo("nao-existe")).toBeNull();
  });

  it("glossário não é vazio e os termos têm definição", () => {
    const g = listarGlossario();
    expect(g.length).toBeGreaterThanOrEqual(10);
    expect(g.every((t) => t.termo.length > 0 && t.definicao.length > 0)).toBe(true);
  });
});
