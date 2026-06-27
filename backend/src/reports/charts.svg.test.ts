import { describe, it, expect } from "vitest";
import { donutScore, barrasCategorias, barrasSeveridade } from "./charts.svg";
import type { ScoreCategoria } from "../types/scanner.types";

describe("donutScore", () => {
  it("retorna um SVG contendo o número do score", () => {
    const svg = donutScore(72, "BOA");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("72");
  });
  it("score 0 e 100 não quebram o SVG", () => {
    expect(donutScore(0, "CRITICA").startsWith("<svg")).toBe(true);
    expect(donutScore(100, "EXCELENTE")).toContain("100");
  });
});

describe("barrasCategorias", () => {
  it("gera uma barra (<rect) por categoria", () => {
    const cats: ScoreCategoria[] = [
      { categoria: "HTTPS", pontos: 30, pontosMaximos: 30, problemas: [], aprovados: [] },
      { categoria: "Headers", pontos: 10, pontosMaximos: 25, problemas: [], aprovados: [] },
    ];
    const svg = barrasCategorias(cats);
    expect(svg.startsWith("<svg")).toBe(true);
    expect((svg.match(/<rect/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(svg).toContain("HTTPS");
    expect(svg).toContain("Headers");
  });
  it("lista vazia ainda retorna um SVG", () => {
    expect(barrasCategorias([]).startsWith("<svg")).toBe(true);
  });
});

describe("barrasSeveridade", () => {
  it("mostra a contagem por severidade", () => {
    const svg = barrasSeveridade({ CRITICA: 2, ALTA: 1, MEDIA: 0, BAIXA: 3, INFORMATIVA: 0 });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("Crítica");
  });
});
