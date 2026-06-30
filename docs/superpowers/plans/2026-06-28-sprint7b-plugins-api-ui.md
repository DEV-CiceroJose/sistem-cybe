# Sprint 7B — API de Plugins, Marketplace e SDK: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps usam checkbox (`- [ ]`).

**Goal:** Expor os plugins via API (listar/ligar/desligar), uma página "Plugins" (marketplace local) e documentar o SDK.

**Architecture:** `listarPluginsComStatus` (puro) combina o registro de plugins com as configs; a controller expõe GET/PATCH `/plugins` persistindo em `Configuracao`; o frontend mostra cards com toggle.

**Tech Stack:** TypeScript (CommonJS), Express, Prisma, Vitest, React/Vite, swagger-ui-express.

## Global Constraints

- Linguagem: pt-BR. Resposta API `{ sucesso, dados }`. Validação `zod`.
- Persistência: `Configuracao` chave `plugin.<id>.ativo` valor `"true"`/`"false"`.
- Lista somente os 8 coletores (vêm do registro). Rotas `/plugins` protegidas por JWT.
- Testes co-localizados; rodar de `backend/`. Após cada tarefa: suíte verde + commit.

---

### Task 1: listarPluginsComStatus (TDD)

**Files:**
- Modify: `backend/src/services/plugins.service.ts`
- Test: `backend/src/services/plugins.service.test.ts`

**Interfaces:**
- Produces:
  - `interface PluginInfo { id: string; nome: string; descricao: string; ativo: boolean }`
  - `listarPluginsComStatus(plugins: { id: string; nome: string; descricao: string }[], configs: { chave: string; valor: string }[]): PluginInfo[]`

- [ ] **Step 1: Adicionar testes** em `backend/src/services/plugins.service.test.ts`

```ts
import { lerPluginsAtivos, listarPluginsComStatus } from "./plugins.service";
// (manter o import existente de lerPluginsAtivos; juntar listarPluginsComStatus)

const plugins = [
  { id: "https", nome: "HTTPS/TLS", descricao: "a" },
  { id: "headers", nome: "Cabeçalhos HTTP", descricao: "b" },
];

describe("listarPluginsComStatus", () => {
  it("mapeia campos e marca todos ativos por padrão", () => {
    const r = listarPluginsComStatus(plugins, []);
    expect(r).toEqual([
      { id: "https", nome: "HTTPS/TLS", descricao: "a", ativo: true },
      { id: "headers", nome: "Cabeçalhos HTTP", descricao: "b", ativo: true },
    ]);
  });
  it("plugin.<id>.ativo=false marca aquele como inativo", () => {
    const r = listarPluginsComStatus(plugins, [{ chave: "plugin.headers.ativo", valor: "false" }]);
    expect(r.find((p) => p.id === "headers")!.ativo).toBe(false);
    expect(r.find((p) => p.id === "https")!.ativo).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/services/plugins.service.test.ts`
Expected: FAIL — `listarPluginsComStatus` não existe.

- [ ] **Step 3: Implementar** — adicionar em `backend/src/services/plugins.service.ts`

```ts
export interface PluginInfo {
  id: string;
  nome: string;
  descricao: string;
  ativo: boolean;
}

export function listarPluginsComStatus(
  plugins: { id: string; nome: string; descricao: string }[],
  configs: { chave: string; valor: string }[],
): PluginInfo[] {
  const ativos = lerPluginsAtivos(configs, plugins.map((p) => p.id));
  return plugins.map((p) => ({ id: p.id, nome: p.nome, descricao: p.descricao, ativo: ativos.has(p.id) }));
}
```

(`lerPluginsAtivos` já existe neste arquivo.)

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx vitest run src/services/plugins.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/plugins.service.ts backend/src/services/plugins.service.test.ts
git commit -m "test(plugins): listarPluginsComStatus via TDD"
```

---

### Task 2: API /plugins + OpenAPI + Postman snapshot

**Files:**
- Create: `backend/src/controllers/plugin.controller.ts`
- Create: `backend/src/routes/plugin.routes.ts`
- Modify: `backend/src/routes/index.ts`
- Modify: `backend/src/docs/openapi.ts`
- Modify: `docs/postman/colecao.json` (regenerado)

**Interfaces:**
- Consumes: `registrarPluginsEmbutidos`, `listarPlugins`, `idsPlugins`, `listarPluginsComStatus`, `prisma`.
- Produces: `GET /api/v1/plugins`, `PATCH /api/v1/plugins/:id`.

- [ ] **Step 1: `plugin.controller.ts`**

```ts
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../database/prisma";
import { registrarPluginsEmbutidos } from "../plugins";
import { listarPlugins, idsPlugins } from "../plugins/registro";
import { listarPluginsComStatus } from "../services/plugins.service";
import { HttpError } from "../middlewares/error.middleware";

