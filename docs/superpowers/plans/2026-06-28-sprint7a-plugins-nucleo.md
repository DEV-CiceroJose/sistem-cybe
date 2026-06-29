# Sprint 7A — Núcleo de Plugins: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps usam checkbox (`- [ ]`).

**Goal:** Reestruturar a coleta do scanner como plugins embutidos auto-registrados, com registro central e ativar/desativar via Configuracao, preservando o formato de ScanResultado e todo o comportamento.

**Architecture:** Um registro de `PluginScanner` recebe um `ContextoScan` (montado pelo scanner após o fetch único) e cada plugin devolve sua fatia de ScanResultado; `executarPlugins` mescla as fatias dos plugins ativos sobre um `RESULTADO_VAZIO`.

**Tech Stack:** TypeScript (CommonJS), Express, Prisma, Vitest.

## Global Constraints

- Linguagem: pt-BR. Sem novas dependências. Sem mudança no formato de `ScanResultado`.
- ids dos plugins: `https`, `headers`, `cookies`, `exposicao`, `tecnologias`, `performance`, `cors`, `dns`.
- Ativo por padrão; desativa só com `Configuracao` `plugin.<id>.ativo` == `"false"`.
- Testes co-localizados; rodar de `backend/`. Após cada tarefa: suíte verde + commit.

---

### Task 1: tipos + registro (TDD)

**Files:**
- Create: `backend/src/plugins/tipos.ts`
- Create: `backend/src/plugins/registro.ts`
- Test: `backend/src/plugins/registro.test.ts`

**Interfaces:**
- Produces:
  - `interface ContextoScan { urlFinal: string; hostname: string; headers: Headers; html: string; tempoRespostaMs: number; setCookieRaw: string[]; robotsTxtExiste: boolean; sitemapXmlExiste: boolean }`
  - `interface PluginScanner { id: string; nome: string; descricao: string; coletar(ctx: ContextoScan): Promise<Partial<ScanResultado>> }`
  - `registrarPlugin(p)`, `listarPlugins()`, `idsPlugins()`, `limparRegistro()`, `RESULTADO_VAZIO`, `executarPlugins(ctx, idsAtivos): Promise<ScanResultado>`

- [ ] **Step 1: `plugins/tipos.ts`**

```ts
import type { ScanResultado } from "../types/scanner.types";

export interface ContextoScan {
  urlFinal: string;
  hostname: string;
  headers: Headers;
  html: string;
  tempoRespostaMs: number;
  setCookieRaw: string[];
  robotsTxtExiste: boolean;
  sitemapXmlExiste: boolean;
}

export interface PluginScanner {
  id: string;
  nome: string;
  descricao: string;
  coletar(ctx: ContextoScan): Promise<Partial<ScanResultado>>;
}
```

- [ ] **Step 2: Teste que falha** (`registro.test.ts`)

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { registrarPlugin, listarPlugins, idsPlugins, limparRegistro, executarPlugins, RESULTADO_VAZIO } from "./registro";
import type { ContextoScan, PluginScanner } from "./tipos";

const ctx = {} as ContextoScan;

