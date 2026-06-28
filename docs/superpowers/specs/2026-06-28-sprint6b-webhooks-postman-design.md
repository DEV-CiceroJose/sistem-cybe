# Sprint 6B — Webhooks & Postman (Design / Spec)

**Data:** 2026-06-28
**Autor:** Cícero José (DEV-CiceroJose) + Claude
**Status:** Aguardando revisão do usuário

## Contexto

Segunda metade da Sprint 6 (a 6A entregou versionamento/JWT/paginação/logs/Swagger).
A 6B adiciona webhooks de conclusão de auditoria e a coleção Postman.

## Objetivo

Notificar sistemas externos quando uma auditoria conclui (webhooks assinados) e
disponibilizar uma coleção Postman gerada a partir do OpenAPI.

## Decisões aprovadas

- **Assinatura:** HMAC SHA-256 (header `X-WSA-Signature`), com `secret` por webhook.
- **Entrega:** registrar `WebhookEntrega` (status/HTTP) + **1 retentativa** em falha.
- **Postman:** `GET /api/v1/postman` gera a coleção a partir do OpenAPI; snapshot em `docs/postman/`.

## Escopo

### No escopo
- Tabelas `Webhook` e `WebhookEntrega` (Prisma).
- `webhook.service.ts` (`construirPayloadWebhook`, `assinarPayload`) — TDD.
- `webhook.dispatcher.ts` (`dispararWebhooks`) — rede, 1 retentativa, grava entregas.
- Integração no `auditoria.runner` (dispara ao concluir, fire-and-forget).
- API `/webhooks` (CRUD + entregas).
- `postman.ts` (`gerarColecaoPostman`) — TDD + `GET /api/v1/postman` + snapshot `docs/postman/colecao.json`.
- Frontend: `WebhooksManager` em Configurações + link de download do Postman.

### Fora do escopo (YAGNI)
- Múltiplos tipos de evento (só `auditoria.concluida`).
- Backoff/fila/retentativas múltiplas.
- Verificação SSRF nos webhooks (são destinos externos intencionais do admin).
- Edição de URL do webhook (apenas criar/excluir/ativar).

## Arquitetura

```
auditoria.runner.executarAuditoriaCompleta(url)
   └─ ao CONCLUIR: dispararWebhooks(auditoriaId)  (fire-and-forget)
        ├─ busca Webhook ativos
        ├─ construirPayloadWebhook(auditoria) → corpo JSON
        ├─ assinarPayload(corpo, secret) → X-WSA-Signature
        ├─ POST url (1 retentativa em falha)
        └─ grava WebhookEntrega (status, httpStatus, tentativas, erro)

GET /api/v1/postman → gerarColecaoPostman(openapiDocumento) → coleção v2.1
API /webhooks: POST/GET/PATCH/DELETE + GET /:id/entregas
Frontend: Configuracoes → WebhooksManager + link Postman
```

### Unidades

| Arquivo (backend) | Responsabilidade |
|---|---|
| `services/webhook.service.ts` | `construirPayloadWebhook`, `assinarPayload` (puros). |
| `services/webhook.dispatcher.ts` | `dispararWebhooks` (rede + persistência de entregas). |
| `services/postman.ts` | `gerarColecaoPostman(openapi)` (puro). |
| `controllers/webhook.controller.ts` | CRUD + entregas. |
| `controllers/postman.controller.ts` | `baixarPostman`. |
| `routes/webhook.routes.ts`, `routes/postman.routes.ts` | rotas. |
| `scripts/gerar-postman.ts` | gera o snapshot `docs/postman/colecao.json`. |

| Arquivo (frontend) | Responsabilidade |
|---|---|
| `components/WebhooksManager.tsx` | CRUD de webhooks + download Postman. |
| `pages/Configuracoes.tsx` | inclui o WebhooksManager. |
| `services/api.ts` | funções de webhooks + URL do Postman. |

## Contratos (interfaces)

```ts
// webhook.service.ts
interface PayloadWebhook {
  evento: "auditoria.concluida";
  auditoriaId: string;
  url: string;
  score: number | null;
  classificacao: string | null;
  concluidoEm: string | null;
}
function construirPayloadWebhook(a: {
  id: string; url: string; score: number | null; classificacao: string | null; concluidoEm: Date | null;
}): PayloadWebhook;
function assinarPayload(corpo: string, secret: string): string; // HMAC-SHA256 hex

// webhook.dispatcher.ts
function dispararWebhooks(auditoriaId: string): Promise<void>;

// postman.ts
function gerarColecaoPostman(openapi: Record<string, any>, baseUrl?: string): {
  info: { name: string; schema: string };
  item: Array<{ name: string; request: { method: string; url: string; header?: unknown[] } }>;
};
```

Payload de exemplo (corpo do POST):
```json
{ "evento": "auditoria.concluida", "auditoriaId": "uuid", "url": "https://x.com", "score": 72, "classificacao": "BOA", "concluidoEm": "2026-06-28T10:00:03.000Z" }
```
Headers do POST: `Content-Type: application/json`, `X-WSA-Signature: <hmac-sha256-hex>`, `X-WSA-Event: auditoria.concluida`.