const patchSchema = z.object({ ativo: z.boolean() });

export async function listarPluginsApi(_req: Request, res: Response) {
  registrarPluginsEmbutidos();
  const configs = await prisma.configuracao.findMany();
  const plugins = listarPlugins().map((p) => ({ id: p.id, nome: p.nome, descricao: p.descricao }));
  res.json({ sucesso: true, dados: listarPluginsComStatus(plugins, configs) });
}

export async function atualizarPluginApi(req: Request, res: Response) {
  registrarPluginsEmbutidos();
  const parse = patchSchema.safeParse(req.body);
  if (!parse.success) throw new HttpError(400, "Dados inválidos.");
  const id = req.params.id;
  if (!idsPlugins().includes(id)) throw new HttpError(404, "Plugin não encontrado.");

  const chave = `plugin.${id}.ativo`;
  const valor = String(parse.data.ativo);
  await prisma.configuracao.upsert({
    where: { chave },
    update: { valor },
    create: { chave, valor },
  });
  res.json({ sucesso: true, dados: { id, ativo: parse.data.ativo } });
}
```

- [ ] **Step 2: `plugin.routes.ts`**

```ts
import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { listarPluginsApi, atualizarPluginApi } from "../controllers/plugin.controller";

export const pluginRouter = Router();
pluginRouter.get("/", asyncHandler(listarPluginsApi));
pluginRouter.patch("/:id", asyncHandler(atualizarPluginApi));
```

- [ ] **Step 3: Registrar (protegido)** — `backend/src/routes/index.ts`:
`import { pluginRouter } from "./plugin.routes";` e (junto das protegidas)
`router.use("/plugins", autenticar, pluginRouter);`.

- [ ] **Step 4: OpenAPI** — em `backend/src/docs/openapi.ts`, adicionar ao objeto `paths`:

```ts
    "/plugins": {
      get: { summary: "Lista os plugins de coleta e o estado ativo", responses: { "200": { description: "Lista" } } },
    },
    "/plugins/{id}": {
      patch: {
        summary: "Ativa ou desativa um plugin",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { ativo: { type: "boolean" } }, required: ["ativo"] } } } },
        responses: { "200": { description: "Atualizado" }, "404": { description: "Plugin não encontrado" } },
      },
    },
```

- [ ] **Step 5: Regenerar snapshot Postman**

Run: `cd backend && npm run postman:gen`
Expected: `docs/postman/colecao.json` atualizado com `/plugins`.

- [ ] **Step 6: Verificar + commit**

Run: `cd backend && npx tsc --noEmit && npm test`
Expected: tsc ok; testes passam.
```bash
git add backend/src docs/postman/colecao.json
git commit -m "feat(api): endpoints de plugins (listar/ativar)"
```

---

### Task 3: Frontend — página Plugins

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/services/api.ts`
- Create: `frontend/src/pages/Plugins.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`

**Interfaces:**
- Consumes: `GET /plugins`, `PATCH /plugins/:id`.
- Produces: `PluginInfo`, `listarPlugins`, `atualizarPlugin`.

- [ ] **Step 1: Tipo** — `frontend/src/types/index.ts` (ao final)

```ts
export interface PluginInfo {
  id: string;
  nome: string;
  descricao: string;
  ativo: boolean;
}
```

- [ ] **Step 2: API** — `frontend/src/services/api.ts` (adicionar; juntar `PluginInfo` ao import de tipos existente)

```ts
export async function listarPlugins(): Promise<PluginInfo[]> {
  const { data } = await api.get("/plugins");
  return data.dados;
}
export async function atualizarPlugin(id: string, ativo: boolean): Promise<void> {
  await api.patch(`/plugins/${id}`, { ativo });
}
```

- [ ] **Step 3: `pages/Plugins.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Navbar } from "../components/Navbar";
import { Card } from "../components/Card";
import { Loader } from "../components/Loader";
import { Alert } from "../components/Alert";
import { listarPlugins, atualizarPlugin, extrairMensagemErro } from "../services/api";
import type { PluginInfo } from "../types";

export function Plugins() {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setPlugins(await listarPlugins());
  }
  useEffect(() => {
    carregar().catch((e) => setErro(extrairMensagemErro(e))).finally(() => setCarregando(false));
  }, []);

  async function alternar(p: PluginInfo) {
    try {
      await atualizarPlugin(p.id, !p.ativo);
      await carregar();
    } catch (e) {
      setErro(extrairMensagemErro(e));
    }
  }

  return (
    <>
      <Navbar title="Plugins" subtitle="Módulos de análise (marketplace local)" />
      <main className="flex-1 overflow-y-auto p-6 space-y-4">
        {carregando && <Loader texto="Carregando" />}
        {erro && <Alert tipo="erro">{erro}</Alert>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {plugins.map((p) => (
            <Card key={p.id} title={p.nome} action={
              <button
                onClick={() => alternar(p)}
                className={`rounded-full border px-3 py-1 text-xs ${p.ativo ? "border-ok/30 bg-ok/10 text-ok" : "border-line bg-bg-raised/40 text-slate-500"}`}
              >
                {p.ativo ? "Ativo" : "Inativo"}
              </button>
            }>
              <p className="text-sm text-slate-400">{p.descricao}</p>
              <p className="mt-2 text-[11px] text-slate-600">id: {p.id}</p>
            </Card>
          ))}
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 4: Rota** — `frontend/src/App.tsx`: importar `import { Plugins } from "./pages/Plugins";` e adicionar dentro das rotas internas protegidas:
`<Route path="/plugins" element={<Plugins />} />`.

- [ ] **Step 5: Sidebar** — `frontend/src/components/Sidebar.tsx`: adicionar ao array `links` um item `{ to: "/plugins", label: "Plugins", icon: "⧉" }` (antes de Configurações).

- [ ] **Step 6: Build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add frontend/src
git commit -m "feat(plugins): página de plugins (marketplace local)"
```

