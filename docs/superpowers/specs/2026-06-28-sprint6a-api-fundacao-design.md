# Sprint 6A — Fundação da API REST (Design / Spec)

**Data:** 2026-06-28
**Autor:** Cícero José (DEV-CiceroJose) + Claude
**Status:** Aguardando revisão do usuário

## Contexto

A Sprint 6 (API REST) foi decomposta em:
- **6A (esta):** versionamento `/api/v1`, JWT, proteção total + login no frontend, paginação, logs de requisição, OpenAPI/Swagger.
- **6B (depois):** webhooks de conclusão de auditoria + coleção Postman.

## Objetivo (6A)

Transformar a API atual numa API REST versionada e autenticada, com paginação,
logs de requisição e documentação interativa, adicionando login no frontend.

## Decisões aprovadas

- **JWT** com credenciais únicas vindas do `.env` (sem tabela de usuários).
- **Proteger tudo** sob `/api/v1` + **tela de login** no frontend.
- Novas dependências: `jsonwebtoken`, `swagger-ui-express` (+ `@types`).

## Escopo

### No escopo
- `auth.service.ts` (validar credenciais, gerar/verificar JWT) — TDD.
- `auth.middleware.ts` (Bearer obrigatório; 401 caso contrário).
- `POST /api/v1/auth/login`.
- Versionamento: todas as rotas atuais sob `/api/v1`, protegidas por JWT
  (exceto `auth/login`, `health`, `docs`).
- Paginação em `GET /auditorias` e `GET /alertas` (`?limite&offset` + `paginacao`).
- Logs de requisição (tabela `RequestLog`) + `GET /api/v1/logs`.
- OpenAPI/Swagger em `/api/v1/docs`.
- Frontend: `AuthContext`, página de Login, rotas protegidas, interceptor axios
  (Bearer + tratamento de 401), `baseURL` → `/api/v1`, botão Sair.

### Fora do escopo (6B / YAGNI)
- Webhooks e coleção Postman (6B).
- Refresh tokens, múltiplos usuários, papéis/permissões.
- Rate-limit por usuário (mantém o limiter global atual).
- Migrar persistência/lógica de negócio (sem mudanças no scanner/scoring).

## Arquitetura

```
POST /api/v1/auth/login  → auth.controller → auth.service.validarCredenciais → gerarToken
                                                                       │
todas as outras /api/v1/* ── auth.middleware (verificarToken) ────────►┤ 401 se inválido
                                                                       ▼
            (auditorias, configuracoes, agendamentos, alertas, logs)  rotas existentes
request log middleware (todas) → grava RequestLog
/api/v1/docs → swagger-ui-express (documento OpenAPI)

Frontend:
  AuthContext(token) → axios interceptor (Bearer / 401→logout)
  /login (público) ; demais rotas exigem token
```

### Unidades

| Arquivo (backend) | Responsabilidade |
|---|---|
| `services/auth.service.ts` | `validarCredenciais`, `gerarToken`, `verificarToken` (injeção de segredo/credenciais). |
| `middlewares/auth.middleware.ts` | Exige e verifica o Bearer; injeta `req` ok ou 401. |
| `middlewares/requestLog.middleware.ts` | Grava `RequestLog` ao final da resposta. |
| `controllers/auth.controller.ts` | `login`. |
| `controllers/log.controller.ts` | `listarLogs` (paginado). |
| `utils/paginacao.ts` | `paginar(query)` → `{ limite, offset }` (puro). |
| `docs/openapi.ts` | Documento OpenAPI (objeto JS). |
| `routes/*` | Reorganizadas sob `/api/v1` em `routes/index.ts`. |

| Arquivo (frontend) | Responsabilidade |
|---|---|
| `context/AuthContext.tsx` | token (localStorage), `login`, `logout`, `autenticado`. |
| `pages/Login.tsx` | formulário de login. |
| `components/RotaProtegida.tsx` | redireciona p/ `/login` se não autenticado. |
| `services/api.ts` | `baseURL=/api/v1`; interceptors (Bearer, 401); `login()`. |

## Contratos (interfaces)

```ts
// auth.service.ts
interface Credenciais { usuario: string; senha: string }
function validarCredenciais(entrada: Credenciais, esperado: Credenciais): boolean;
function gerarToken(segredo: string, expiraEm?: string): string;   // payload { sub: "api" }, default "8h"
function verificarToken(token: string, segredo: string): { sub: string } | null; // null se inválido/expirado

// utils/paginacao.ts
interface Paginacao { limite: number; offset: number }
function paginar(query: { limite?: unknown; offset?: unknown }, limitePadrao?: number, limiteMax?: number): Paginacao;
// limitePadrao 20, limiteMax 100; offset >= 0; valores inválidos caem nos defaults.
```

Respostas paginadas:
```json
{ "sucesso": true, "dados": [ ... ], "paginacao": { "total": 42, "limite": 20, "offset": 0 } }
```

