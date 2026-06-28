import { describe, it, expect } from "vitest";
import { construirPayloadWebhook, assinarPayload } from "./webhook.service";

describe("construirPayloadWebhook", () => {
  it("monta o payload com evento fixo e campos da auditoria", () => {
    const p = construirPayloadWebhook({
      id: "a1",
      url: "https://x.com",
      score: 72,
      classificacao: "BOA",
      concluidoEm: new Date("2026-06-28T10:00:03.000Z"),
    });
    expect(p.evento).toBe("auditoria.concluida");
    expect(p.auditoriaId).toBe("a1");
    expect(p.url).toBe("https://x.com");
    expect(p.score).toBe(72);
    expect(p.classificacao).toBe("BOA");
    expect(p.concluidoEm).toBe("2026-06-28T10:00:03.000Z");
  });
  it("lida com concluidoEm nulo", () => {
    const p = construirPayloadWebhook({ id: "a1", url: "u", score: null, classificacao: null, concluidoEm: null });
    expect(p.concluidoEm).toBeNull();
    expect(p.score).toBeNull();
  });
});

describe("assinarPayload", () => {
  it("é determinístico para o mesmo corpo+secret (hex de 64 chars)", () => {
    const s1 = assinarPayload("corpo", "segredo");
    const s2 = assinarPayload("corpo", "segredo");
    expect(s1).toBe(s2);
    expect(s1).toMatch(/^[a-f0-9]{64}$/);
  });
  it("muda com secret diferente", () => {
    expect(assinarPayload("corpo", "a")).not.toBe(assinarPayload("corpo", "b"));
  });
});