---

### Task 4: docs/plugins.md (SDK)

**Files:**
- Create: `docs/plugins.md`

- [ ] **Step 1: Escrever o guia** — `docs/plugins.md`

````markdown
# SDK de Plugins — Web Security Analyzer

A coleta do scanner é feita por **plugins** embutidos. Cada plugin recebe um
`ContextoScan` (montado após o fetch único da página) e devolve sua fatia do
`ScanResultado`. Os plugins são código confiável do próprio projeto — não há
carregamento de arquivos externos.

## Interface

```ts
interface PluginScanner {
  id: string;        // estável, ex.: "meu-plugin"
  nome: string;
  descricao: string;
  coletar(ctx: ContextoScan): Promise<Partial<ScanResultado>>;
}
```

## ContextoScan

| Campo | Tipo | Descrição |
|---|---|---|
| `urlFinal` | string | URL após redirecionamentos |
| `hostname` | string | host de `urlFinal` |
| `headers` | Headers | cabeçalhos da resposta |
| `html` | string | corpo HTML |
| `tempoRespostaMs` | number | tempo de resposta |
| `setCookieRaw` | string[] | cabeçalhos Set-Cookie crus |
| `robotsTxtExiste` | boolean | robots.txt encontrado |
| `sitemapXmlExiste` | boolean | sitemap.xml encontrado |

## Criando um plugin

1. Crie `backend/src/plugins/meu.plugin.ts`:

```ts
import type { PluginScanner } from "./tipos";

export const meuPlugin: PluginScanner = {
  id: "meu-plugin",
  nome: "Meu Plugin",
  descricao: "Exemplo de coletor.",
  async coletar(ctx) {
    // retorne apenas a(s) fatia(s) de ScanResultado que este plugin produz
    return {};
  },
};
```

2. Registre em `backend/src/plugins/index.ts`, adicionando `meuPlugin` à lista
   de `registrarPluginsEmbutidos`.

3. A fatia retornada é mesclada sobre `RESULTADO_VAZIO` em `executarPlugins`.

## Ativar/Desativar

- Pela página **Plugins** (marketplace local) ou via API `PATCH /api/v1/plugins/:id`.
- Persistido em `Configuracao` (`plugin.<id>.ativo`). Plugins inativos não rodam;
  sua fatia fica com o valor default.
````

- [ ] **Step 2: Commit**

```bash
git add docs/plugins.md
git commit -m "docs(plugins): SDK para desenvolvedores"
```

---

### Task 5: Verificação final

- [ ] `cd backend && npm test` → todos verdes.
- [ ] `cd backend && npx tsc --noEmit` → sem erros.
- [ ] `cd frontend && npm run build` → sucesso.
- [ ] Commit final se necessário.

## Self-Review

**1. Spec coverage:**
- `listarPluginsComStatus` → Task 1. ✓
- API GET/PATCH /plugins + OpenAPI + Postman → Task 2. ✓
- Frontend página + rota + Sidebar → Task 3. ✓
- SDK/doc → Task 4. ✓
- Persistência via Configuracao → Task 2 (upsert). ✓
- YAGNI (config extra, externo) → sem tarefa. ✓

**2. Placeholder scan:** sem TBD/TODO; código completo em cada step. O exemplo do SDK retorna `{}` de propósito (template), com comentário explicativo — não é placeholder de implementação do projeto.

**3. Type consistency:** `PluginInfo` (Task 1) reusado no controller (Task 2) e no frontend (Task 3). `listarPluginsComStatus(plugins, configs)` consistente. `listarPlugins()`/`idsPlugins()`/`registrarPluginsEmbutidos()` vêm do registro da 7A. Rotas `/plugins` protegidas; OpenAPI e Postman atualizados.
