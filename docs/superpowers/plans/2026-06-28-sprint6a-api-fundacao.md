# Sprint 6A — Fundação da API REST: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps usam checkbox (`- [ ]`).

**Goal:** Versionar a API em `/api/v1`, protegê-la com JWT (login via `.env`), adicionar paginação, logs de requisição, Swagger e login no frontend.

**Architecture:** Serviços puros (`auth.service`, `paginacao`) cobertos por TDD; middlewares de auth e de log; rotas reorganizadas sob `/api/v1` com JWT; frontend com AuthContext + rota protegida + interceptors.

**Tech Stack:** TypeScript (CommonJS), Express, Prisma/SQLite, jsonwebtoken, swagger-ui-express, Vitest, React/Vite/react-router-dom.

## Global Constraints

- Linguagem: pt-BR. Resposta API: `{ sucesso, dados }` (+ `paginacao` quando aplicável).
- JWT: payload `{ sub: "api" }`, expiração default `8h`, segredo de `env.jwtSecret`.
- Credenciais de dev: `AUTH_USUARIO=admin`, `AUTH_SENHA=admin`, `JWT_SECRET=dev-secret-trocar-em-producao`.
- Tudo sob `/api/v1`; público apenas: `auth/login`, `health`, `docs`.
- Paginação: `limitePadrao=20`, `limiteMax=100`, `offset>=0`.
- Novas deps: `jsonwebtoken`, `swagger-ui-express` (+ `@types/jsonwebtoken`, `@types/swagger-ui-express`).
- Testes co-localizados; rodar de `backend/`. Após cada tarefa: suíte verde + commit.

---

### Task 1: utils/paginacao (TDD) + aplicar nas listas

**Files:**
- Create: `backend/src/utils/paginacao.ts`
- Test: `backend/src/utils/paginacao.test.ts`
- Modify: `backend/src/controllers/auditoria.controller.ts` (listarHistorico)
- Modify: `backend/src/controllers/alerta.controller.ts` (listarAlertas)

**Interfaces:**
- Produces: `interface Paginacao { limite: number; offset: number }`, `paginar(query, limitePadrao?, limiteMax?): Paginacao`.

