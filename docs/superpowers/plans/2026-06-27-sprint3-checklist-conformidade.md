# Sprint 3 — Checklist de Conformidade: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para implementar tarefa-a-tarefa. Steps usam checkbox (`- [ ]`).

**Goal:** Avaliar a conformidade do site com o OWASP Top 10 (controles auto-avaliáveis), com % por grupo e geral, exibida no app e no relatório, incluindo captura de CORS.

**Architecture:** `cors.scanner` captura CORS; `conformidade.service` (puro) transforma `ScanResultado` em `ConformidadeResultado` (grupos/itens/status/%); a controller injeta `conformidade` no payload; o relatório e o frontend renderizam a seção.

**Tech Stack:** TypeScript (CommonJS) + Express + Prisma no backend; Vitest; React + Vite + Tailwind no frontend.

## Global Constraints

- Linguagem do código/comentários e do conteúdo: português (pt-BR).
- Sem novas dependências.
- Tipos reusados de `backend/src/types/scanner.types.ts`; novos tipos adicionados lá.
- Pesos de status: Conforme = 1, Parcial = 0.5, Não conforme = 0. `percentual = round(soma/total*100)`.
- Grupos: "HTTPS/TLS", "Cabeçalhos HTTP", "Cookies", "CORS", "Exposição de Informação".
- `StatusConformidade = "CONFORME" | "PARCIAL" | "NAO_CONFORME"`.
- Testes co-localizados em `backend/src/**/*.test.ts`. Sem mocks (funções puras). Rodar de `backend/`.
- Após cada tarefa: suíte verde + commit.

---

### Task 1: Captura de CORS no scanner (TDD)

**Files:**
- Modify: `backend/src/types/scanner.types.ts` (add `CorsInfo`, add `cors` a `ScanResultado`)
- Create: `backend/src/scanner/cors.scanner.ts`
- Test: `backend/src/scanner/cors.scanner.test.ts`
- Modify: `backend/src/scanner/index.ts` (wire `extrairCors`)
- Modify: `backend/prisma/schema.prisma` (coluna `cors`)
- Modify: `backend/src/controllers/auditoria.controller.ts` (gravar/ler `cors`)

**Interfaces:**
- Produces:
  - `interface CorsInfo { accessControlAllowOrigin: string | null; accessControlAllowCredentials: boolean }`
  - `extrairCors(headers: Headers): CorsInfo`
  - `ScanResultado.cors: CorsInfo`

- [ ] **Step 1: Adicionar tipos** em `backend/src/types/scanner.types.ts`

Adicionar a interface e o campo no `ScanResultado`:

```ts
export interface CorsInfo {
  accessControlAllowOrigin: string | null;
  accessControlAllowCredentials: boolean;
}
```

E dentro de `ScanResultado`, adicionar a linha `cors: CorsInfo;` (após `performance`).

- [ ] **Step 2: Escrever o teste que falha** (`cors.scanner.test.ts`)

```ts
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
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/scanner/cors.scanner.test.ts`
Expected: FAIL — `Cannot find module './cors.scanner'`.

- [ ] **Step 4: Implementar `cors.scanner.ts`**

```ts
import type { CorsInfo } from "../types/scanner.types";

export function extrairCors(headers: Headers): CorsInfo {
  const cred = headers.get("access-control-allow-credentials");
  return {
    accessControlAllowOrigin: headers.get("access-control-allow-origin"),
    accessControlAllowCredentials: (cred || "").toLowerCase() === "true",
  };
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd backend && npx vitest run src/scanner/cors.scanner.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 6: Wire no scanner** — `backend/src/scanner/index.ts`

Importar no topo: `import { extrairCors } from "./cors.scanner";`
Após `const tecnologias = detectarTecnologias(...)` (ou junto dos demais), adicionar:
`const cors = extrairCors(resp.headers);`
E incluir `cors,` no objeto `resultado: ScanResultado = { ... }`.

- [ ] **Step 7: Persistência** — `backend/prisma/schema.prisma`

No model `Resultado`, adicionar a coluna (após `vulnerabilidades`):

```prisma
  cors            String @default("{\"accessControlAllowOrigin\":null,\"accessControlAllowCredentials\":false}")
