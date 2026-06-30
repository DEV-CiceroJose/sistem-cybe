import { describe, it, expect } from "vitest";
import { lerPluginsAtivos } from "./plugins.service";

const todos = ["https", "headers", "cookies"];

describe("lerPluginsAtivos", () => {
  it("sem configs => todos ativos", () => {
    expect(lerPluginsAtivos([], todos)).toEqual(new Set(todos));
  });
  it("plugin.<id>.ativo=false desativa aquele id", () => {
    const ativos = lerPluginsAtivos([{ chave: "plugin.headers.ativo", valor: "false" }], todos);
    expect(ativos.has("headers")).toBe(false);
    expect(ativos.has("https")).toBe(true);
  });
  it("valor diferente de 'false' mantém ativo", () => {
    const ativos = lerPluginsAtivos([{ chave: "plugin.headers.ativo", valor: "true" }], todos);
    expect(ativos.has("headers")).toBe(true);
  });
  it("ignora chaves de plugins desconhecidos", () => {
    const ativos = lerPluginsAtivos([{ chave: "plugin.inexistente.ativo", valor: "false" }], todos);
    expect(ativos).toEqual(new Set(todos));
  });
});
