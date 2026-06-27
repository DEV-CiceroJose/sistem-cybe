import { describe, it, expect } from "vitest";
import { lerMarca } from "./branding.service";

describe("lerMarca", () => {
  it("usa defaults quando não há configurações", () => {
    const m = lerMarca([]);
    expect(m.empresa).toBe("Web Security Analyzer");
    expect(m.site).toBe("");
    expect(m.auditor).toBe("");
    expect(m.contato).toBe("");
    expect(m.logoUrl).toBe("");
  });

  it("aplica overrides das chaves relatorio.*", () => {
    const m = lerMarca([
      { chave: "relatorio.empresa", valor: "ACME Seg" },
      { chave: "relatorio.site", valor: "acme.com" },
      { chave: "relatorio.auditor", valor: "Cícero" },
      { chave: "relatorio.contato", valor: "ci@acme.com" },
      { chave: "relatorio.logoUrl", valor: "https://acme.com/logo.png" },
    ]);
    expect(m.empresa).toBe("ACME Seg");
    expect(m.site).toBe("acme.com");
    expect(m.auditor).toBe("Cícero");
    expect(m.contato).toBe("ci@acme.com");
    expect(m.logoUrl).toBe("https://acme.com/logo.png");
  });

  it("ignora chaves desconhecidas e mantém defaults", () => {
    const m = lerMarca([{ chave: "tema", valor: "claro" }]);
    expect(m.empresa).toBe("Web Security Analyzer");
  });
});
