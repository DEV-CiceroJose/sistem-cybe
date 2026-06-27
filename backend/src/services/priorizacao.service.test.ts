import { describe, it, expect } from "vitest";
import { ordenarVulnerabilidades, resumirPrioridades } from "./priorizacao.service";
import type { Vulnerabilidade } from "../types/scanner.types";

let seq = 0;
function v(p: Partial<Vulnerabilidade>): Vulnerabilidade {
  seq += 1;
  return {
    id: `id-${seq}`,
    refId: "x",
    titulo: "t",
    descricao: "d",
    categoria: "C",
    severidade: "BAIXA",
    cvss: 1,
    impacto: 1,
    facilidadeCorrecao: 1,
    tempoEstimado: "10 min",
    tempoEstimadoMin: 10,
    recomendacao: "r",
    ...p,
  };
}

describe("ordenarVulnerabilidades", () => {
  it("ordena por severidade (mais grave primeiro)", () => {
    const r = ordenarVulnerabilidades([v({ severidade: "BAIXA" }), v({ severidade: "CRITICA" })]);
    expect(r[0].severidade).toBe("CRITICA");
    expect(r[1].severidade).toBe("BAIXA");
  });

  it("desempata por cvss quando a severidade é igual", () => {
    const baixoCvss = v({ severidade: "ALTA", cvss: 4 });
    const altoCvss = v({ severidade: "ALTA", cvss: 8 });
    const r = ordenarVulnerabilidades([baixoCvss, altoCvss]);
    expect(r[0]).toBe(altoCvss);
  });

  it("com severidade e cvss iguais, prioriza maior facilidade de correção (quick wins)", () => {
    const dificil = v({ severidade: "ALTA", cvss: 5, facilidadeCorrecao: 2 });
    const facil = v({ severidade: "ALTA", cvss: 5, facilidadeCorrecao: 5 });
    const r = ordenarVulnerabilidades([dificil, facil]);
    expect(r[0]).toBe(facil);
  });

  it("usa impacto como último critério de desempate", () => {
    const baixoImpacto = v({ severidade: "ALTA", cvss: 5, facilidadeCorrecao: 3, impacto: 1 });
    const altoImpacto = v({ severidade: "ALTA", cvss: 5, facilidadeCorrecao: 3, impacto: 5 });
    const r = ordenarVulnerabilidades([baixoImpacto, altoImpacto]);
    expect(r[0]).toBe(altoImpacto);
  });

  it("não muta o array de entrada", () => {
    const arr = [v({ severidade: "BAIXA" }), v({ severidade: "CRITICA" })];
    const copia = [...arr];
    ordenarVulnerabilidades(arr);
    expect(arr).toEqual(copia);
  });
});

describe("resumirPrioridades", () => {
  it("conta por severidade incluindo zeros e soma o tempo", () => {
    const r = resumirPrioridades([
      v({ severidade: "CRITICA", tempoEstimadoMin: 60 }),
      v({ severidade: "CRITICA", tempoEstimadoMin: 30 }),
    ]);
    expect(r.total).toBe(2);
    expect(r.porSeveridade.CRITICA).toBe(2);
    expect(r.porSeveridade.ALTA).toBe(0);
    expect(r.porSeveridade.BAIXA).toBe(0);
    expect(r.tempoTotalEstimadoMin).toBe(90);
  });

  it("corrijaPrimeiro respeita topN e vem ordenado", () => {
    const r = resumirPrioridades(
      [v({ severidade: "BAIXA" }), v({ severidade: "CRITICA" }), v({ severidade: "ALTA" })],
      2,
    );
    expect(r.corrijaPrimeiro).toHaveLength(2);
    expect(r.corrijaPrimeiro[0].severidade).toBe("CRITICA");
    expect(r.corrijaPrimeiro[1].severidade).toBe("ALTA");
  });

  it("usa topN default 3", () => {
    const r = resumirPrioridades([
      v({ severidade: "CRITICA" }),
      v({ severidade: "ALTA" }),
      v({ severidade: "MEDIA" }),
      v({ severidade: "BAIXA" }),
    ]);
    expect(r.corrijaPrimeiro).toHaveLength(3);
  });

  it("lida com lista vazia", () => {
    const r = resumirPrioridades([]);
    expect(r.total).toBe(0);
    expect(r.tempoTotalEstimadoMin).toBe(0);
    expect(r.corrijaPrimeiro).toEqual([]);
    expect(r.porSeveridade.CRITICA).toBe(0);
  });
});
