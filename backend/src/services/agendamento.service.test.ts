import { describe, it, expect } from "vitest";
import { calcularProximaExecucao, filtrarVencidos } from "./agendamento.service";

describe("calcularProximaExecucao", () => {
  const base = new Date("2026-06-27T10:00:00.000Z");
  it("DIARIA soma 1 dia", () => {
    expect(calcularProximaExecucao("DIARIA", base).toISOString()).toBe("2026-06-28T10:00:00.000Z");
  });
  it("SEMANAL soma 7 dias", () => {
    expect(calcularProximaExecucao("SEMANAL", base).toISOString()).toBe("2026-07-04T10:00:00.000Z");
  });
  it("MENSAL soma 1 mês", () => {
    expect(calcularProximaExecucao("MENSAL", base).toISOString()).toBe("2026-07-27T10:00:00.000Z");
  });
  it("não muta a data base", () => {
    const copia = new Date(base);
    calcularProximaExecucao("DIARIA", base);
    expect(base.getTime()).toBe(copia.getTime());
  });
});

describe("filtrarVencidos", () => {
  const agora = new Date("2026-06-27T10:00:00.000Z");
  it("retorna apenas ativos com proximaExecucao <= agora", () => {
    const lista = [
      { ativo: true, proximaExecucao: new Date("2026-06-27T09:00:00.000Z"), id: "vencido" },
      { ativo: true, proximaExecucao: new Date("2026-06-27T11:00:00.000Z"), id: "futuro" },
      { ativo: false, proximaExecucao: new Date("2026-06-27T08:00:00.000Z"), id: "inativo" },
    ];
    expect(filtrarVencidos(lista, agora).map((x) => x.id)).toEqual(["vencido"]);
  });
});
