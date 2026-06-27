import { describe, it, expect } from "vitest";
import { compararAuditorias } from "./comparacao.service";
import type { AuditoriaComparavel, Vulnerabilidade } from "../types/scanner.types";

function v(p: Partial<Vulnerabilidade>): Vulnerabilidade {
  return {
    id: Math.random().toString(36),
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
function aud(p: Partial<AuditoriaComparavel>): AuditoriaComparavel {
  return { id: "a", score: 50, conformidadePercentual: 50, vulnerabilidades: [], ...p };
}

describe("compararAuditorias", () => {
  it("calcula os deltas de score e conformidade", () => {
    const c = compararAuditorias(
      aud({ id: "ant", score: 40, conformidadePercentual: 60 }),
      aud({ id: "atu", score: 70, conformidadePercentual: 80 }),
    );
    expect(c.baseId).toBe("ant");
    expect(c.atualId).toBe("atu");
    expect(c.scoreDelta).toBe(30);
    expect(c.conformidadeDelta).toBe(20);
  });

  it("classifica achados em novos, resolvidos e mantidos", () => {
    const anterior = aud({ vulnerabilidades: [v({ refId: "header-csp-ausente", titulo: "CSP" }), v({ refId: "exp-server", titulo: "Server" })] });
    const atual = aud({ vulnerabilidades: [v({ refId: "header-csp-ausente", titulo: "CSP" }), v({ refId: "cookie-sem-secure", titulo: "Secure" })] });
    const c = compararAuditorias(anterior, atual);
    expect(c.novos.map((x) => x.refId)).toEqual(["cookie-sem-secure"]);
    expect(c.resolvidos.map((x) => x.refId)).toEqual(["exp-server"]);
    expect(c.mantidos.map((x) => x.refId)).toEqual(["header-csp-ausente"]);
  });

  it("usa refId+detalhe como identidade (mesmo refId, detalhe diferente conta separado)", () => {
    const anterior = aud({ vulnerabilidades: [v({ refId: "cookie-sem-secure", detalhe: "Cookie: a" })] });
    const atual = aud({ vulnerabilidades: [v({ refId: "cookie-sem-secure", detalhe: "Cookie: b" })] });
    const c = compararAuditorias(anterior, atual);
    expect(c.novos).toHaveLength(1);
    expect(c.resolvidos).toHaveLength(1);
    expect(c.mantidos).toHaveLength(0);
  });

  it("ordena diffs por severidade (crítico primeiro)", () => {
    const atual = aud({ vulnerabilidades: [v({ refId: "b", severidade: "BAIXA" }), v({ refId: "a", severidade: "CRITICA" })] });
    const c = compararAuditorias(aud({}), atual);
    expect(c.novos[0].severidade).toBe("CRITICA");
  });

  it("sem vulnerabilidades em ambos => listas vazias", () => {
    const c = compararAuditorias(aud({}), aud({}));
    expect(c.novos).toEqual([]);
    expect(c.resolvidos).toEqual([]);
    expect(c.mantidos).toEqual([]);
  });
});