function pluginFake(id: string, fatia: any, lanca = false): PluginScanner {
  return {
    id, nome: id, descricao: "",
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
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/plugins/registro.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 4: `plugins/registro.ts`**

```ts
import type { ScanResultado } from "../types/scanner.types";
import { DNS_VAZIO } from "../scanner/dns.scanner";
import type { ContextoScan, PluginScanner } from "./tipos";

export const RESULTADO_VAZIO: ScanResultado = {
  https: { habilitado: false },
  headers: {
    contentSecurityPolicy: null,
    strictTransportSecurity: null,
    xFrameOptions: null,
    xContentTypeOptions: null,
    referrerPolicy: null,
    permissionsPolicy: null,
  },
  cookies: [],
  exposicao: {
    server: null,
    xPoweredBy: null,
    comentariosHtmlEncontrados: 0,
    robotsTxtExiste: false,
    sitemapXmlExiste: false,
  },
  tecnologias: { frameworks: [], cms: [], servidorWeb: null, cdn: [], bibliotecasJs: [], linguagem: null },
  performance: { tempoRespostaMs: 0, compressao: null, cache: null, tamanhoPaginaBytes: 0, quantidadeRequisicoesIniciais: 0 },
  cors: { accessControlAllowOrigin: null, accessControlAllowCredentials: false },
  dns: DNS_VAZIO,
};

const registro = new Map<string, PluginScanner>();

export function registrarPlugin(p: PluginScanner): void {
  registro.set(p.id, p);
}
export function listarPlugins(): PluginScanner[] {
  return [...registro.values()];
}
export function idsPlugins(): string[] {
  return [...registro.keys()];
}
export function limparRegistro(): void {
  registro.clear();
}

function clonarVazio(): ScanResultado {
  return JSON.parse(JSON.stringify(RESULTADO_VAZIO)) as ScanResultado;
}

export async function executarPlugins(ctx: ContextoScan, idsAtivos: Set<string>): Promise<ScanResultado> {
  const resultado = clonarVazio();
  const ativos = listarPlugins().filter((p) => idsAtivos.has(p.id));
  await Promise.all(
    ativos.map(async (p) => {
      try {
        const fatia = await p.coletar(ctx);
        Object.assign(resultado, fatia);
      } catch (e) {
        console.error(`[plugin:${p.id}]`, (e as Error).message);
      }
    }),
  );
  return resultado;
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd backend && npx vitest run src/plugins/registro.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 6: Commit**

```bash
git add backend/src/plugins/tipos.ts backend/src/plugins/registro.ts backend/src/plugins/registro.test.ts
git commit -m "test(plugins): registro e execução de plugins via TDD"
```

---

### Task 2: plugins.service (TDD)

**Files:**
- Create: `backend/src/services/plugins.service.ts`
- Test: `backend/src/services/plugins.service.test.ts`

**Interfaces:**
- Produces: `lerPluginsAtivos(configs: { chave: string; valor: string }[], todosIds: string[]): Set<string>`

- [ ] **Step 1: Teste que falha** (`plugins.service.test.ts`)

```ts
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
  it("ignora chaves de outros plugins desconhecidos", () => {
    const ativos = lerPluginsAtivos([{ chave: "plugin.inexistente.ativo", valor: "false" }], todos);
    expect(ativos).toEqual(new Set(todos));
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/services/plugins.service.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `plugins.service.ts`**

```ts
/** Calcula o conjunto de plugins ativos: todos por padrão; `plugin.<id>.ativo=false` desativa. */
export function lerPluginsAtivos(
  configs: { chave: string; valor: string }[],
  todosIds: string[],
): Set<string> {
  const inativos = new Set<string>();
  for (const { chave, valor } of configs) {
    const m = chave.match(/^plugin\.(.+)\.ativo$/);
    if (m && valor === "false") inativos.add(m[1]);
  }
  return new Set(todosIds.filter((id) => !inativos.has(id)));
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx vitest run src/services/plugins.service.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/plugins.service.ts backend/src/services/plugins.service.test.ts
git commit -m "test(plugins): lerPluginsAtivos via TDD"
```

---

### Task 3: 8 plugins adapters + auto-registro

**Files:**
- Create: `backend/src/plugins/https.plugin.ts`, `headers.plugin.ts`, `cookies.plugin.ts`, `exposicao.plugin.ts`, `tecnologias.plugin.ts`, `performance.plugin.ts`, `cors.plugin.ts`, `dns.plugin.ts`
- Create: `backend/src/plugins/index.ts`

**Interfaces:**
- Consumes: scanners existentes + `ContextoScan`/`PluginScanner`.
- Produces: cada arquivo exporta um `PluginScanner`; `index.ts` os registra.

- [ ] **Step 1: `https.plugin.ts`**

```ts
import { inspecionarHttps } from "../scanner/https.scanner";
import type { PluginScanner } from "./tipos";

export const httpsPlugin: PluginScanner = {
  id: "https",
  nome: "HTTPS/TLS",
  descricao: "Inspeciona certificado e configuração TLS do host.",
  async coletar(ctx) {
    return { https: await inspecionarHttps(ctx.hostname) };
  },
};
```

- [ ] **Step 2: `headers.plugin.ts`**

```ts
import { extrairHeaders } from "../scanner/headers.scanner";
import type { PluginScanner } from "./tipos";

export const headersPlugin: PluginScanner = {
  id: "headers",
  nome: "Cabeçalhos HTTP",
  descricao: "Verifica os cabeçalhos de segurança da resposta.",
  async coletar(ctx) {
    return { headers: extrairHeaders(ctx.headers) };
  },
};
```

- [ ] **Step 3: `cookies.plugin.ts`**

```ts
import { extrairCookies } from "../scanner/headers.scanner";
import type { PluginScanner } from "./tipos";

export const cookiesPlugin: PluginScanner = {
  id: "cookies",
  nome: "Cookies",
  descricao: "Avalia os atributos de segurança dos cookies.",
  async coletar(ctx) {
    return { cookies: extrairCookies(ctx.setCookieRaw) };
  },
};
```

- [ ] **Step 4: `exposicao.plugin.ts`**

```ts
import { detectarExposicao } from "../scanner/exposicao.scanner";
import type { PluginScanner } from "./tipos";

export const exposicaoPlugin: PluginScanner = {
  id: "exposicao",
  nome: "Informações Expostas",
  descricao: "Detecta exposição de software, comentários e arquivos.",
  async coletar(ctx) {
    const base = detectarExposicao(ctx.headers, ctx.html);
    return {
      exposicao: {
        ...base,
        robotsTxtExiste: ctx.robotsTxtExiste,
        sitemapXmlExiste: ctx.sitemapXmlExiste,
      },
    };
  },
};
```

- [ ] **Step 5: `tecnologias.plugin.ts`**

```ts
import { detectarTecnologias } from "../scanner/tecnologias.scanner";
import type { PluginScanner } from "./tipos";

export const tecnologiasPlugin: PluginScanner = {
  id: "tecnologias",
  nome: "Tecnologias",
  descricao: "Identifica frameworks, CMS, servidor e bibliotecas.",
  async coletar(ctx) {
    return { tecnologias: detectarTecnologias(ctx.html, ctx.headers) };
  },
};
```

- [ ] **Step 6: `performance.plugin.ts`**

```ts
import { medirPerformance } from "../scanner/performance.scanner";
import type { PluginScanner } from "./tipos";

export const performancePlugin: PluginScanner = {
  id: "performance",
  nome: "Performance",
  descricao: "Mede tempo de resposta, compressão e cache.",
  async coletar(ctx) {
    return { performance: medirPerformance(ctx.headers, ctx.html, ctx.tempoRespostaMs) };
  },
};
```

- [ ] **Step 7: `cors.plugin.ts`**

```ts
import { extrairCors } from "../scanner/cors.scanner";
import type { PluginScanner } from "./tipos";

export const corsPlugin: PluginScanner = {
  id: "cors",
  nome: "CORS",
  descricao: "Lê a política de CORS da resposta.",
  async coletar(ctx) {
    return { cors: extrairCors(ctx.headers) };
  },
};
```

- [ ] **Step 8: `dns.plugin.ts`**

```ts
import { consultarDns, DNS_VAZIO } from "../scanner/dns.scanner";
import { analisarEmail } from "../scanner/email.scanner";
import type { DnsInfo } from "../types/scanner.types";
import type { PluginScanner } from "./tipos";

export const dnsPlugin: PluginScanner = {
  id: "dns",
  nome: "DNS & E-mail",
  descricao: "Consulta registros DNS e a segurança de e-mail (SPF/DKIM/DMARC).",
  async coletar(ctx) {
    let dns: DnsInfo;
    try {
      const [base, email] = await Promise.all([consultarDns(ctx.hostname), analisarEmail(ctx.hostname)]);
      dns = { ...base, email };
    } catch (e: any) {
      dns = { ...DNS_VAZIO, erro: e?.message || "Falha ao consultar DNS." };
    }
    return { dns };
  },
};
```

- [ ] **Step 9: `plugins/index.ts` (auto-registro)**

```ts
import { registrarPlugin } from "./registro";
import { httpsPlugin } from "./https.plugin";
import { headersPlugin } from "./headers.plugin";
import { cookiesPlugin } from "./cookies.plugin";
import { exposicaoPlugin } from "./exposicao.plugin";
import { tecnologiasPlugin } from "./tecnologias.plugin";
import { performancePlugin } from "./performance.plugin";
import { corsPlugin } from "./cors.plugin";
import { dnsPlugin } from "./dns.plugin";

let registrado = false;

/** Registra os plugins embutidos uma única vez. */
export function registrarPluginsEmbutidos(): void {
  if (registrado) return;
  [httpsPlugin, headersPlugin, cookiesPlugin, exposicaoPlugin, tecnologiasPlugin, performancePlugin, corsPlugin, dnsPlugin].forEach(registrarPlugin);
  registrado = true;
}
```

- [ ] **Step 10: Verificar tsc + commit**

Run: `cd backend && npx tsc --noEmit && npm test`
Expected: tsc ok; testes passam (os de registro/plugins.service).
```bash
git add backend/src/plugins
git commit -m "feat(plugins): adapters embutidos e auto-registro"
```

---

### Task 4: refator do scanner/index para usar plugins

**Files:**
- Modify: `backend/src/scanner/index.ts`

**Interfaces:**
- Consumes: `registrarPluginsEmbutidos`, `idsPlugins`, `executarPlugins`, `ContextoScan`.
- Produces: `executarScan(rawUrl: string, idsAtivos?: Set<string>): Promise<{ resultado: ScanResultado; urlFinal: string }>`.

- [ ] **Step 1: Reescrever a coleta** — `backend/src/scanner/index.ts`

Manter `buscarComLimite`, SSRF guard e o cálculo de `urlFinal`/`hostnameFinal`/`setCookieRaw`/robots/sitemap. Substituir a coleta manual por:

```ts
import { registrarPluginsEmbutidos } from "../plugins";
import { idsPlugins, executarPlugins } from "../plugins/registro";
import type { ContextoScan } from "../plugins/tipos";
import { verificarArquivo } from "./exposicao.scanner";
// (remover os imports dos scanners individuais que agora vivem nos plugins:
//  inspecionarHttps, extrairHeaders, extrairCookies, detectarExposicao, detectarTecnologias,
//  medirPerformance, extrairCors, consultarDns, DNS_VAZIO, analisarEmail — manter só verificarArquivo)
```

Assinatura e corpo final (após obter `resp, html, tempoRespostaMs`):

```ts
export async function executarScan(
  rawUrl: string,
  idsAtivos?: Set<string>,
): Promise<{ resultado: ScanResultado; urlFinal: string }> {
  // ... (validação SSRF + buscarComLimite inalterados) ...

  const { resp, html, tempoRespostaMs } = fetchResult;
  const urlFinal = resp.url || rawUrl;
  const hostnameFinal = new URL(urlFinal).hostname;
  const setCookieRaw = (resp.headers as any).raw
    ? (resp.headers as any).raw()["set-cookie"] || []
    : resp.headers.get("set-cookie")
      ? [resp.headers.get("set-cookie")!]
      : [];

  const [robotsTxtExiste, sitemapXmlExiste] = await Promise.all([
    verificarArquivo(urlFinal, "/robots.txt", 4000),
    verificarArquivo(urlFinal, "/sitemap.xml", 4000),
  ]);

  registrarPluginsEmbutidos();
  const ctx: ContextoScan = {
    urlFinal,
    hostname: hostnameFinal,
    headers: resp.headers,
    html,
    tempoRespostaMs,
    setCookieRaw,
    robotsTxtExiste,
    sitemapXmlExiste,
  };
  const ativos = idsAtivos ?? new Set(idsPlugins());
  const resultado = await executarPlugins(ctx, ativos);

  return { resultado, urlFinal };
}
```

(Remover o bloco antigo que chamava cada scanner e montava `resultado` manualmente, incluindo o try/catch de DNS — agora dentro do `dnsPlugin`.)

- [ ] **Step 2: Verificar — comportamento idêntico**

Run: `cd backend && npx tsc --noEmit && npm test`
Expected: tsc ok; **todas** as verificações existentes verdes (o scanner não é testado por unidade, mas os imports/tsc e os testes dependentes devem passar).

- [ ] **Step 3: Commit**

```bash
git add backend/src/scanner/index.ts
git commit -m "refactor(scanner): coleta via registro de plugins"
```

---

### Task 5: runner passa plugins ativos

**Files:**
- Modify: `backend/src/services/auditoria.runner.ts`

**Interfaces:**
- Consumes: `lerPluginsAtivos`, `idsPlugins`, `registrarPluginsEmbutidos`, `executarScan`.

- [ ] **Step 1: Ler configs e passar idsAtivos** — `auditoria.runner.ts`

No topo, importar:
```ts
import { lerPluginsAtivos } from "./plugins.service";
import { registrarPluginsEmbutidos } from "../plugins";
import { idsPlugins } from "../plugins/registro";
```
Substituir a chamada `const { resultado, urlFinal } = await executarScan(url);` por:

```ts
registrarPluginsEmbutidos();
const configs = await prisma.configuracao.findMany();
const idsAtivos = lerPluginsAtivos(configs, idsPlugins());
const { resultado, urlFinal } = await executarScan(url, idsAtivos);
```

- [ ] **Step 2: Verificar + commit**

Run: `cd backend && npx tsc --noEmit && npm test`
Expected: tsc ok; testes verdes.
```bash
git add backend/src/services/auditoria.runner.ts
git commit -m "feat(plugins): runner aplica plugins ativos das configurações"
```

---

### Task 6: Verificação final

- [ ] `cd backend && npm test` → todos verdes.
- [ ] `cd backend && npx tsc --noEmit` → sem erros.
- [ ] `cd frontend && npm run build` → sucesso (sem alterações de contrato).
- [ ] Commit final se necessário.

## Self-Review

**1. Spec coverage:**
- Interface de plugin + ContextoScan → Task 1. ✓
- Registro (registrar/listar/executar) → Task 1. ✓
- 8 plugins embutidos + auto-registro → Task 3. ✓
- plugins.service (ativar/desativar via Configuracao) → Task 2. ✓
- Refator do scanner para usar plugins → Task 4. ✓
- Runner aplica plugins ativos → Task 5. ✓
- ScanResultado inalterado (RESULTADO_VAZIO cobre todas as chaves) → Task 1. ✓
- YAGNI (API/UI/SDK/dinâmico) → sem tarefa (7B). ✓

**2. Placeholder scan:** sem TBD/TODO. Task 4 Step 1 indica remover imports órfãos e o bloco antigo — instrução de refator concreta, com a assinatura/corpo finais mostrados.

**3. Type consistency:** `ContextoScan`/`PluginScanner` (Task 1) usados pelos adapters (Task 3) e pelo scanner (Task 4). `executarPlugins(ctx, idsAtivos: Set<string>)`/`idsPlugins()`/`registrarPluginsEmbutidos()` consistentes entre registro, index e scanner. `lerPluginsAtivos(configs, todosIds)` (Task 2) usado no runner (Task 5). `RESULTADO_VAZIO` cobre exatamente as chaves de `ScanResultado` (https, headers, cookies, exposicao, tecnologias, performance, cors, dns).
