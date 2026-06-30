import { describe, it, expect } from "vitest";
import { lerPluginsAtivos, listarPluginsComStatus } from "./plugins.service";

const todos = ["https", "headers", "cookies"];

const pluginsBase = [
  { id: "https", nome: "HTTPS/TLS", descricao: "a" },
  { id: "headers", nome: "Cabeçalhos HTTP", descricao: "b" },
];

describe("listarPluginsComStatus", () => {
  it("mapeia campos e marca todos ativos por padrão", () => {
    const r = listarPluginsComStatus(pluginsBase, []);
    expect(r).toEqual([
      { id: "https", nome: "HTTPS/TLS", descricao: "a", ativo: true },
      { id: "headers", nome: "Cabeçalhos HTTP", descricao: "b", ativo: true },
    ]);
  });
  it("plugin.<id>.ativo=false marca aquele como inativo", () => {
    const r = listarPluginsComStatus(pluginsBase, [{ chave: "plugin.headers.ativo", valor: "false" }]);
    expect(r.find((p) => p.id === "headers")!.ativo).toBe(false);
    expect(r.find((p) => p.id === "https")!.ativo).toBe(true);
  });
});

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
