# Sprint 6B — Webhooks & Postman: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps usam checkbox (`- [ ]`).

**Goal:** Disparar webhooks assinados (HMAC) quando uma auditoria conclui, com registro de entregas, e gerar uma coleção Postman a partir do OpenAPI.

**Architecture:** Funções puras (`webhook.service`, `postman`) cobertas por TDD; um dispatcher de rede chamado pelo runner ao concluir; tabelas `Webhook`/`WebhookEntrega`; API `/webhooks` e `/postman`; UI em Configurações.

**Tech Stack:** TypeScript (CommonJS), Express, Prisma/SQLite, node:crypto, Vitest, React/Vite, tsx.

## Global Constraints

- Linguagem: pt-BR. Resposta API: `{ sucesso, dados }` (+ `paginacao` nas listas).
- Evento único: `auditoria.concluida`. Headers do POST: `Content-Type: application/json`, `X-WSA-Event`, `X-WSA-Signature` (HMAC-SHA256 hex do corpo).
- Entrega: 1 retentativa em falha; grava `WebhookEntrega` (status SUCESSO/FALHA).
- `status` em SQLite é String (sem enums no Prisma).
- `GET /postman` é público (como `/docs`); demais `/webhooks` exigem JWT.
- Testes co-localizados; rodar de `backend/`. Após cada tarefa: suíte verde + commit.

---

### Task 1: webhook.service (TDD)

**Files:**
- Create: `backend/src/services/webhook.service.ts`
- Test: `backend/src/services/webhook.service.test.ts`

**Interfaces:**
- Produces:
  - `interface PayloadWebhook { evento: "auditoria.concluida"; auditoriaId: string; url: string; score: number | null; classificacao: string | null; concluidoEm: string | null }`
  - `construirPayloadWebhook(a: { id: string; url: string; score: number | null; classificacao: string | null; concluidoEm: Date | null }): PayloadWebhook`
  - `assinarPayload(corpo: string, secret: string): string`

