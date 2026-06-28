import { describe, it, expect } from "vitest";
import { gerarAlertas } from "./alertas.service";
import type { ComparacaoResultado } from "../types/scanner.types";

function comp(p: Partial<ComparacaoResultado>): ComparacaoResultado {
  return {
    baseId: "ant",
    atualId: "atu",
    scoreAnterior: 80,
    scoreAtual: 80,
    scoreDelta: 0,
    conformidadeAnterior: 90,
    conformidadeAtual: 90,
    conformidadeDelta: 0,
    novos: [],
    resolvidos: [],
    mantidos: [],
    ...p,
  };
}

describe("gerarAlertas", () => {
  it("gera NOVO_ACHADO quando há novos", () => {
    const a = gerarAlertas(comp({ novos: [{ refId: "x", titulo: "X", severidade: "ALTA" }] }));
    expect(a.some((x) => x.tipo === "NOVO_ACHADO")).toBe(true);
  });
  it("não gera NOVO_ACHADO sem novos", () => {
    expect(gerarAlertas(comp({})).some((x) => x.tipo === "NOVO_ACHADO")).toBe(false);
  });
  it("gera QUEDA_SCORE quando scoreDelta <= -limiar (default 5)", () => {
    expect(gerarAlertas(comp({ scoreAnterior: 80, scoreAtual: 70, scoreDelta: -10 })).some((x) => x.tipo === "QUEDA_SCORE")).toBe(true);
  });
  it("não gera QUEDA_SCORE para queda menor que o limiar", () => {
    expect(gerarAlertas(comp({ scoreDelta: -3 })).some((x) => x.tipo === "QUEDA_SCORE")).toBe(false);
  });
  it("respeita limiarScore custom", () => {
    expect(gerarAlertas(comp({ scoreDelta: -3 }), { limiarScore: 2 }).some((x) => x.tipo === "QUEDA_SCORE")).toBe(true);
  });
  it("gera QUEDA_CONFORMIDADE quando conformidadeDelta < 0", () => {
    expect(gerarAlertas(comp({ conformidadeDelta: -5 })).some((x) => x.tipo === "QUEDA_CONFORMIDADE")).toBe(true);
  });
  it("estável => nenhum alerta", () => {
    expect(gerarAlertas(comp({}))).toEqual([]);
  });
});
