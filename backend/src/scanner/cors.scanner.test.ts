import { describe, it, expect } from "vitest";
import { extrairCors } from "./cors.scanner";

function h(map: Record<string, string>): Headers {
  return new Headers(map);
}

describe("extrairCors", () => {
  it("retorna null/false quando não há cabeçalhos CORS", () => {
    const c = extrairCors(h({}));
    expect(c.accessControlAllowOrigin).toBeNull();
    expect(c.accessControlAllowCredentials).toBe(false);
  });

  it("lê Access-Control-Allow-Origin", () => {
    const c = extrairCors(h({ "access-control-allow-origin": "*" }));
    expect(c.accessControlAllowOrigin).toBe("*");
  });

  it("interpreta Allow-Credentials true (case-insensitive)", () => {
    const c = extrairCors(h({ "access-control-allow-credentials": "TRUE" }));
    expect(c.accessControlAllowCredentials).toBe(true);
  });

  it("Allow-Credentials diferente de true é false", () => {
    const c = extrairCors(h({ "access-control-allow-credentials": "false" }));
    expect(c.accessControlAllowCredentials).toBe(false);
  });
});