- [ ] **Step 1: Teste que falha** (`webhook.service.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { construirPayloadWebhook, assinarPayload } from "./webhook.service";

describe("construirPayloadWebhook", () => {
  it("monta o payload com evento fixo e campos da auditoria", () => {
    const p = construirPayloadWebhook({
      id: "a1", url: "https://x.com", score: 72, classificacao: "BOA",
      concluidoEm: new Date("2026-06-28T10:00:03.000Z"),
    });
    expect(p.evento).toBe("auditoria.concluida");
    expect(p.auditoriaId).toBe("a1");
    expect(p.url).toBe("https://x.com");
    expect(p.score).toBe(72);
    expect(p.classificacao).toBe("BOA");
    expect(p.concluidoEm).toBe("2026-06-28T10:00:03.000Z");
  });
  it("lida com concluidoEm nulo", () => {
    const p = construirPayloadWebhook({ id: "a1", url: "u", score: null, classificacao: null, concluidoEm: null });
    expect(p.concluidoEm).toBeNull();
    expect(p.score).toBeNull();
  });
});

describe("assinarPayload", () => {
  it("é determinístico para o mesmo corpo+secret (hex de 64 chars)", () => {
    const s1 = assinarPayload("corpo", "segredo");
    const s2 = assinarPayload("corpo", "segredo");
    expect(s1).toBe(s2);
    expect(s1).toMatch(/^[a-f0-9]{64}$/);
  });
  it("muda com secret diferente", () => {
    expect(assinarPayload("corpo", "a")).not.toBe(assinarPayload("corpo", "b"));
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/services/webhook.service.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `webhook.service.ts`**

```ts
import { createHmac } from "node:crypto";

export interface PayloadWebhook {
  evento: "auditoria.concluida";
  auditoriaId: string;
  url: string;
  score: number | null;
  classificacao: string | null;
  concluidoEm: string | null;
}

export function construirPayloadWebhook(a: {
  id: string;
  url: string;
  score: number | null;
  classificacao: string | null;
  concluidoEm: Date | null;
}): PayloadWebhook {
  return {
    evento: "auditoria.concluida",
    auditoriaId: a.id,
    url: a.url,
    score: a.score,
    classificacao: a.classificacao,
    concluidoEm: a.concluidoEm ? a.concluidoEm.toISOString() : null,
  };
}

export function assinarPayload(corpo: string, secret: string): string {
  return createHmac("sha256", secret).update(corpo).digest("hex");
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx vitest run src/services/webhook.service.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/webhook.service.ts backend/src/services/webhook.service.test.ts
git commit -m "test(webhook): payload e assinatura HMAC via TDD"
```

---

### Task 2: postman (TDD) + endpoint + snapshot

**Files:**
- Create: `backend/src/services/postman.ts`
- Test: `backend/src/services/postman.test.ts`
- Create: `backend/src/controllers/postman.controller.ts`
- Create: `backend/src/routes/postman.routes.ts`
- Modify: `backend/src/routes/index.ts`
- Create: `backend/scripts/gerar-postman.ts`
- Modify: `backend/package.json` (script `postman:gen`)
- Create: `docs/postman/colecao.json` (snapshot gerado)

**Interfaces:**
- Consumes: `openapiDocumento` de `../docs/openapi`.
- Produces: `gerarColecaoPostman(openapi, baseUrl?)`.

- [ ] **Step 1: Teste que falha** (`postman.test.ts`)

```ts
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
    const temAuth = (lista.request.header || []).some((h: any) => h.key === "Authorization");
    expect(temAuth).toBe(true);
    const login = c.item.find((i) => i.name.includes("/auth/login"))!;
    const loginAuth = (login.request.header || []).some((h: any) => h.key === "Authorization");
    expect(loginAuth).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/services/postman.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `postman.ts`**

```ts
interface ItemPostman {
  name: string;
  request: { method: string; url: string; header?: { key: string; value: string }[] };
}
interface ColecaoPostman {
  info: { name: string; schema: string };
  item: ItemPostman[];
}

const SCHEMA = "https://schema.getpostman.com/json/collection/v2.1.0/collection.json";

export function gerarColecaoPostman(
  openapi: Record<string, any>,
  baseUrl = "http://localhost:3001/api/v1",
): ColecaoPostman {
  const item: ItemPostman[] = [];
  const paths = (openapi.paths || {}) as Record<string, Record<string, any>>;

  for (const [caminho, operacoes] of Object.entries(paths)) {
    for (const [metodo, op] of Object.entries(operacoes)) {
      const publica = Array.isArray(op?.security) && op.security.length === 0;
      const header = publica ? [] : [{ key: "Authorization", value: "Bearer {{token}}" }];
      item.push({
        name: `${metodo.toUpperCase()} ${caminho}`,
        request: { method: metodo.toUpperCase(), url: `${baseUrl}${caminho}`, header },
      });
    }
  }

  return {
    info: { name: (openapi.info?.title as string) || "API", schema: SCHEMA },
    item,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx vitest run src/services/postman.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Controller + rota** — `postman.controller.ts`

```ts
import type { Request, Response } from "express";
import { gerarColecaoPostman } from "../services/postman";
import { openapiDocumento } from "../docs/openapi";

export async function baixarPostman(_req: Request, res: Response) {
  const colecao = gerarColecaoPostman(openapiDocumento as Record<string, unknown>);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="websec-analyzer.postman_collection.json"');
  res.send(JSON.stringify(colecao, null, 2));
}
```

`postman.routes.ts`

```ts
import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { baixarPostman } from "../controllers/postman.controller";

export const postmanRouter = Router();
postmanRouter.get("/", asyncHandler(baixarPostman));
```

- [ ] **Step 6: Registrar (público)** — `routes/index.ts`, junto dos públicos:
`import { postmanRouter } from "./postman.routes";` e `router.use("/postman", postmanRouter);`.

- [ ] **Step 7: Script de snapshot** — `backend/scripts/gerar-postman.ts`

```ts
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { gerarColecaoPostman } from "../src/services/postman";
import { openapiDocumento } from "../src/docs/openapi";

const colecao = gerarColecaoPostman(openapiDocumento as Record<string, unknown>);
const destino = path.join(process.cwd(), "..", "docs", "postman", "colecao.json");
mkdirSync(path.dirname(destino), { recursive: true });
writeFileSync(destino, JSON.stringify(colecao, null, 2), "utf-8");
console.log(`Coleção Postman gerada em ${destino}`);
```

Adicionar script em `backend/package.json`: `"postman:gen": "tsx scripts/gerar-postman.ts"`.

- [ ] **Step 8: Gerar o snapshot**

Run: `cd backend && npm run postman:gen`
Expected: cria `docs/postman/colecao.json`.

- [ ] **Step 9: Verificar + commit**

Run: `cd backend && npx tsc --noEmit && npm test`
Expected: tsc ok; testes passam.
```bash
git add backend/src/services/postman.ts backend/src/services/postman.test.ts backend/src/controllers/postman.controller.ts backend/src/routes/postman.routes.ts backend/src/routes/index.ts backend/scripts/gerar-postman.ts backend/package.json docs/postman/colecao.json
git commit -m "feat(api): coleção Postman gerada do OpenAPI (GET /postman)"
```

---

### Task 3: Prisma + dispatcher + integração no runner

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/src/services/webhook.dispatcher.ts`
- Modify: `backend/src/services/auditoria.runner.ts`

**Interfaces:**
- Consumes: `construirPayloadWebhook`, `assinarPayload`, `prisma`.
- Produces: `dispararWebhooks(auditoriaId: string): Promise<void>`.

- [ ] **Step 1: Schema** — adicionar em `schema.prisma`

```prisma
model Webhook {
  id       String   @id @default(uuid())
  url      String
  secret   String
  ativo    Boolean  @default(true)
  criadoEm DateTime @default(now())

  @@index([ativo])
}

// status: SUCESSO | FALHA
model WebhookEntrega {
  id          String   @id @default(uuid())
  webhookId   String
  auditoriaId String?
  status      String
  httpStatus  Int?
  tentativas  Int      @default(1)
  erro        String?
  criadoEm    DateTime @default(now())

  @@index([webhookId])
  @@index([criadoEm])
}
```

- [ ] **Step 2: Regenerar Prisma**

Run (bash): `cd backend && DATABASE_URL="file:./dev.db" npx prisma generate`
(Windows PowerShell: `$env:DATABASE_URL="file:./dev.db"; npx prisma generate`)
Expected: client com `prisma.webhook` e `prisma.webhookEntrega`.

- [ ] **Step 3: Implementar `webhook.dispatcher.ts`**

```ts
import { prisma } from "../database/prisma";
import { construirPayloadWebhook, assinarPayload } from "./webhook.service";

async function entregar(url: string, corpo: string, assinatura: string): Promise<{ ok: boolean; httpStatus?: number; erro?: string }> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-WSA-Event": "auditoria.concluida",
        "X-WSA-Signature": assinatura,
      },
      body: corpo,
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return { ok: resp.ok, httpStatus: resp.status, erro: resp.ok ? undefined : `HTTP ${resp.status}` };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}

/** Dispara o evento de conclusão para todos os webhooks ativos (1 retentativa) e registra as entregas. */
export async function dispararWebhooks(auditoriaId: string): Promise<void> {
  const auditoria = await prisma.auditoria.findUnique({ where: { id: auditoriaId } });
  if (!auditoria) return;
  const webhooks = await prisma.webhook.findMany({ where: { ativo: true } });
  if (webhooks.length === 0) return;

  const corpo = JSON.stringify(
    construirPayloadWebhook({
      id: auditoria.id,
      url: auditoria.url,
      score: auditoria.score ?? null,
      classificacao: auditoria.classificacao ?? null,
      concluidoEm: auditoria.concluidoEm ?? null,
    }),
  );

  for (const wh of webhooks) {
    const assinatura = assinarPayload(corpo, wh.secret);
    let r = await entregar(wh.url, corpo, assinatura);
    let tentativas = 1;
    if (!r.ok) {
      r = await entregar(wh.url, corpo, assinatura);
      tentativas = 2;
    }
    await prisma.webhookEntrega.create({
      data: {
        webhookId: wh.id,
        auditoriaId,
        status: r.ok ? "SUCESSO" : "FALHA",
        httpStatus: r.httpStatus,
        tentativas,
        erro: r.erro,
      },
    });
  }
}
```

- [ ] **Step 4: Integrar no runner** — `auditoria.runner.ts`

Importar `import { dispararWebhooks } from "./webhook.dispatcher";` e, logo após
`await gerarAlertasDaAuditoria(auditoria.id, url);` (antes do `return`), adicionar:

```ts
dispararWebhooks(auditoria.id).catch((e) => console.error("[webhooks]", (e as Error).message));
```

(fire-and-forget — não bloqueia o retorno.)

- [ ] **Step 5: Verificar + commit**

Run: `cd backend && npx tsc --noEmit && npm test`
Expected: tsc ok; testes passam.
```bash
git add backend/prisma backend/src/services/webhook.dispatcher.ts backend/src/services/auditoria.runner.ts
git commit -m "feat(webhook): dispatcher com HMAC, retentativa e entregas"
```

---

### Task 4: API /webhooks

**Files:**
- Create: `backend/src/controllers/webhook.controller.ts`
- Create: `backend/src/routes/webhook.routes.ts`
- Modify: `backend/src/routes/index.ts`

- [ ] **Step 1: `webhook.controller.ts`**

```ts
import type { Request, Response } from "express";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { prisma } from "../database/prisma";
import { paginar } from "../utils/paginacao";
import { HttpError } from "../middlewares/error.middleware";

const criarSchema = z.object({ url: z.string().url("URL inválida.") });
const patchSchema = z.object({ ativo: z.boolean() });

export async function criarWebhook(req: Request, res: Response) {
  const parse = criarSchema.safeParse(req.body);
  if (!parse.success) throw new HttpError(400, parse.error.issues[0]?.message || "Dados inválidos.");
  const secret = randomBytes(24).toString("hex");
  const dados = await prisma.webhook.create({ data: { url: parse.data.url, secret } });
  res.status(201).json({ sucesso: true, dados });
}

export async function listarWebhooks(_req: Request, res: Response) {
  const dados = await prisma.webhook.findMany({ orderBy: { criadoEm: "desc" } });
  res.json({ sucesso: true, dados });
}

export async function atualizarWebhook(req: Request, res: Response) {
  const parse = patchSchema.safeParse(req.body);
  if (!parse.success) throw new HttpError(400, "Dados inválidos.");
  const existente = await prisma.webhook.findUnique({ where: { id: req.params.id } });
  if (!existente) throw new HttpError(404, "Webhook não encontrado.");
  const dados = await prisma.webhook.update({ where: { id: req.params.id }, data: { ativo: parse.data.ativo } });
  res.json({ sucesso: true, dados });
}

export async function excluirWebhook(req: Request, res: Response) {
  const existente = await prisma.webhook.findUnique({ where: { id: req.params.id } });
  if (!existente) throw new HttpError(404, "Webhook não encontrado.");
  await prisma.webhookEntrega.deleteMany({ where: { webhookId: req.params.id } });
  await prisma.webhook.delete({ where: { id: req.params.id } });
  res.json({ sucesso: true });
}

export async function listarEntregas(req: Request, res: Response) {
  const { limite, offset } = paginar(req.query);
  const where = { webhookId: req.params.id };
  const [dados, total] = await Promise.all([
    prisma.webhookEntrega.findMany({ where, orderBy: { criadoEm: "desc" }, take: limite, skip: offset }),
    prisma.webhookEntrega.count({ where }),
  ]);
  res.json({ sucesso: true, dados, paginacao: { total, limite, offset } });
}
```

- [ ] **Step 2: `webhook.routes.ts`**

```ts
import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { criarWebhook, listarWebhooks, atualizarWebhook, excluirWebhook, listarEntregas } from "../controllers/webhook.controller";

export const webhookRouter = Router();
webhookRouter.post("/", asyncHandler(criarWebhook));
webhookRouter.get("/", asyncHandler(listarWebhooks));
webhookRouter.patch("/:id", asyncHandler(atualizarWebhook));
webhookRouter.delete("/:id", asyncHandler(excluirWebhook));
webhookRouter.get("/:id/entregas", asyncHandler(listarEntregas));
```

- [ ] **Step 3: Registrar (protegido)** — `routes/index.ts`:
`import { webhookRouter } from "./webhook.routes";` e `router.use("/webhooks", autenticar, webhookRouter);`.

- [ ] **Step 4: Verificar + commit**

Run: `cd backend && npx tsc --noEmit && npm test`
Expected: tsc ok; testes passam.
```bash
git add backend/src
git commit -m "feat(api): CRUD de webhooks e entregas"
```

---

### Task 5: Frontend — WebhooksManager em Configurações

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/services/api.ts`
- Create: `frontend/src/components/WebhooksManager.tsx`
- Modify: `frontend/src/pages/Configuracoes.tsx`

- [ ] **Step 1: Tipos** — `frontend/src/types/index.ts` (ao final)

```ts
export interface Webhook {
  id: string;
  url: string;
  secret: string;
  ativo: boolean;
  criadoEm: string;
}
```

- [ ] **Step 2: API** — `frontend/src/services/api.ts` (adicionar)

```ts
import type { Webhook } from "../types";

export async function listarWebhooks(): Promise<Webhook[]> {
  const { data } = await api.get("/webhooks");
  return data.dados;
}
export async function criarWebhook(url: string): Promise<Webhook> {
  const { data } = await api.post("/webhooks", { url });
  return data.dados;
}
export async function atualizarWebhook(id: string, ativo: boolean): Promise<void> {
  await api.patch(`/webhooks/${id}`, { ativo });
}
export async function excluirWebhook(id: string): Promise<void> {
  await api.delete(`/webhooks/${id}`);
}
export function urlPostman(): string {
  return `${api.defaults.baseURL}/postman`;
}
```

(Se já houver import de tipos de `../types`, juntar `Webhook` nele.)

- [ ] **Step 3: `WebhooksManager.tsx`**

```tsx
import { useEffect, useState } from "react";
import type { Webhook } from "../types";
import { Card } from "./Card";
import { listarWebhooks, criarWebhook, atualizarWebhook, excluirWebhook, urlPostman } from "../services/api";

export function WebhooksManager() {
  const [lista, setLista] = useState<Webhook[]>([]);
  const [url, setUrl] = useState("");

  async function carregar() { setLista(await listarWebhooks()); }
  useEffect(() => { carregar().catch(() => {}); }, []);

  async function adicionar() {
    if (!url.trim()) return;
    await criarWebhook(url.trim());
    setUrl("");
    await carregar();
  }

  return (
    <Card className="max-w-md" title="Webhooks" action={
      <a href={urlPostman()} className="text-xs text-accent hover:underline">Baixar coleção Postman</a>
    }>
      <p className="mb-4 text-xs text-slate-500">
        Receba um POST assinado (HMAC) quando uma auditoria concluir.
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://meu-endpoint.com/webhook"
          className="flex-1 rounded-md border border-line bg-bg-raised px-3 py-1.5 text-sm text-slate-200 outline-none placeholder:text-slate-600" />
        <button onClick={adicionar} className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-bg hover:opacity-90">Adicionar</button>
      </div>
      {lista.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum webhook.</p>
      ) : (
        <div className="space-y-2">
          {lista.map((w) => (
            <div key={w.id} className="rounded-lg border border-line bg-bg-raised/40 p-2.5 text-sm">
              <p className="break-all text-slate-200">{w.url}</p>
              <p className="mt-1 break-all text-[11px] text-slate-500">secret: {w.secret}</p>
              <div className="mt-2 flex items-center gap-3">
                <button onClick={async () => { await atualizarWebhook(w.id, !w.ativo); await carregar(); }}
                  className={`text-xs ${w.ativo ? "text-ok" : "text-slate-500"} hover:underline`}>
                  {w.ativo ? "ativo" : "inativo"}
                </button>
                <button onClick={async () => { await excluirWebhook(w.id); await carregar(); }} className="text-xs text-danger hover:underline">excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 4: Incluir em `Configuracoes.tsx`** — importar e renderizar `<WebhooksManager />` ao final do `<main>` (após os cards existentes):
`import { WebhooksManager } from "../components/WebhooksManager";` e `<WebhooksManager />`.

- [ ] **Step 5: Build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "feat(webhook): gestão de webhooks e download Postman no frontend"
```

---

### Task 6: Verificação final

- [ ] `cd backend && npm test` → todos verdes.
- [ ] `cd backend && npx tsc --noEmit` → sem erros.
- [ ] `cd frontend && npm run build` → sucesso.
- [ ] Commit final se necessário.

## Self-Review

**1. Spec coverage:**
- Webhooks de conclusão (assinados HMAC) → Task 1 + Task 3. ✓
- Registro de entregas + 1 retentativa → Task 3. ✓
- API de webhooks (CRUD + entregas) → Task 4. ✓
- Coleção Postman do OpenAPI + endpoint + snapshot → Task 2. ✓
- Frontend (gestão + download) → Task 5. ✓
- YAGNI (multi-evento, backoff, ssrf, editar URL) → sem tarefa. ✓

**2. Placeholder scan:** sem TBD/TODO; todos os steps de código mostram o código. Task 5 Step 4 instrui inserir o componente no Configuracoes existente (sem nova lógica).

**3. Type consistency:** `PayloadWebhook`/`construirPayloadWebhook`/`assinarPayload` (Task 1) usados no dispatcher (Task 3). `gerarColecaoPostman(openapi, baseUrl?)` (Task 2) usado no controller e script. `dispararWebhooks(id)` (Task 3) chamado no runner. `Webhook` type (frontend Task 5) espelha o modelo Prisma (Task 3). Rotas `/webhooks` (protegida) e `/postman` (pública) registradas no index.
