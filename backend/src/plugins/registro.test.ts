import { describe, it, expect, beforeEach } from "vitest";
import {
  registrarPlugin,
  listarPlugins,
  idsPlugins,
  limparRegistro,
  executarPlugins,
  RESULTADO_VAZIO,
} from "./registro";
import type { ContextoScan, PluginScanner } from "./tipos";

const ctx = {} as ContextoScan;

function pluginFake(id: string, fatia: Record<string, unknown>, lanca = false): PluginScanner {
  return {
    id,
    nome: id,
    descricao: "",
    coletar: async () => {
      if (lanca) throw new Error("falhou");
      return fatia;
    },
  };
}

describe("registro de plugins", () => {
  beforeEach(() => limparRegistro());

  it("registra e lista plugins", () => {
    registrarPlugin(pluginFake("https", { https: { habilitado: true } }));
    expect(idsPlugins()).toEqual(["https"]);
    expect(listarPlugins()).toHaveLength(1);
  });

  it("executarPlugins mescla as fatias dos ativos sobre o RESULTADO_VAZIO", async () => {
    registrarPlugin(pluginFake("https", { https: { habilitado: true } }));
    registrarPlugin(pluginFake("cookies", { cookies: [{ nome: "sid", secure: true, httpOnly: true, sameSite: "Lax" }] }));
    const r = await executarPlugins(ctx, new Set(["https", "cookies"]));
    expect(r.https.habilitado).toBe(true);
    expect(r.cookies).toHaveLength(1);
    expect(r.headers).toEqual(RESULTADO_VAZIO.headers);
  });

  it("ignora plugins inativos (ficam no default)", async () => {
    registrarPlugin(pluginFake("https", { https: { habilitado: true } }));
    const r = await executarPlugins(ctx, new Set());
    expect(r.https.habilitado).toBe(false);
  });

  it("plugin que lança não derruba o scan (fatia default)", async () => {
    registrarPlugin(pluginFake("https", { https: { habilitado: true } }, true));
    registrarPlugin(pluginFake("cookies", { cookies: [] }));
    const r = await executarPlugins(ctx, new Set(["https", "cookies"]));
    expect(r.https.habilitado).toBe(false);
    expect(r.cookies).toEqual([]);
  });
});