Login:
```
POST /api/v1/auth/login  { "usuario": "...", "senha": "..." }
200 → { "sucesso": true, "dados": { "token": "<jwt>" } }
401 → { "sucesso": false, "erro": "Credenciais inválidas." }
```

## Config (env)

`config/env.ts` adiciona (com defaults de desenvolvimento):
- `jwtSecret` = `JWT_SECRET` (default `"dev-secret-trocar-em-producao"`).
- `authUsuario` = `AUTH_USUARIO` (default `"admin"`).
- `authSenha` = `AUTH_SENHA` (default `"admin"`).
`.env.example` do backend documenta as três variáveis.

## Modelo de dados (Prisma)

```prisma
model RequestLog {
  id         String   @id @default(uuid())
  metodo     String
  caminho    String
  status     Int
  duracaoMs  Int
  criadoEm   DateTime @default(now())
  @@index([criadoEm])
}
```

## Versionamento e proteção

- `routes/index.ts` monta um `apiV1Router` com: `auth` (público), `health`
  (público), `docs` (público) e — após o `auth.middleware` — `auditorias`,
  `configuracoes`, `agendamentos`, `alertas`, `logs`.
- `index.ts` passa a montar `app.use("/api/v1", apiV1Router)`. O caminho `/api`
  antigo é descontinuado (a UI passa a usar `/api/v1`).
- O limiter global (express-rate-limit) e o middleware de log aplicam-se a `/api/v1`.

## Logs de requisição

- `requestLog.middleware`: no evento `res.on("finish")`, grava `RequestLog`
  (método, caminho, status, duração em ms). Falha de gravação é ignorada
  (não afeta a resposta). Não loga o corpo (evita vazar credenciais).
- `GET /api/v1/logs?limite&offset` → lista paginada (protegido).

## OpenAPI / Swagger

- `docs/openapi.ts` exporta um objeto OpenAPI 3.0 mínimo: info, servers
  (`/api/v1`), securityScheme bearer JWT, e os principais paths
  (auth/login, auditorias, alertas, agendamentos, configuracoes, logs).
- `swagger-ui-express` serve em `/api/v1/docs` (público para facilitar consumo).

## Frontend

- `AuthContext`: guarda `token` em `localStorage` (`wsa:token`); expõe
  `autenticado`, `login(usuario, senha)`, `logout()`.
- `api.ts`: `baseURL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1"`;
  request interceptor injeta `Authorization: Bearer` se houver token; response
  interceptor: em 401, limpa token e redireciona para `/login`.
- `RotaProtegida`: envolve as rotas; sem token → `<Navigate to="/login" />`.
- `Login.tsx`: usuário/senha → `login()`; em erro, mostra alerta.
- `Sidebar`: botão "Sair" (logout).
- `App.tsx`: rota pública `/login`; demais dentro de `RotaProtegida`.

## Tratamento de erros

- Token ausente/!= Bearer / inválido / expirado → 401 padrão `{ sucesso:false, erro }`.
- Login inválido → 401.
- `paginar` nunca lança: entradas inválidas caem nos defaults.
- Falha ao gravar `RequestLog` é engolida (log no console).

## Estratégia de testes (TDD, Vitest backend)

- `auth.service`:
  - `validarCredenciais` true para par correto; false para usuário/senha errados.
  - `gerarToken`+`verificarToken` com o mesmo segredo → payload `{ sub:"api" }`.
  - `verificarToken` com segredo errado/token corrompido → `null`.
- `paginacao.paginar`:
  - defaults (sem query); respeita `limite/offset`; clampa `limite` ao máximo;
    valores inválidos/negativos → defaults.
- Middleware/rotas/Swagger/logs: cobertos por `tsc`/build + as peças puras.
  Frontend por `tsc`/build.

## Critérios de sucesso

- [ ] `npm test` (backend) verde, cobrindo `auth.service` e `paginacao`.
- [ ] `tsc --noEmit` (backend) e `npm run build` (frontend) sem erros.
- [ ] `POST /api/v1/auth/login` emite JWT; rotas protegidas exigem Bearer (401 sem).
- [ ] `GET /auditorias`/`/alertas` aceitam `?limite&offset` e retornam `paginacao`.
- [ ] `GET /api/v1/logs` lista logs de requisição.
- [ ] `/api/v1/docs` mostra o Swagger UI.
- [ ] Frontend exige login e funciona após autenticar; botão Sair.
- [ ] Sem regressão na lógica das Sprints 1–5 (testes existentes verdes).

## Plano de corte / ordem sugerida

1. `paginacao.ts` (TDD) + aplicar em `/auditorias` e `/alertas`.
2. `auth.service.ts` (TDD) + `env` (JWT/credenciais) + `.env.example`.
3. `auth.middleware` + `auth.controller`/rota + versionamento `/api/v1` + proteção.
4. `RequestLog` (Prisma) + `requestLog.middleware` + `GET /logs`.
5. `openapi.ts` + Swagger em `/api/v1/docs`.
6. Frontend: AuthContext + Login + RotaProtegida + interceptors + baseURL + Sair.
7. Verificação final.