## Modelo de dados (Prisma)

```prisma
model Webhook {
  id        String   @id @default(uuid())
  url       String
  secret    String
  ativo     Boolean  @default(true)
  criadoEm  DateTime @default(now())
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

## Disparo e entrega (`dispararWebhooks`)

1. Busca a auditoria (id, url, score, classificacao, concluidoEm) e os `Webhook` ativos.
2. Para cada webhook: monta `corpo = JSON.stringify(construirPayloadWebhook(...))`,
   assina (`assinarPayload(corpo, secret)`).
3. `POST` com timeout (ex.: 5s). Sucesso = HTTP 2xx.
4. Em falha (erro de rede ou status não-2xx): **1 retentativa**.
5. Grava `WebhookEntrega` com `status` final (SUCESSO/FALHA), `httpStatus`,
   `tentativas` (1 ou 2) e `erro` (se houver).
6. Erros nunca propagam para a auditoria (try/catch global; chamada
   fire-and-forget no runner: `dispararWebhooks(id).catch(...)`).

## API

`/api/v1/webhooks` (protegido):
- `POST` `{ url }` → cria; gera `secret` (hex aleatório) e retorna o webhook
  (incluindo `secret`, para o usuário configurar o receptor).
- `GET` → lista (inclui `secret`).
- `PATCH /:id` `{ ativo }` → ativa/desativa.
- `DELETE /:id` → remove (e suas entregas).
- `GET /:id/entregas?limite&offset` → entregas paginadas.

`/api/v1/postman` (público, como `/docs`):
- `GET` → coleção Postman v2.1 (JSON) com `Content-Disposition: attachment`.

## Postman

- `gerarColecaoPostman(openapi, baseUrl)` percorre `openapi.paths` e cria um
  `item` por método/rota, com `request.method`, `request.url` (baseUrl + path) e,
  para rotas seguras, header `Authorization: Bearer {{token}}`. `info.schema` =
  `https://schema.getpostman.com/json/collection/v2.1.0/collection.json`.
- `scripts/gerar-postman.ts` importa `openapiDocumento` + `gerarColecaoPostman` e
  grava `docs/postman/colecao.json` (rodado uma vez para commitar o snapshot).
- Script npm: `"postman:gen": "tsx scripts/gerar-postman.ts"`.

## Frontend

- `WebhooksManager.tsx` (em Configurações): form com URL → criar; lista com URL,
  `secret` (com botão copiar), toggle ativo, excluir; e um link/botão "Baixar
  coleção Postman" apontando para `${baseURL}/postman`.
- `services/api.ts`: `listarWebhooks`, `criarWebhook(url)`, `atualizarWebhook(id, {ativo})`,
  `excluirWebhook(id)`, e `urlPostman()` (monta a URL absoluta do endpoint).
- Tipos: `Webhook { id; url; secret; ativo; criadoEm }`.

## Tratamento de erros

- Sem webhooks ativos → `dispararWebhooks` não faz nada.
- Falha de entrega → registrada como `WebhookEntrega` FALHA; não afeta a auditoria.
- `POST /webhooks` com URL inválida → 400 (validação zod: `url` http/https).
- `GET /postman` nunca exige token (facilita importar no Postman).

## Estratégia de testes (TDD, Vitest backend)

- `webhook.service`:
  - `construirPayloadWebhook` mapeia campos e `evento` fixo.
  - `assinarPayload` é determinístico para mesmo corpo+secret; muda com secret diferente; é hex de 64 chars.
- `postman.gerarColecaoPostman`:
  - `info.schema` correto; gera um item por operação do OpenAPI; URL inclui baseUrl + path; rota não-pública recebe header Authorization.
- Dispatcher/rotas/script: rede/efeitos — cobertos por `tsc`/build + as peças puras.
  Frontend por `tsc`/build.

## Critérios de sucesso

- [ ] `npm test` (backend) verde, cobrindo `webhook.service` e `postman`.
- [ ] `tsc --noEmit` (backend) e `npm run build` (frontend) sem erros.
- [ ] `POST /webhooks` cria com secret; auditoria concluída dispara POST assinado e grava `WebhookEntrega`.
- [ ] `GET /webhooks/:id/entregas` lista entregas.
- [ ] `GET /api/v1/postman` retorna coleção v2.1; snapshot em `docs/postman/colecao.json`.
- [ ] Configurações gerencia webhooks e baixa o Postman.
- [ ] Sem regressão nas Sprints 1–6A.

## Plano de corte / ordem sugerida

1. `webhook.service.ts` (TDD: payload + assinatura).
2. `postman.ts` (TDD) + `GET /postman` + `scripts/gerar-postman.ts` + snapshot.
3. Prisma (`Webhook`, `WebhookEntrega`) + `webhook.dispatcher.ts` + integração no runner.
4. API `/webhooks` (controller + rotas, CRUD + entregas).
5. Frontend: tipos + serviços + `WebhooksManager` em Configurações.
6. Verificação final.
