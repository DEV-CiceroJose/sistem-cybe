import { describe, it, expect } from "vitest";
import { gerarColecaoPostman } from "./postman";

const openapi = {
  info: { title: "API", version: "1.0.0" },
  paths: {
    "/auth/login": { post: { summary: "login", security: [] } },
    "/auditorias": { get: { summary: "lista" } },
  },
};

describe("gerarColecaoPostman", () => {
  it("usa o schema v2.1 e o título da API", () => {
    const c = gerarColecaoPostman(openapi);
    expect(c.info.schema).toBe("https://schema.getpostman.com/json/collection/v2.1.0/collection.json");
    expect(c.info.name).toBe("API");
  });
  it("gera um item por operação", () => {
    const c = gerarColecaoPostman(openapi);
    expect(c.item).toHaveLength(2);
    const metodos = c.item.map((i) => i.request.method).sort();
    expect(metodos).toEqual(["GET", "POST"]);
  });
  it("monta a URL com baseUrl + path", () => {
    const c = gerarColecaoPostman(openapi, "http://localhost:3001/api/v1");
    const login = c.item.find((i) => i.request.method === "POST")!;
    expect(String(login.request.url)).toContain("http://localhost:3001/api/v1/auth/login");
  });
  it("rotas não-públicas recebem header Authorization Bearer", () => {
    const c = gerarColecaoPostman(openapi);
    const lista = c.item.find((i) => i.name.includes("/auditorias"))!;
    const temAuth = (lista.request.header || []).some((h) => h.key === "Authorization");
    expect(temAuth).toBe(true);
    const login = c.item.find((i) => i.name.includes("/auth/login"))!;
    const loginAuth = (login.request.header || []).some((h) => h.key === "Authorization");
    expect(loginAuth).toBe(false);
  });
});