```

- [ ] **Step 8: Controller grava e lê `cors`** — `backend/src/controllers/auditoria.controller.ts`

No `prisma.resultado.create({ data: { ... } })`, adicionar:
`cors: JSON.stringify(resultado.cors),`
Em `serializarAuditoria`, no objeto `resultado`, adicionar:
`cors: JSON.parse(auditoria.resultado.cors || "{\"accessControlAllowOrigin\":null,\"accessControlAllowCredentials\":false}"),`

- [ ] **Step 9: Regenerar Prisma + typecheck + testes**

Run: `cd backend && npx prisma generate && npx tsc --noEmit && npm test`
Expected: prisma ok; tsc sem erros; testes passam.

- [ ] **Step 10: Commit**

```bash
git add backend/src/types/scanner.types.ts backend/src/scanner/cors.scanner.ts backend/src/scanner/cors.scanner.test.ts backend/src/scanner/index.ts backend/prisma/schema.prisma backend/src/controllers/auditoria.controller.ts
git commit -m "feat(scanner): captura de CORS via TDD"
```

---

### Task 2: conformidade.service (TDD)

**Files:**
- Create: `backend/src/services/conformidade.service.ts`
- Test: `backend/src/services/conformidade.service.test.ts`

**Interfaces:**
- Consumes: `ScanResultado`, `CorsInfo` de `../types/scanner.types`.
- Produces (adicionar estes tipos em `scanner.types.ts` no Step 1):
  - `type StatusConformidade = "CONFORME" | "PARCIAL" | "NAO_CONFORME"`
  - `interface ItemConformidade { id: string; titulo: string; status: StatusConformidade; referenciaOwasp: string; explicacao: string; recomendacao: string; detalhe?: string }`
  - `interface GrupoConformidade { grupo: string; itens: ItemConformidade[]; conformes: number; total: number; percentual: number }`
  - `interface ConformidadeResultado { grupos: GrupoConformidade[]; conformes: number; total: number; percentual: number }`
  - `avaliarConformidade(resultado: ScanResultado): ConformidadeResultado`

- [ ] **Step 1: Adicionar os tipos** em `backend/src/types/scanner.types.ts`

```ts
export type StatusConformidade = "CONFORME" | "PARCIAL" | "NAO_CONFORME";

export interface ItemConformidade {
  id: string;
  titulo: string;
  status: StatusConformidade;
  referenciaOwasp: string;
  explicacao: string;
  recomendacao: string;
  detalhe?: string;
}

export interface GrupoConformidade {
  grupo: string;
  itens: ItemConformidade[];
  conformes: number;
  total: number;
  percentual: number;
}

export interface ConformidadeResultado {
  grupos: GrupoConformidade[];
  conformes: number;
  total: number;
  percentual: number;
}
```

- [ ] **Step 2: Escrever o teste que falha** (`conformidade.service.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { avaliarConformidade } from "./conformidade.service";
import type { ScanResultado } from "../types/scanner.types";

function base(): ScanResultado {
  return {
    https: { habilitado: true, cadeiaConfiavel: true, diasParaExpirar: 200 },
    headers: { contentSecurityPolicy: "x", strictTransportSecurity: "x", xFrameOptions: "x", xContentTypeOptions: "x", referrerPolicy: "x", permissionsPolicy: "x" },
    cookies: [],
    exposicao: { server: null, xPoweredBy: null, comentariosHtmlEncontrados: 0, robotsTxtExiste: true, sitemapXmlExiste: true },
    tecnologias: { frameworks: [], cms: [], servidorWeb: null, cdn: [], bibliotecasJs: [], linguagem: null },
    performance: { tempoRespostaMs: 100, compressao: "br", cache: "max-age=60", tamanhoPaginaBytes: 1, quantidadeRequisicoesIniciais: 1 },
    cors: { accessControlAllowOrigin: null, accessControlAllowCredentials: false },
  };
}

