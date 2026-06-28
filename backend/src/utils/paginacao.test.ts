import { describe, it, expect } from "vitest";
import { paginar } from "./paginacao";

describe("paginar", () => {
  it("usa defaults sem query", () => {
    expect(paginar({})).toEqual({ limite: 20, offset: 0 });
  });
  it("respeita limite e offset válidos", () => {
    expect(paginar({ limite: "10", offset: "5" })).toEqual({ limite: 10, offset: 5 });
  });
  it("clampa o limite ao máximo (100)", () => {
    expect(paginar({ limite: "999" }).limite).toBe(100);
  });
  it("valores inválidos ou negativos caem nos defaults", () => {
    expect(paginar({ limite: "abc", offset: "-3" })).toEqual({ limite: 20, offset: 0 });
  });
  it("aceita limitePadrao e limiteMax customizados", () => {
    expect(paginar({}, 50, 200)).toEqual({ limite: 50, offset: 0 });
  });
});
