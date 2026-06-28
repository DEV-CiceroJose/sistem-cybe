import { describe, it, expect } from "vitest";
import { validarCredenciais, gerarToken, verificarToken } from "./auth.service";

const esperado = { usuario: "admin", senha: "admin" };

describe("validarCredenciais", () => {
  it("true para par correto", () => {
    expect(validarCredenciais({ usuario: "admin", senha: "admin" }, esperado)).toBe(true);
  });
  it("false para senha errada", () => {
    expect(validarCredenciais({ usuario: "admin", senha: "x" }, esperado)).toBe(false);
  });
  it("false para usuário errado", () => {
    expect(validarCredenciais({ usuario: "x", senha: "admin" }, esperado)).toBe(false);
  });
});

describe("gerarToken/verificarToken", () => {
  it("token gerado é verificável com o mesmo segredo", () => {
    const t = gerarToken("segredo123");
    expect(verificarToken(t, "segredo123")?.sub).toBe("api");
  });
  it("segredo errado => null", () => {
    const t = gerarToken("segredo123");
    expect(verificarToken(t, "outro")).toBeNull();
  });
  it("token corrompido => null", () => {
    expect(verificarToken("nao.e.jwt", "segredo123")).toBeNull();
  });
});