- [ ] **Step 1: Teste que falha** (`paginacao.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { paginar } from "./paginacao";

describe("paginar", () => {
  it("usa defaults sem query", () => {
    expect(paginar({})).toEqual({ limite: 20, offset: 0 });
  });
  it("respeita limite e offset válidos", () => {
    expect(paginar({ limite: "10", offset: "5" })).toEqual({ limite: 10, offset: 5 });
  });
  it("clampa o limite ao máximo (100)", () => {
    expect(paginar({ limite: "999" }).limite).toBe(100);
  });
  it("valores inválidos ou negativos caem nos defaults", () => {
    expect(paginar({ limite: "abc", offset: "-3" })).toEqual({ limite: 20, offset: 0 });
  });
  it("aceita limitePadrao e limiteMax customizados", () => {
    expect(paginar({}, 50, 200)).toEqual({ limite: 50, offset: 0 });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/utils/paginacao.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `paginacao.ts`**

```ts
export interface Paginacao {
  limite: number;
  offset: number;
}

function inteiroPositivo(valor: unknown, padrao: number): number {
  const n = Number(valor);
  return Number.isInteger(n) && n >= 0 ? n : padrao;
}

export function paginar(
  query: { limite?: unknown; offset?: unknown },
  limitePadrao = 20,
  limiteMax = 100,
): Paginacao {
  const limiteBruto = inteiroPositivo(query.limite, limitePadrao);
  const limite = Math.min(Math.max(1, limiteBruto), limiteMax);
  const offset = inteiroPositivo(query.offset, 0);
  return { limite, offset };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx vitest run src/utils/paginacao.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Aplicar em `listarHistorico`** — `backend/src/controllers/auditoria.controller.ts`

Importar `import { paginar } from "../utils/paginacao";` e substituir o corpo:

```ts
export async function listarHistorico(req: Request, res: Response) {
  const { limite, offset } = paginar(req.query);
  const url = typeof req.query.url === "string" && req.query.url ? req.query.url : undefined;
  const where = url ? { url } : undefined;
  const [dados, total] = await Promise.all([
    prisma.auditoria.findMany({ where, orderBy: { criadoEm: "desc" }, take: limite, skip: offset }),
    prisma.auditoria.count({ where }),
  ]);
  res.json({ sucesso: true, dados, paginacao: { total, limite, offset } });
}
```

- [ ] **Step 6: Aplicar em `listarAlertas`** — `backend/src/controllers/alerta.controller.ts`

Importar `paginar` e substituir o corpo:

```ts
export async function listarAlertas(req: Request, res: Response) {
  const { limite, offset } = paginar(req.query);
  const where = req.query.lido === "false" ? { lido: false } : req.query.lido === "true" ? { lido: true } : undefined;
  const [dados, total] = await Promise.all([
    prisma.alerta.findMany({ where, orderBy: { criadoEm: "desc" }, take: limite, skip: offset }),
    prisma.alerta.count({ where }),
  ]);
  res.json({ sucesso: true, dados, paginacao: { total, limite, offset } });
}
```

- [ ] **Step 7: Verificar + commit**

Run: `cd backend && npx tsc --noEmit && npm test`
Expected: tsc ok; testes passam.
```bash
git add backend/src/utils/paginacao.ts backend/src/utils/paginacao.test.ts backend/src/controllers/auditoria.controller.ts backend/src/controllers/alerta.controller.ts
git commit -m "feat(api): paginação em auditorias e alertas via TDD"
```

---

### Task 2: auth.service (TDD) + env + .env.example

**Files:**
- Modify: `backend/src/config/env.ts`
- Modify: `backend/.env.example`
- Create: `backend/src/services/auth.service.ts`
- Test: `backend/src/services/auth.service.test.ts`
- Deps: `jsonwebtoken`, `@types/jsonwebtoken`

**Interfaces:**
- Produces:
  - `interface Credenciais { usuario: string; senha: string }`
  - `validarCredenciais(entrada: Credenciais, esperado: Credenciais): boolean`
  - `gerarToken(segredo: string, expiraEm?: string): string`
  - `verificarToken(token: string, segredo: string): { sub: string } | null`

- [ ] **Step 1: Instalar deps**

Run: `cd backend && npm i jsonwebtoken && npm i -D @types/jsonwebtoken`

- [ ] **Step 2: Teste que falha** (`auth.service.test.ts`)

```ts
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
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/services/auth.service.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 4: Implementar `auth.service.ts`**

```ts
import jwt from "jsonwebtoken";

export interface Credenciais {
  usuario: string;
  senha: string;
}

export function validarCredenciais(entrada: Credenciais, esperado: Credenciais): boolean {
  return entrada.usuario === esperado.usuario && entrada.senha === esperado.senha;
}

export function gerarToken(segredo: string, expiraEm = "8h"): string {
  return jwt.sign({ sub: "api" }, segredo, { expiresIn: expiraEm });
}

export function verificarToken(token: string, segredo: string): { sub: string } | null {
  try {
    const payload = jwt.verify(token, segredo);
    if (typeof payload === "object" && payload && typeof payload.sub === "string") {
      return { sub: payload.sub };
    }
    return null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd backend && npx vitest run src/services/auth.service.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 6: Atualizar `env.ts`**

```ts
export const env = {
  port: Number(process.env.PORT || 3001),
  nodeEnv: process.env.NODE_ENV || "development",
  scanTimeoutMs: Number(process.env.SCAN_TIMEOUT_MS || 8000),
  maxResponseBytes: Number(process.env.MAX_RESPONSE_BYTES || 5 * 1024 * 1024),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-trocar-em-producao",
  authUsuario: process.env.AUTH_USUARIO || "admin",
  authSenha: process.env.AUTH_SENHA || "admin",
};
```

- [ ] **Step 7: Atualizar `.env.example`** — acrescentar:

```
JWT_SECRET="dev-secret-trocar-em-producao"
AUTH_USUARIO="admin"
AUTH_SENHA="admin"
```

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/auth.service.ts backend/src/services/auth.service.test.ts backend/src/config/env.ts backend/.env.example backend/package.json backend/package-lock.json
git commit -m "feat(auth): auth.service (JWT) via TDD + config"
```

---

### Task 3: auth.middleware + login + versionamento /api/v1

**Files:**
- Create: `backend/src/middlewares/auth.middleware.ts`
- Create: `backend/src/controllers/auth.controller.ts`
- Create: `backend/src/routes/auth.routes.ts`
- Modify: `backend/src/routes/index.ts`
- Modify: `backend/src/index.ts`

**Interfaces:**
- Consumes: `validarCredenciais`, `gerarToken`, `verificarToken`, `env`.
- Produces: `autenticar` (middleware), `POST /api/v1/auth/login`, `apiV1Router`.

- [ ] **Step 1: `auth.controller.ts`**

```ts
import type { Request, Response } from "express";
import { z } from "zod";
import { env } from "../config/env";
import { validarCredenciais, gerarToken } from "../services/auth.service";
import { HttpError } from "../middlewares/error.middleware";

const loginSchema = z.object({ usuario: z.string().min(1), senha: z.string().min(1) });

export async function login(req: Request, res: Response) {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) throw new HttpError(400, "Dados inválidos.");
  const ok = validarCredenciais(parse.data, { usuario: env.authUsuario, senha: env.authSenha });
  if (!ok) throw new HttpError(401, "Credenciais inválidas.");
  const token = gerarToken(env.jwtSecret);
  res.json({ sucesso: true, dados: { token } });
}
```

- [ ] **Step 2: `auth.middleware.ts`**

```ts
import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { verificarToken } from "../services/auth.service";
import { HttpError } from "./error.middleware";

export function autenticar(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const [tipo, token] = header.split(" ");
  if (tipo !== "Bearer" || !token) throw new HttpError(401, "Token de autenticação ausente.");
  const payload = verificarToken(token, env.jwtSecret);
  if (!payload) throw new HttpError(401, "Token inválido ou expirado.");
  next();
}
```

- [ ] **Step 3: `auth.routes.ts`**

```ts
import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { login } from "../controllers/auth.controller";

export const authRouter = Router();
authRouter.post("/login", asyncHandler(login));
```

- [ ] **Step 4: Reorganizar `routes/index.ts`** sob v1 com proteção

```ts
import { Router } from "express";
import { auditoriaRouter } from "./auditoria.routes";
import { configuracaoRouter } from "./configuracao.routes";
import { agendamentoRouter } from "./agendamento.routes";
import { alertaRouter } from "./alerta.routes";
import { authRouter } from "./auth.routes";
import { autenticar } from "../middlewares/auth.middleware";

export const router = Router();

// Públicos
router.use("/auth", authRouter);
router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Protegidos
router.use("/auditorias", autenticar, auditoriaRouter);
router.use("/configuracoes", autenticar, configuracaoRouter);
router.use("/agendamentos", autenticar, agendamentoRouter);
router.use("/alertas", autenticar, alertaRouter);
```

- [ ] **Step 5: Montar `/api/v1` no `index.ts`**

Trocar `app.use("/api", router);` por `app.use("/api/v1", router);` e o limiter de `app.use("/api/", limiter);` por `app.use("/api/v1/", limiter);`.

- [ ] **Step 6: Verificar + commit**

Run: `cd backend && npx tsc --noEmit && npm test`
Expected: tsc ok; testes passam.
```bash
git add backend/src
git commit -m "feat(auth): JWT middleware, login e versionamento /api/v1"
```

---

### Task 4: RequestLog + middleware de log + GET /logs

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/src/middlewares/requestLog.middleware.ts`
- Create: `backend/src/controllers/log.controller.ts`
- Create: `backend/src/routes/log.routes.ts`
- Modify: `backend/src/routes/index.ts`, `backend/src/index.ts`

- [ ] **Step 1: Schema** — adicionar em `schema.prisma`

```prisma
model RequestLog {
  id        String   @id @default(uuid())
  metodo    String
  caminho   String
  status    Int
  duracaoMs Int
  criadoEm  DateTime @default(now())

  @@index([criadoEm])
}
```

- [ ] **Step 2: Regenerar Prisma**

Run: `cd backend && set DATABASE_URL=file:./dev.db&& npx prisma generate` (Windows) — em bash: `DATABASE_URL="file:./dev.db" npx prisma generate`.
Expected: client regenerado com `prisma.requestLog`.

- [ ] **Step 3: `requestLog.middleware.ts`**

```ts
import type { Request, Response, NextFunction } from "express";
import { prisma } from "../database/prisma";

export function registrarRequisicao(req: Request, res: Response, next: NextFunction) {
  const inicio = Date.now();
  res.on("finish", () => {
    const duracaoMs = Date.now() - inicio;
    prisma.requestLog
      .create({ data: { metodo: req.method, caminho: req.originalUrl, status: res.statusCode, duracaoMs } })
      .catch((e) => console.error("[requestLog]", (e as Error).message));
  });
  next();
}
```

- [ ] **Step 4: `log.controller.ts`**

```ts
import type { Request, Response } from "express";
import { prisma } from "../database/prisma";
import { paginar } from "../utils/paginacao";

export async function listarLogs(req: Request, res: Response) {
  const { limite, offset } = paginar(req.query);
  const [dados, total] = await Promise.all([
    prisma.requestLog.findMany({ orderBy: { criadoEm: "desc" }, take: limite, skip: offset }),
    prisma.requestLog.count(),
  ]);
  res.json({ sucesso: true, dados, paginacao: { total, limite, offset } });
}
```

- [ ] **Step 5: `log.routes.ts`**

```ts
import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { listarLogs } from "../controllers/log.controller";

export const logRouter = Router();
logRouter.get("/", asyncHandler(listarLogs));
```

- [ ] **Step 6: Registrar** — em `routes/index.ts` adicionar (protegido):
`import { logRouter } from "./log.routes";` e `router.use("/logs", autenticar, logRouter);`.

- [ ] **Step 7: Aplicar o middleware** — em `index.ts`, após `app.use(express.json(...))` e antes das rotas:
`import { registrarRequisicao } from "./middlewares/requestLog.middleware";` e `app.use("/api/v1", registrarRequisicao);`.

- [ ] **Step 8: Verificar + commit**

Run: `cd backend && npx tsc --noEmit && npm test`
Expected: tsc ok; testes passam.
```bash
git add backend/prisma backend/src
git commit -m "feat(api): logs de requisição (RequestLog) e GET /logs"
```

---

### Task 5: OpenAPI + Swagger UI

**Files:**
- Create: `backend/src/docs/openapi.ts`
- Modify: `backend/src/routes/index.ts`
- Deps: `swagger-ui-express`, `@types/swagger-ui-express`

- [ ] **Step 1: Instalar deps**

Run: `cd backend && npm i swagger-ui-express && npm i -D @types/swagger-ui-express`

- [ ] **Step 2: `docs/openapi.ts`**

```ts
export const openapiDocumento = {
  openapi: "3.0.3",
  info: { title: "Web Security Analyzer API", version: "1.0.0", description: "API REST de auditoria de segurança." },
  servers: [{ url: "/api/v1" }],
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/auth/login": {
      post: {
        summary: "Autentica e retorna um JWT",
        security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { usuario: { type: "string" }, senha: { type: "string" } }, required: ["usuario", "senha"] } } },
        },
        responses: { "200": { description: "Token emitido" }, "401": { description: "Credenciais inválidas" } },
      },
    },
    "/auditorias": {
      get: { summary: "Lista auditorias (paginado)", responses: { "200": { description: "Lista" } } },
      post: { summary: "Cria uma auditoria", responses: { "201": { description: "Criada" } } },
    },
    "/auditorias/{id}": { get: { summary: "Detalhe da auditoria", responses: { "200": { description: "Auditoria" }, "404": { description: "Não encontrada" } } } },
    "/auditorias/{id}/comparacao": { get: { summary: "Comparação com a anterior", responses: { "200": { description: "Comparação ou null" } } } },
    "/alertas": { get: { summary: "Lista alertas (paginado)", responses: { "200": { description: "Lista" } } } },
    "/agendamentos": {
      get: { summary: "Lista agendamentos", responses: { "200": { description: "Lista" } } },
      post: { summary: "Cria agendamento", responses: { "201": { description: "Criado" } } },
    },
    "/configuracoes": { get: { summary: "Lista configurações", responses: { "200": { description: "Lista" } } } },
    "/logs": { get: { summary: "Lista logs de requisição (paginado)", responses: { "200": { description: "Lista" } } } },
  },
} as const;
```

- [ ] **Step 3: Servir o Swagger** — em `routes/index.ts` (público), no topo:
`import swaggerUi from "swagger-ui-express";` e `import { openapiDocumento } from "../docs/openapi";`
Depois dos públicos, antes dos protegidos:
```ts
router.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiDocumento as any));
```

- [ ] **Step 4: Verificar + commit**

Run: `cd backend && npx tsc --noEmit && npm test`
Expected: tsc ok; testes passam.
```bash
git add backend/src/docs/openapi.ts backend/src/routes/index.ts backend/package.json backend/package-lock.json
git commit -m "feat(api): documentação OpenAPI/Swagger em /api/v1/docs"
```

---

### Task 6: Frontend — login, AuthContext, rota protegida, interceptors

**Files:**
- Modify: `frontend/src/services/api.ts`
- Create: `frontend/src/context/AuthContext.tsx`
- Create: `frontend/src/pages/Login.tsx`
- Create: `frontend/src/components/RotaProtegida.tsx`
- Modify: `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/.env.example` (VITE_API_URL)

**Interfaces:**
- Consumes: `POST /auth/login`.
- Produces: `AuthContext` (`autenticado`, `login`, `logout`), `RotaProtegida`.

- [ ] **Step 1: api.ts — baseURL v1 + interceptors + login**

No topo do arquivo, ajustar `baseURL` e adicionar interceptors:

```ts
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1",
  timeout: 30000,
});

const CHAVE_TOKEN = "wsa:token";

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(CHAVE_TOKEN);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (erro) => {
    if (axios.isAxiosError(erro) && erro.response?.status === 401) {
      localStorage.removeItem(CHAVE_TOKEN);
      if (location.pathname !== "/login") location.href = "/login";
    }
    return Promise.reject(erro);
  },
);

export async function autenticarApi(usuario: string, senha: string): Promise<string> {
  const { data } = await api.post("/auth/login", { usuario, senha });
  return data.dados.token;
}

export const TOKEN_KEY = CHAVE_TOKEN;
```

- [ ] **Step 2: `context/AuthContext.tsx`**

```tsx
import { createContext, useContext, useState, type ReactNode } from "react";
import { autenticarApi, TOKEN_KEY } from "../services/api";

interface AuthCtx {
  autenticado: boolean;
  login: (usuario: string, senha: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));

  async function login(usuario: string, senha: string) {
    const t = await autenticarApi(usuario, senha);
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
  }
  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }

  return <Ctx.Provider value={{ autenticado: !!token, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth fora do AuthProvider");
  return ctx;
}
```

- [ ] **Step 3: `pages/Login.tsx`**

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Alert } from "../components/Alert";
import { extrairMensagemErro } from "../services/api";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      await login(usuario, senha);
      navigate("/");
    } catch (err) {
      setErro(extrairMensagemErro(err));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-bg">
      <form onSubmit={entrar} className="w-full max-w-sm space-y-4 rounded-lg border border-line bg-bg-panel/70 p-6">
        <h1 className="font-display text-xl text-slate-100">Web Security Analyzer</h1>
        <p className="text-sm text-slate-500">Entre para acessar o painel.</p>
        {erro && <Alert tipo="erro">{erro}</Alert>}
        <input value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="Usuário"
          className="w-full rounded-md border border-line bg-bg-raised px-3 py-2 text-sm text-slate-200 outline-none" />
        <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha"
          className="w-full rounded-md border border-line bg-bg-raised px-3 py-2 text-sm text-slate-200 outline-none" />
        <button disabled={carregando} className="w-full rounded-md bg-accent py-2 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-50">
          {carregando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: `components/RotaProtegida.tsx`**

```tsx
import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";

export function RotaProtegida({ children }: { children: ReactNode }) {
  const { autenticado } = useAuth();
  return autenticado ? <>{children}</> : <Navigate to="/login" replace />;
}
```

- [ ] **Step 5: `main.tsx`** — envolver no AuthProvider

```tsx
import { AuthProvider } from "./context/AuthContext";
// ...
<BrowserRouter>
  <AuthProvider>
    <App />
  </AuthProvider>
</BrowserRouter>
```

- [ ] **Step 6: `App.tsx`** — rota pública /login + proteção do resto

```tsx
import { Routes, Route } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { NovaAuditoria } from "./pages/NovaAuditoria";
import { Historico } from "./pages/Historico";
import { VisualizadorRelatorio } from "./pages/VisualizadorRelatorio";
import { Configuracoes } from "./pages/Configuracoes";
import { Monitoramento } from "./pages/Monitoramento";
import { Login } from "./pages/Login";
import { RotaProtegida } from "./components/RotaProtegida";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <RotaProtegida>
            <div className="flex min-h-screen bg-bg">
              <Sidebar />
              <div className="flex-1 flex flex-col min-w-0">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/nova-auditoria" element={<NovaAuditoria />} />
                  <Route path="/historico" element={<Historico />} />
                  <Route path="/auditorias/:id" element={<VisualizadorRelatorio />} />
                  <Route path="/monitoramento" element={<Monitoramento />} />
                  <Route path="/configuracoes" element={<Configuracoes />} />
                </Routes>
              </div>
            </div>
          </RotaProtegida>
        }
      />
    </Routes>
  );
}
```

(Ajustar a lista de rotas internas para refletir as existentes no `App.tsx` atual — manter todas as que já existem.)

- [ ] **Step 7: Sidebar — botão Sair**

Ler `Sidebar.tsx` e adicionar, ao final da navegação, um botão "Sair" que chama `logout()` do `useAuth()` e navega para `/login`, seguindo o estilo existente.

- [ ] **Step 8: `.env.example` do frontend** — garantir `VITE_API_URL="http://localhost:3001/api/v1"`.

- [ ] **Step 9: Build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: sem erros.

- [ ] **Step 10: Commit**

```bash
git add frontend/src frontend/.env.example
git commit -m "feat(auth): login, rota protegida e interceptors no frontend"
```

---

### Task 7: Verificação final

- [ ] `cd backend && npm test` → todos verdes.
- [ ] `cd backend && npx tsc --noEmit` → sem erros.
- [ ] `cd frontend && npm run build` → sucesso.
- [ ] Commit final se necessário.

## Self-Review

**1. Spec coverage:**
- Versionamento `/api/v1` → Task 3 (rotas) + Task 3 Step 5 (index). ✓
- JWT (login via .env) → Task 2 + Task 3. ✓
- Proteção total + login no frontend → Task 3 (middleware) + Task 6. ✓
- Paginação → Task 1. ✓
- Logs de requisição → Task 4. ✓
- OpenAPI/Swagger → Task 5. ✓
- YAGNI (webhooks/postman/refresh/multiusuário) → sem tarefa. ✓

**2. Placeholder scan:** sem TBD/TODO. Task 6 Steps 6/7 instruem preservar/refletir rotas e Sidebar existentes (dependem do estado atual do arquivo), sem nova lógica inventada.

**3. Type consistency:** `Paginacao`/`paginar` (Task 1) reusado em Task 4. `Credenciais`, `gerarToken`/`verificarToken`/`validarCredenciais` (Task 2) consumidos em Task 3. `autenticar` (Task 3) usado nas rotas protegidas (Tasks 3/4). `TOKEN_KEY`/`autenticarApi` (Task 6 Step 1) usados pelo AuthContext (Step 2). `env.jwtSecret/authUsuario/authSenha` consistentes entre env, controller e middleware.