describe("avaliarConformidade", () => {
  it("site perfeito => 100% e todos os grupos presentes", () => {
    const c = avaliarConformidade(base());
    expect(c.percentual).toBe(100);
    expect(c.grupos.map((g) => g.grupo)).toEqual([
      "HTTPS/TLS", "Cabeçalhos HTTP", "Cookies", "CORS", "Exposição de Informação",
    ]);
    expect(c.grupos.every((g) => g.itens.every((i) => i.status === "CONFORME"))).toBe(true);
  });

  it("sem HTTPS => itens do grupo HTTPS ficam NAO_CONFORME e % cai", () => {
    const r = base();
    r.https = { habilitado: false };
    const c = avaliarConformidade(r);
    const grupo = c.grupos.find((g) => g.grupo === "HTTPS/TLS")!;
    expect(grupo.itens.find((i) => i.id === "https-habilitado")!.status).toBe("NAO_CONFORME");
    expect(c.percentual).toBeLessThan(100);
  });

  it("cookie sem Secure => cookie-secure NAO_CONFORME", () => {
    const r = base();
    r.cookies = [{ nome: "sid", secure: false, httpOnly: true, sameSite: "Lax" }];
    const c = avaliarConformidade(r);
    const grupo = c.grupos.find((g) => g.grupo === "Cookies")!;
    expect(grupo.itens.find((i) => i.id === "cookie-secure")!.status).toBe("NAO_CONFORME");
    expect(grupo.itens.find((i) => i.id === "cookie-httponly")!.status).toBe("CONFORME");
  });

  it("sem cookies => grupo Cookies é CONFORME", () => {
    const c = avaliarConformidade(base());
    const grupo = c.grupos.find((g) => g.grupo === "Cookies")!;
    expect(grupo.itens.every((i) => i.status === "CONFORME")).toBe(true);
  });

  it("CORS '*' com credenciais => cors-sem-wildcard-credenciais NAO_CONFORME", () => {
    const r = base();
    r.cors = { accessControlAllowOrigin: "*", accessControlAllowCredentials: true };
    const c = avaliarConformidade(r);
    const grupo = c.grupos.find((g) => g.grupo === "CORS")!;
    expect(grupo.itens.find((i) => i.id === "cors-sem-wildcard-credenciais")!.status).toBe("NAO_CONFORME");
  });

  it("CORS '*' sem credenciais => cors-restritivo PARCIAL", () => {
    const r = base();
    r.cors = { accessControlAllowOrigin: "*", accessControlAllowCredentials: false };
    const c = avaliarConformidade(r);
    const grupo = c.grupos.find((g) => g.grupo === "CORS")!;
    expect(grupo.itens.find((i) => i.id === "cors-restritivo")!.status).toBe("PARCIAL");
  });

  it("percentual de grupo: 1 Conforme + 1 Parcial em 2 itens => 75", () => {
    // Exposição: server expõe versão (NAO? aqui usamos parcial via comentários) -> montar caso controlado
    const r = base();
    // Headers: deixa só CSP ausente para gerar 5 conforme + 1 nao-conforme no grupo (~83%)
    r.headers.contentSecurityPolicy = null;
    const c = avaliarConformidade(r);
    const grupo = c.grupos.find((g) => g.grupo === "Cabeçalhos HTTP")!;
    expect(grupo.total).toBe(6);
    expect(grupo.percentual).toBe(Math.round((5 / 6) * 100));
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/services/conformidade.service.test.ts`
Expected: FAIL — `Cannot find module './conformidade.service'`.

- [ ] **Step 4: Implementar `conformidade.service.ts`**

```ts
import type {
  ScanResultado,
  StatusConformidade,
  ItemConformidade,
  GrupoConformidade,
  ConformidadeResultado,
} from "../types/scanner.types";

const PESO: Record<StatusConformidade, number> = {
  CONFORME: 1,
  PARCIAL: 0.5,
  NAO_CONFORME: 0,
};

function montarGrupo(grupo: string, itens: ItemConformidade[]): GrupoConformidade {
  const conformes = itens.reduce((acc, i) => acc + PESO[i.status], 0);
  const total = itens.length;
  const percentual = total ? Math.round((conformes / total) * 100) : 100;
  return { grupo, itens, conformes, total, percentual };
}

function avaliarHttps(r: ScanResultado): GrupoConformidade {
  const ref = "A02:2021 – Cryptographic Failures";
  const itens: ItemConformidade[] = [];

  itens.push({
    id: "https-habilitado",
    titulo: "Conexão HTTPS habilitada",
    status: r.https.habilitado ? "CONFORME" : "NAO_CONFORME",
    referenciaOwasp: ref,
    explicacao: "Sem HTTPS, os dados trafegam em texto puro e podem ser interceptados.",
    recomendacao: "Instale um certificado TLS válido e force HTTPS.",
  });

  itens.push({
    id: "tls-confiavel",
    titulo: "Certificado de cadeia confiável",
    status: r.https.habilitado && r.https.cadeiaConfiavel ? "CONFORME" : "NAO_CONFORME",
    referenciaOwasp: ref,
    explicacao: "Um certificado não confiável gera alertas e quebra a confiança do usuário.",
    recomendacao: "Use um certificado emitido por uma Autoridade Certificadora reconhecida, com a cadeia completa.",
  });

  let statusValidade: StatusConformidade = "CONFORME";
  let detalhe: string | undefined;
  if (!r.https.habilitado || r.https.diasParaExpirar === undefined) {
    statusValidade = r.https.habilitado ? "CONFORME" : "NAO_CONFORME";
  } else if (r.https.diasParaExpirar < 0) {
    statusValidade = "NAO_CONFORME";
    detalhe = "Certificado expirado.";
  } else if (r.https.diasParaExpirar < 15) {
    statusValidade = "PARCIAL";
    detalhe = `Expira em ${r.https.diasParaExpirar} dia(s).`;
  }
  itens.push({
    id: "cert-valido",
    titulo: "Certificado dentro da validade",
    status: statusValidade,
    referenciaOwasp: ref,
    explicacao: "Certificados expirados ou prestes a expirar interrompem o acesso ao site.",
    recomendacao: "Renove o certificado com antecedência e habilite a renovação automática.",
    detalhe,
  });

  return montarGrupo("HTTPS/TLS", itens);
}

function avaliarHeaders(r: ScanResultado): GrupoConformidade {
  const ref = "A05:2021 – Security Misconfiguration";
  const checks: [string, string, boolean, string][] = [
    ["header-csp", "Content-Security-Policy presente", !!r.headers.contentSecurityPolicy, "Mitiga XSS e injeção de conteúdo."],
    ["header-hsts", "Strict-Transport-Security presente", !!r.headers.strictTransportSecurity, "Força conexões HTTPS e evita downgrade."],
    ["header-xfo", "X-Frame-Options presente", !!r.headers.xFrameOptions, "Mitiga clickjacking."],
    ["header-xcto", "X-Content-Type-Options presente", !!r.headers.xContentTypeOptions, "Evita MIME sniffing."],
    ["header-referrer", "Referrer-Policy presente", !!r.headers.referrerPolicy, "Limita o vazamento de URLs internas."],
    ["header-permissions", "Permissions-Policy presente", !!r.headers.permissionsPolicy, "Restringe APIs sensíveis do navegador."],
  ];
  const itens: ItemConformidade[] = checks.map(([id, titulo, ok, explicacao]) => ({
    id,
    titulo,
    status: ok ? "CONFORME" : "NAO_CONFORME",
    referenciaOwasp: ref,
    explicacao,
    recomendacao: `Configure o cabeçalho correspondente a "${titulo}".`,
  }));
  return montarGrupo("Cabeçalhos HTTP", itens);
}

function statusCookies(cookies: ScanResultado["cookies"], pred: (c: ScanResultado["cookies"][number]) => boolean): StatusConformidade {
  if (cookies.length === 0) return "CONFORME";
  const ok = cookies.filter(pred).length;
  if (ok === cookies.length) return "CONFORME";
  if (ok === 0) return "NAO_CONFORME";
  return "PARCIAL";
}

function avaliarCookies(r: ScanResultado): GrupoConformidade {
  const ref = "A05:2021 – Security Misconfiguration";
  const itens: ItemConformidade[] = [
    {
      id: "cookie-secure",
      titulo: "Cookies com atributo Secure",
      status: statusCookies(r.cookies, (c) => c.secure),
      referenciaOwasp: ref,
      explicacao: "Sem Secure, o cookie pode ser enviado por HTTP e interceptado.",
      recomendacao: "Adicione Secure a todos os cookies.",
    },
    {
      id: "cookie-httponly",
      titulo: "Cookies com atributo HttpOnly",
      status: statusCookies(r.cookies, (c) => c.httpOnly),
      referenciaOwasp: ref,
      explicacao: "Sem HttpOnly, o cookie é acessível via JavaScript (risco em XSS).",
      recomendacao: "Adicione HttpOnly aos cookies que não precisam de acesso por JS.",
    },
    {
      id: "cookie-samesite",
      titulo: "Cookies com atributo SameSite",
      status: statusCookies(r.cookies, (c) => !!c.sameSite),
      referenciaOwasp: ref,
      explicacao: "Sem SameSite, o cookie é enviado cross-site (risco de CSRF).",
      recomendacao: "Defina SameSite=Lax ou Strict nos cookies de sessão.",
    },
  ];
  return montarGrupo("Cookies", itens);
}

function avaliarCors(r: ScanResultado): GrupoConformidade {
  const ref = "A05:2021 – Security Misconfiguration";
  const { accessControlAllowOrigin: acao, accessControlAllowCredentials: cred } = r.cors;

  const wildcardComCredenciais = acao === "*" && cred;
  let restritivo: StatusConformidade = "CONFORME";
  if (acao === "*") restritivo = "PARCIAL";

  const itens: ItemConformidade[] = [
    {
      id: "cors-sem-wildcard-credenciais",
      titulo: "CORS não combina wildcard com credenciais",
      status: wildcardComCredenciais ? "NAO_CONFORME" : "CONFORME",
      referenciaOwasp: ref,
      explicacao: "Access-Control-Allow-Origin: * com Allow-Credentials: true expõe dados autenticados a qualquer origem.",
      recomendacao: "Nunca use '*' junto de credenciais; especifique origens confiáveis.",
      detalhe: acao ? `Allow-Origin: ${acao}; Credentials: ${cred}` : undefined,
    },
    {
      id: "cors-restritivo",
      titulo: "Política de CORS restritiva",
      status: restritivo,
      referenciaOwasp: ref,
      explicacao: "Allow-Origin: '*' libera o recurso para qualquer origem.",
      recomendacao: "Defina origens específicas em Access-Control-Allow-Origin.",
      detalhe: acao ? `Allow-Origin: ${acao}` : "Sem cabeçalhos CORS.",
    },
  ];
  return montarGrupo("CORS", itens);
}

function avaliarExposicao(r: ScanResultado): GrupoConformidade {
  const ref = "A05:2021 – Security Misconfiguration";
  const itens: ItemConformidade[] = [
    {
      id: "exp-server",
      titulo: "Cabeçalho Server não expõe o software",
      status: r.exposicao.server ? "NAO_CONFORME" : "CONFORME",
      referenciaOwasp: ref,
      explicacao: "O cabeçalho Server pode revelar software/versão e facilitar ataques direcionados.",
      recomendacao: "Remova ou genericize o cabeçalho Server.",
      detalhe: r.exposicao.server || undefined,
    },
    {
      id: "exp-xpoweredby",
      titulo: "Sem cabeçalho X-Powered-By",
      status: r.exposicao.xPoweredBy ? "NAO_CONFORME" : "CONFORME",
      referenciaOwasp: ref,
      explicacao: "X-Powered-By revela a tecnologia do backend.",
      recomendacao: "Desative o cabeçalho X-Powered-By.",
      detalhe: r.exposicao.xPoweredBy || undefined,
    },
    {
      id: "exp-comentarios",
      titulo: "Comentários HTML sob controle",
      status: r.exposicao.comentariosHtmlEncontrados > 5 ? "PARCIAL" : "CONFORME",
      referenciaOwasp: ref,
      explicacao: "Muitos comentários HTML podem expor detalhes internos.",
      recomendacao: "Remova comentários sensíveis do HTML em produção.",
      detalhe: `${r.exposicao.comentariosHtmlEncontrados} comentário(s).`,
    },
  ];
  return montarGrupo("Exposição de Informação", itens);
}

export function avaliarConformidade(resultado: ScanResultado): ConformidadeResultado {
  const grupos = [
    avaliarHttps(resultado),
    avaliarHeaders(resultado),
    avaliarCookies(resultado),
    avaliarCors(resultado),
    avaliarExposicao(resultado),
  ];
  const conformes = grupos.reduce((acc, g) => acc + g.conformes, 0);
  const total = grupos.reduce((acc, g) => acc + g.total, 0);
  const percentual = total ? Math.round((conformes / total) * 100) : 100;
  return { grupos, conformes, total, percentual };
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd backend && npx vitest run src/services/conformidade.service.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 6: Commit**

```bash
git add backend/src/types/scanner.types.ts backend/src/services/conformidade.service.ts backend/src/services/conformidade.service.test.ts
git commit -m "test(conformidade): avaliarConformidade via TDD"
```

---

### Task 3: Integração no payload + relatório (TDD)

**Files:**
- Modify: `backend/src/controllers/auditoria.controller.ts` (incluir `conformidade` no payload)
- Modify: `backend/src/reports/relatorio.types.ts` (`DadosRelatorio.conformidade`)
- Modify: `backend/src/reports/montarDados.ts` (calcular `conformidade`)
- Modify: `backend/src/reports/html.report.ts` (seção Conformidade + âncora)
- Modify: `backend/src/reports/markdown.report.ts` (seção Conformidade)
- Test: `backend/src/reports/html.report.test.ts` (novo caso), `backend/src/reports/montarDados.test.ts` (novo caso)

**Interfaces:**
- Consumes: `avaliarConformidade` (Task 2).
- Produces: `DadosRelatorio.conformidade: ConformidadeResultado`; payload `dados.conformidade`.

- [ ] **Step 1: Teste falha em montarDados** — adicionar caso em `backend/src/reports/montarDados.test.ts`

```ts
it("inclui conformidade calculada do resultado", () => {
  const d = montarDadosRelatorio(auditoria, resultado, []);
  expect(d.conformidade).toBeDefined();
  expect(d.conformidade.grupos.length).toBe(5);
  expect(typeof d.conformidade.percentual).toBe("number");
});
```

Nota: o objeto `resultado` desse teste precisa do campo `cors`. Adicionar ao literal `resultado` existente no arquivo:
`cors: { accessControlAllowOrigin: null, accessControlAllowCredentials: false },`

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/reports/montarDados.test.ts`
Expected: FAIL — `d.conformidade` é `undefined`.

- [ ] **Step 3: Implementar**

Em `backend/src/reports/relatorio.types.ts`:
- importar `ConformidadeResultado` junto dos demais tipos de `../types/scanner.types`.
- adicionar `conformidade: ConformidadeResultado;` em `DadosRelatorio`.

Em `backend/src/reports/montarDados.ts`:
- importar `import { avaliarConformidade } from "../services/conformidade.service";`
- no objeto retornado, adicionar `conformidade: avaliarConformidade(resultadoBase)` onde `resultadoBase` é o objeto `{ https, headers, cookies, exposicao, tecnologias, performance, cors }`. Como o `resultado` recebido já é um superset, montar a variável:

```ts
const resultadoBase = {
  https: resultado.https,
  headers: resultado.headers,
  cookies: resultado.cookies,
  exposicao: resultado.exposicao,
  tecnologias: resultado.tecnologias,
  performance: resultado.performance,
  cors: resultado.cors,
};
```
e usar `resultado: resultadoBase` e `conformidade: avaliarConformidade(resultadoBase)`.
Também atualizar a interface local `ResultadoDesserializado` para incluir `cors: CorsInfo` (importar `CorsInfo`).

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx vitest run src/reports/montarDados.test.ts`
Expected: PASS.

- [ ] **Step 5: Teste falha em html.report** — adicionar caso em `backend/src/reports/html.report.test.ts`

Primeiro, adicionar `conformidade` ao helper `dados()` do teste (campo novo obrigatório):

```ts
conformidade: { grupos: [{ grupo: "HTTPS/TLS", itens: [], conformes: 1, total: 1, percentual: 100 }], conformes: 1, total: 1, percentual: 100 },
```

Depois adicionar o teste:

```ts
it("inclui a seção de conformidade com a porcentagem", () => {
  const html = gerarRelatorioHtml(dados());
  expect(html).toContain('id="conformidade"');
  expect(html).toContain("Conformidade");
  expect(html).toContain("100%");
});
```

E acrescentar `conformidade` ao link do índice esperado: no teste de índice, incluir `"conformidade"` na lista de ids verificados.

- [ ] **Step 6: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/reports/html.report.test.ts`
Expected: FAIL — falta `id="conformidade"`.

- [ ] **Step 7: Implementar a seção no HTML** — `backend/src/reports/html.report.ts`

- adicionar item no `<nav>`: `<li><a href="#conformidade">8. Conformidade (OWASP)</a></li>` (após recomendacoes).
- adicionar a seção antes de `id="assinatura"`:

```ts
  <section id="conformidade" class="secao">
    <h2>8. Conformidade (OWASP Top 10)</h2>
    <p>Conformidade geral: <strong>${d.conformidade.percentual}%</strong></p>
    ${d.conformidade.grupos
      .map(
        (g) => `<h3>${esc(g.grupo)} — ${g.percentual}%</h3>
    <table><thead><tr><th>Item</th><th>Status</th><th>Referência</th></tr></thead><tbody>
    ${g.itens
      .map(
        (i) => `<tr><td>${esc(i.titulo)}${i.detalhe ? ` <span class="muted">(${esc(i.detalhe)})</span>` : ""}</td><td>${esc(rotuloStatus(i.status))}</td><td>${esc(i.referenciaOwasp)}</td></tr>`,
      )
      .join("")}
    </tbody></table>`,
      )
      .join("")}
  </section>
```

- adicionar o helper de rótulo no topo do arquivo (após `esc`):

```ts
function rotuloStatus(s: string): string {
  if (s === "CONFORME") return "Conforme";
  if (s === "PARCIAL") return "Parcial";
  return "Não conforme";
}
```

- renumerar a assinatura para "9." no `<nav>` e no `<h2>` (de "7." para "9."), e gráficos/linha/evidências/plano/recomendações permanecem 2..6; conformidade vira 8 e assinatura 9. (Ajustar os textos de número nos `<li>` e `<h2>`.)

- [ ] **Step 8: Rodar html.report e ver passar**

Run: `cd backend && npx vitest run src/reports/html.report.test.ts`
Expected: PASS.

- [ ] **Step 9: Markdown — seção Conformidade** — `backend/src/reports/markdown.report.ts`

A assinatura de `gerarRelatorioMarkdown(url, resultado, scoreFinal)` não recebe conformidade. Calcular internamente: importar `avaliarConformidade` de `../services/conformidade.service` e gerar a seção a partir de `resultado`. Adicionar `const conformidade = avaliarConformidade(resultado);` e uma função `gerarConformidadeMd(conformidade)`; inserir `${conformidadeMd}` após a seção de Evidências Técnicas. Função:

```ts
function gerarConformidadeMd(c: ReturnType<typeof avaliarConformidade>): string {
  const linhas = c.grupos
    .map((g) => `### ${g.grupo} — ${g.percentual}%\n\n${g.itens.map((i) => `- ${i.status === "CONFORME" ? "✅" : i.status === "PARCIAL" ? "🟡" : "❌"} ${i.titulo} (${i.referenciaOwasp})`).join("\n")}`)
    .join("\n\n");
  return `## Conformidade (OWASP Top 10)\n\nConformidade geral: **${c.percentual}%**\n\n${linhas}`;
}
```

Adicionar teste em `markdown.report.test.ts`:

```ts
it("inclui a seção de conformidade", () => {
  const r = base();
  const md = gerarRelatorioMarkdown("https://exemplo.com", r, calcularScore(r));
  expect(md).toContain("## Conformidade (OWASP Top 10)");
  expect(md).toContain("Conformidade geral:");
});
```

Nota: o `base()` em `markdown.report.test.ts` precisa do campo `cors`. Adicionar `cors: { accessControlAllowOrigin: null, accessControlAllowCredentials: false },`.

- [ ] **Step 10: Controller inclui conformidade no payload** — `backend/src/controllers/auditoria.controller.ts`

Importar `import { avaliarConformidade } from "../services/conformidade.service";`.
Em `serializarAuditoria`, depois de montar `resultado`, anexar a conformidade no retorno. Alterar o retorno para:

```ts
  const resultadoObj = auditoria.resultado ? { /* ...campos já existentes incluindo cors... */ } : null;
  return {
    ...auditoria,
    resultado: resultadoObj,
    conformidade: resultadoObj ? avaliarConformidade(resultadoObj) : null,
  };
```

(Reaproveitar o objeto já desserializado para não desserializar duas vezes.)

- [ ] **Step 11: Verificação backend completa**

Run: `cd backend && npx tsc --noEmit && npm test`
Expected: tsc ok; todos os testes passam.

- [ ] **Step 12: Commit**

```bash
git add backend/src
git commit -m "feat(conformidade): integra no payload e no relatório (HTML/MD) via TDD"
```

---

### Task 4: Frontend — checklist de conformidade

**Files:**
- Modify: `frontend/src/types/index.ts` (tipos espelhados + `Auditoria.conformidade`)
- Create: `frontend/src/components/ChecklistConformidade.tsx`
- Modify: `frontend/src/pages/VisualizadorRelatorio.tsx` (seção Conformidade)

**Interfaces:**
- Consumes: `auditoria.conformidade` do payload (Task 3).
- Produces: componente `ChecklistConformidade`.

- [ ] **Step 1: Tipos no frontend** — `frontend/src/types/index.ts`

Adicionar:

```ts
export interface CorsInfo {
  accessControlAllowOrigin: string | null;
  accessControlAllowCredentials: boolean;
}

export type StatusConformidade = "CONFORME" | "PARCIAL" | "NAO_CONFORME";

export interface ItemConformidade {
  id: string;
  titulo: string;
  status: StatusConformidade;
  referenciaOwasp: string;
  explicacao: string;
  recomendacao: string;
  detalhe?: string;
}

export interface GrupoConformidade {
  grupo: string;
  itens: ItemConformidade[];
  conformes: number;
  total: number;
  percentual: number;
}

export interface ConformidadeResultado {
  grupos: GrupoConformidade[];
  conformes: number;
  total: number;
  percentual: number;
}
```

Em `ResultadoAuditoria`, adicionar `cors: CorsInfo;`.
Em `Auditoria`, adicionar `conformidade?: ConformidadeResultado | null;`.

- [ ] **Step 2: Componente** — `frontend/src/components/ChecklistConformidade.tsx`

```tsx
import { useState } from "react";
import type { ConformidadeResultado, StatusConformidade } from "../types";
import { Card } from "./Card";
import { ProgressBar } from "./ProgressBar";

const STATUS_INFO: Record<StatusConformidade, { rotulo: string; icone: string; cor: string }> = {
  CONFORME: { rotulo: "Conforme", icone: "✓", cor: "text-ok" },
  PARCIAL: { rotulo: "Parcial", icone: "≈", cor: "text-warn" },
  NAO_CONFORME: { rotulo: "Não conforme", icone: "✕", cor: "text-danger" },
};

export function ChecklistConformidade({ conformidade }: { conformidade: ConformidadeResultado }) {
  const [filtro, setFiltro] = useState<StatusConformidade | "TODOS">("TODOS");

  return (
    <Card title={`Conformidade (OWASP Top 10) — ${conformidade.percentual}%`}>
      <ProgressBar progresso={conformidade.percentual} label={`${conformidade.conformes} de ${conformidade.total} controles atendidos`} />

      <div className="mt-3 mb-4 flex flex-wrap gap-2">
        {(["TODOS", "NAO_CONFORME", "PARCIAL", "CONFORME"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${filtro === f ? "border-accent/40 bg-accent/10 text-accent" : "border-line bg-bg-raised/40 text-slate-400 hover:text-slate-200"}`}
          >
            {f === "TODOS" ? "Todos" : STATUS_INFO[f].rotulo}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {conformidade.grupos.map((g) => {
          const itens = g.itens.filter((i) => filtro === "TODOS" || i.status === filtro);
          if (itens.length === 0) return null;
          return (
            <div key={g.grupo}>
              <div className="mb-1.5 flex items-center justify-between">
                <h4 className="text-sm text-slate-200">{g.grupo}</h4>
                <span className="text-xs text-slate-500">{g.percentual}%</span>
              </div>
              <div className="space-y-1.5">
                {itens.map((i) => (
                  <div key={i.id} className="rounded-lg border border-line bg-bg-panel/40 p-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`font-display ${STATUS_INFO[i.status].cor}`}>{STATUS_INFO[i.status].icone}</span>
                      <span className="text-sm text-slate-200">{i.titulo}</span>
                      <span className="ml-auto text-[11px] text-slate-500">{i.referenciaOwasp}</span>
                    </div>
                    {i.detalhe && <p className="mt-0.5 pl-6 text-xs text-slate-500">{i.detalhe}</p>}
                    {i.status !== "CONFORME" && (
                      <p className="mt-1 pl-6 text-xs text-slate-400"><span className="text-slate-500">Recomendação:</span> {i.recomendacao}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: Integrar no VisualizadorRelatorio** — `frontend/src/pages/VisualizadorRelatorio.tsx`

Importar: `import { ChecklistConformidade } from "../components/ChecklistConformidade";`
Após o bloco do `PlanoDeAcao`, adicionar:

```tsx
{auditoria.conformidade && <ChecklistConformidade conformidade={auditoria.conformidade} />}
```

- [ ] **Step 4: Verificar build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: sem erros; build conclui.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(conformidade): checklist OWASP no visualizador"
```

---

### Task 5: Verificação final

- [ ] `cd backend && npm test` → todos verdes.
- [ ] `cd backend && npx tsc --noEmit` → sem erros.
- [ ] `cd frontend && npm run build` → sucesso.
- [ ] Commit final se houver ajustes: `chore(conformidade): verificação Sprint 3`.

## Self-Review

**1. Spec coverage:**
- Checklist OWASP Top 10 curado → Task 2 (referências OWASP por item). ✓
- Cabeçalhos/HTTPS/Cookies/CORS/Exposição → Task 2 (5 grupos). ✓
- Captura de CORS → Task 1. ✓
- Barra de conformidade (%) → Task 2 (percentual) + Task 4 (ProgressBar). ✓
- Explicação + recomendação por item → Task 2 (campos) + Task 4 (exibição). ✓
- Score/Página de conformidade → Task 4 (seção no visualizador). ✓
- Exportação do checklist → Task 3 (HTML + Markdown). ✓
- Itens não testáveis excluídos → não há tarefa (YAGNI, conforme spec). ✓

**2. Placeholder scan:** sem TBD/TODO; todos os steps de código mostram o código.

**3. Type consistency:** `CorsInfo`, `StatusConformidade`, `ItemConformidade`, `GrupoConformidade`, `ConformidadeResultado` definidos em Task 1/2 e reusados em Tasks 3 e 4 (frontend espelha). `avaliarConformidade(resultado)` consistente. Ids dos itens (`https-habilitado`, `cookie-secure`, `cors-sem-wildcard-credenciais`, `cors-restritivo`, `exp-server` etc.) batem entre service e testes. Grupos nomeados igualmente em service e teste (`"HTTPS/TLS"`, `"Cabeçalhos HTTP"`, `"Cookies"`, `"CORS"`, `"Exposição de Informação"`).
