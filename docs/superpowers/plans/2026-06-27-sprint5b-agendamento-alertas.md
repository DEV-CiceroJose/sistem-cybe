# Sprint 5B — Agendamento & Alertas: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps usam checkbox (`- [ ]`).

**Goal:** Automatizar auditorias recorrentes (node-cron) e gerar alertas in-app quando o estado de segurança de uma URL piora, exibidos num dashboard de monitoramento.

**Architecture:** Serviços puros (`agendamento.service`, `alertas.service`) cobertos por TDD; um `auditoria.runner` extrai a execução de auditoria do controller e gera alertas comparando com a anterior (reusa `comparacao.service` da 5A); um `scheduler` node-cron dispara os agendamentos vencidos.

**Tech Stack:** TypeScript (CommonJS), Express, Prisma/SQLite, node-cron, Vitest, React/Vite.

## Global Constraints

- Linguagem: pt-BR. Padrão de resposta API: `{ sucesso, dados }`. Validação com `zod`.
- `Frequencia = "DIARIA" | "SEMANAL" | "MENSAL"`; `TipoAlerta = "NOVO_ACHADO" | "QUEDA_SCORE" | "QUEDA_CONFORMIDADE"`.
- Limiar de queda de score = 5 (queda `<= -5` dispara).
- Scheduler node-cron de hora em hora (`0 * * * *`); NÃO inicia quando `NODE_ENV === "test"`.
- node-cron é a única dependência nova.
- Testes co-localizados; rodar de `backend/`. Após cada tarefa: suíte verde + commit.

---

### Task 1: agendamento.service (TDD)

**Files:**
- Create: `backend/src/services/agendamento.service.ts`
- Test: `backend/src/services/agendamento.service.test.ts`

**Interfaces:**
- Produces:
  - `type Frequencia = "DIARIA" | "SEMANAL" | "MENSAL"`
  - `calcularProximaExecucao(freq: Frequencia, base: Date): Date`
  - `filtrarVencidos<T extends { ativo: boolean; proximaExecucao: Date }>(lista: T[], agora: Date): T[]`

- [ ] **Step 1: Teste que falha** (`agendamento.service.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { calcularProximaExecucao, filtrarVencidos } from "./agendamento.service";

describe("calcularProximaExecucao", () => {
  const base = new Date("2026-06-27T10:00:00.000Z");
  it("DIARIA soma 1 dia", () => {
    expect(calcularProximaExecucao("DIARIA", base).toISOString()).toBe("2026-06-28T10:00:00.000Z");
  });
  it("SEMANAL soma 7 dias", () => {
    expect(calcularProximaExecucao("SEMANAL", base).toISOString()).toBe("2026-07-04T10:00:00.000Z");
  });
  it("MENSAL soma 1 mês", () => {
    expect(calcularProximaExecucao("MENSAL", base).toISOString()).toBe("2026-07-27T10:00:00.000Z");
  });
  it("não muta a data base", () => {
    const copia = new Date(base);
    calcularProximaExecucao("DIARIA", base);
    expect(base.getTime()).toBe(copia.getTime());
  });
});

describe("filtrarVencidos", () => {
  const agora = new Date("2026-06-27T10:00:00.000Z");
  it("retorna apenas ativos com proximaExecucao <= agora", () => {
    const lista = [
      { ativo: true, proximaExecucao: new Date("2026-06-27T09:00:00.000Z"), id: "vencido" },
      { ativo: true, proximaExecucao: new Date("2026-06-27T11:00:00.000Z"), id: "futuro" },
      { ativo: false, proximaExecucao: new Date("2026-06-27T08:00:00.000Z"), id: "inativo" },
    ];
    expect(filtrarVencidos(lista, agora).map((x) => x.id)).toEqual(["vencido"]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/services/agendamento.service.test.ts`
Expected: FAIL — `Cannot find module './agendamento.service'`.

- [ ] **Step 3: Implementar `agendamento.service.ts`**

```ts
export type Frequencia = "DIARIA" | "SEMANAL" | "MENSAL";

export function calcularProximaExecucao(freq: Frequencia, base: Date): Date {
  const d = new Date(base);
  if (freq === "DIARIA") d.setDate(d.getDate() + 1);
  else if (freq === "SEMANAL") d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

export function filtrarVencidos<T extends { ativo: boolean; proximaExecucao: Date }>(
  lista: T[],
  agora: Date,
): T[] {
  return lista.filter((a) => a.ativo && a.proximaExecucao.getTime() <= agora.getTime());
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx vitest run src/services/agendamento.service.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/agendamento.service.ts backend/src/services/agendamento.service.test.ts
git commit -m "test(agendamento): próxima execução e vencidos via TDD"
```

---

### Task 2: alertas.service (TDD)

**Files:**
- Modify: `backend/src/types/scanner.types.ts` (tipos de alerta)
- Create: `backend/src/services/alertas.service.ts`
- Test: `backend/src/services/alertas.service.test.ts`

**Interfaces:**
- Consumes: `ComparacaoResultado` de `../types/scanner.types` (5A).
- Produces:
  - `type TipoAlerta = "NOVO_ACHADO" | "QUEDA_SCORE" | "QUEDA_CONFORMIDADE"`
  - `interface AlertaGerado { tipo: TipoAlerta; mensagem: string }`
  - `interface OpcoesAlerta { limiarScore?: number }`
  - `gerarAlertas(comparacao: ComparacaoResultado, opts?: OpcoesAlerta): AlertaGerado[]`

- [ ] **Step 1: Adicionar tipos** em `backend/src/types/scanner.types.ts` (ao final)

```ts
export type TipoAlerta = "NOVO_ACHADO" | "QUEDA_SCORE" | "QUEDA_CONFORMIDADE";

export interface AlertaGerado {
  tipo: TipoAlerta;
  mensagem: string;
}
```

- [ ] **Step 2: Teste que falha** (`alertas.service.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { gerarAlertas } from "./alertas.service";
import type { ComparacaoResultado } from "../types/scanner.types";

function comp(p: Partial<ComparacaoResultado>): ComparacaoResultado {
  return {
    baseId: "ant", atualId: "atu",
    scoreAnterior: 80, scoreAtual: 80, scoreDelta: 0,
    conformidadeAnterior: 90, conformidadeAtual: 90, conformidadeDelta: 0,
    novos: [], resolvidos: [], mantidos: [],
    ...p,
  };
}

describe("gerarAlertas", () => {
  it("gera NOVO_ACHADO quando há novos", () => {
    const a = gerarAlertas(comp({ novos: [{ refId: "x", titulo: "X", severidade: "ALTA" }] }));
    expect(a.some((x) => x.tipo === "NOVO_ACHADO")).toBe(true);
  });
  it("não gera NOVO_ACHADO sem novos", () => {
    expect(gerarAlertas(comp({})).some((x) => x.tipo === "NOVO_ACHADO")).toBe(false);
  });
  it("gera QUEDA_SCORE quando scoreDelta <= -limiar (default 5)", () => {
    expect(gerarAlertas(comp({ scoreAnterior: 80, scoreAtual: 70, scoreDelta: -10 })).some((x) => x.tipo === "QUEDA_SCORE")).toBe(true);
  });
  it("não gera QUEDA_SCORE para queda menor que o limiar", () => {
    expect(gerarAlertas(comp({ scoreDelta: -3 })).some((x) => x.tipo === "QUEDA_SCORE")).toBe(false);
  });
  it("respeita limiarScore custom", () => {
    expect(gerarAlertas(comp({ scoreDelta: -3 }), { limiarScore: 2 }).some((x) => x.tipo === "QUEDA_SCORE")).toBe(true);
  });
  it("gera QUEDA_CONFORMIDADE quando conformidadeDelta < 0", () => {
    expect(gerarAlertas(comp({ conformidadeDelta: -5 })).some((x) => x.tipo === "QUEDA_CONFORMIDADE")).toBe(true);
  });
  it("estável => nenhum alerta", () => {
    expect(gerarAlertas(comp({}))).toEqual([]);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/services/alertas.service.test.ts`
Expected: FAIL — `Cannot find module './alertas.service'`.

- [ ] **Step 4: Implementar `alertas.service.ts`**

```ts
import type { ComparacaoResultado, AlertaGerado, OpcoesAlerta } from "../types/scanner.types";

export function gerarAlertas(
  comparacao: ComparacaoResultado,
  opts: OpcoesAlerta = {},
): AlertaGerado[] {
  const limiarScore = opts.limiarScore ?? 5;
  const alertas: AlertaGerado[] = [];

  if (comparacao.novos.length > 0) {
    alertas.push({
      tipo: "NOVO_ACHADO",
      mensagem: `${comparacao.novos.length} novo(s) achado(s) de segurança detectado(s).`,
    });
  }
  if (comparacao.scoreDelta <= -limiarScore) {
    alertas.push({
      tipo: "QUEDA_SCORE",
      mensagem: `Score caiu de ${comparacao.scoreAnterior} para ${comparacao.scoreAtual} (${comparacao.scoreDelta}).`,
    });
  }
  if (comparacao.conformidadeDelta < 0) {
    alertas.push({
      tipo: "QUEDA_CONFORMIDADE",
      mensagem: `Conformidade caiu de ${comparacao.conformidadeAnterior}% para ${comparacao.conformidadeAtual}%.`,
    });
  }
  return alertas;
}
```

Nota: `OpcoesAlerta` é exportada por este arquivo — adicionar no topo:
`export interface OpcoesAlerta { limiarScore?: number }`
(e remover do import o que não existir; manter import só de `ComparacaoResultado`, `AlertaGerado`). Ajuste final do arquivo:

```ts
import type { ComparacaoResultado, AlertaGerado } from "../types/scanner.types";

export interface OpcoesAlerta {
  limiarScore?: number;
}
```
(use esta forma; `OpcoesAlerta` vive aqui, não em scanner.types.)

- [ ] **Step 5: Rodar e ver passar**

Run: `cd backend && npx vitest run src/services/alertas.service.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 6: Commit**

```bash
git add backend/src/types/scanner.types.ts backend/src/services/alertas.service.ts backend/src/services/alertas.service.test.ts
git commit -m "test(alertas): gerarAlertas via TDD"
```

---

### Task 3: Prisma + auditoria.runner (extrai do controller, gera alertas)

**Files:**
- Modify: `backend/prisma/schema.prisma` (Agendamento, Alerta, enums)
- Create: `backend/src/services/auditoria.runner.ts`
- Modify: `backend/src/controllers/auditoria.controller.ts` (usar o runner)

**Interfaces:**
- Consumes: `executarScan`, `calcularScore`, `gerarRelatorioMarkdown`, `compararAuditorias`, `avaliarConformidade`, `gerarAlertas`, `DNS_VAZIO`.
- Produces: `executarAuditoriaCompleta(url: string): Promise<string>` (retorna o id da auditoria).

- [ ] **Step 1: Schema Prisma** — `backend/prisma/schema.prisma` (ao final, após `Configuracao`)

```prisma
enum Frequencia {
  DIARIA
  SEMANAL
  MENSAL
}

enum TipoAlerta {
  NOVO_ACHADO
  QUEDA_SCORE
  QUEDA_CONFORMIDADE
}

model Agendamento {
  id              String     @id @default(uuid())
  url             String
  frequencia      Frequencia
  ativo           Boolean    @default(true)
  ultimaExecucao  DateTime?
  proximaExecucao DateTime
  criadoEm        DateTime   @default(now())

  @@index([ativo])
}

model Alerta {
  id          String     @id @default(uuid())
  url         String
  tipo        TipoAlerta
  mensagem    String
  lido        Boolean    @default(false)
  auditoriaId String?
  criadoEm    DateTime   @default(now())

  @@index([lido])
  @@index([criadoEm])
}
```

- [ ] **Step 2: Regenerar Prisma + criar migração**

Run: `cd backend && npx prisma migrate dev --name agendamento_alerta` (ou, se migrate não estiver configurado, `npx prisma db push`); depois `npx prisma generate`.
Expected: tabelas criadas; client regenerado.

- [ ] **Step 3: Implementar `auditoria.runner.ts`**

Extrair a lógica de `criarAuditoria`. Conteúdo:

```ts
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../database/prisma";
import { executarScan, ScanError } from "../scanner";
import { calcularScore } from "./scoring.service";
import { gerarRelatorioMarkdown } from "../reports/markdown.report";
import { avaliarConformidade } from "./conformidade.service";
import { compararAuditorias } from "./comparacao.service";
import { gerarAlertas } from "./alertas.service";
import { DNS_VAZIO } from "../scanner/dns.scanner";
import type { AuditoriaComparavel } from "../types/scanner.types";

const RELATORIOS_DIR = path.join(process.cwd(), "relatorios");

function comparavelDe(auditoria: any): AuditoriaComparavel {
  const resultado = {
    https: JSON.parse(auditoria.resultado.https),
    headers: JSON.parse(auditoria.resultado.headers),
    cookies: JSON.parse(auditoria.resultado.cookies),
    exposicao: JSON.parse(auditoria.resultado.exposicao),
    tecnologias: JSON.parse(auditoria.resultado.tecnologias),
    performance: JSON.parse(auditoria.resultado.performance),
    cors: JSON.parse(auditoria.resultado.cors || '{"accessControlAllowOrigin":null,"accessControlAllowCredentials":false}'),
    dns: JSON.parse(auditoria.resultado.dns || JSON.stringify(DNS_VAZIO)),
  };
  return {
    id: auditoria.id,
    score: auditoria.score ?? 0,
    conformidadePercentual: avaliarConformidade(resultado as any).percentual,
    vulnerabilidades: JSON.parse(auditoria.resultado.vulnerabilidades || "[]"),
  };
}

async function gerarAlertasDaAuditoria(auditoriaId: string, url: string): Promise<void> {
  const atual = await prisma.auditoria.findUnique({ where: { id: auditoriaId }, include: { resultado: true } });
  if (!atual || !atual.resultado) return;
  const anterior = await prisma.auditoria.findFirst({
    where: { url, status: "CONCLUIDA", criadoEm: { lt: atual.criadoEm }, resultado: { isNot: null } },
    orderBy: { criadoEm: "desc" },
    include: { resultado: true },
  });
  if (!anterior || !anterior.resultado) return;

  const comparacao = compararAuditorias(comparavelDe(anterior), comparavelDe(atual));
  const alertas = gerarAlertas(comparacao);
  if (alertas.length === 0) return;
  await prisma.alerta.createMany({
    data: alertas.map((a) => ({ url, tipo: a.tipo, mensagem: a.mensagem, auditoriaId })),
  });
}

/** Executa o scan completo de uma URL, persiste e gera alertas. Retorna o id da auditoria. */
export async function executarAuditoriaCompleta(url: string): Promise<string> {
  const auditoria = await prisma.auditoria.create({ data: { url, status: "EM_ANDAMENTO" } });

  try {
    const { resultado, urlFinal } = await executarScan(url);
    const scoreFinal = calcularScore(resultado);
    const markdown = gerarRelatorioMarkdown(urlFinal, resultado, scoreFinal);

    await fs.mkdir(RELATORIOS_DIR, { recursive: true });
    const nomeArquivo = `relatorio-${auditoria.id}.md`;
    await fs.writeFile(path.join(RELATORIOS_DIR, nomeArquivo), markdown, "utf-8");

    await prisma.$transaction([
      prisma.resultado.create({
        data: {
          auditoriaId: auditoria.id,
          https: JSON.stringify(resultado.https),
          headers: JSON.stringify(resultado.headers),
          cookies: JSON.stringify(resultado.cookies),
          exposicao: JSON.stringify(resultado.exposicao),
          tecnologias: JSON.stringify(resultado.tecnologias),
          performance: JSON.stringify(resultado.performance),
          scoreDetalhe: JSON.stringify(scoreFinal.categorias),
          vulnerabilidades: JSON.stringify(scoreFinal.vulnerabilidades),
          cors: JSON.stringify(resultado.cors),
          dns: JSON.stringify(resultado.dns),
        },
      }),
      prisma.relatorio.create({
        data: { auditoriaId: auditoria.id, caminhoArquivo: nomeArquivo, conteudoMarkdown: markdown },
      }),
      prisma.auditoria.update({
        where: { id: auditoria.id },
        data: {
          status: "CONCLUIDA",
          score: scoreFinal.score,
          classificacao: scoreFinal.classificacao,
          concluidoEm: new Date(),
        },
      }),
    ]);

    await gerarAlertasDaAuditoria(auditoria.id, url);
    return auditoria.id;
  } catch (e) {
    const mensagem = e instanceof ScanError ? e.message : "Erro inesperado ao executar a análise.";
    await prisma.auditoria.update({ where: { id: auditoria.id }, data: { status: "ERRO", erro: mensagem } });
    throw e;
  }
}
```

- [ ] **Step 4: Refatorar `criarAuditoria`** — `backend/src/controllers/auditoria.controller.ts`

Substituir o corpo de `criarAuditoria` (do `const auditoria = await prisma.auditoria.create(...)` até o `catch`) para delegar ao runner, mantendo a validação/normalização da URL e a resposta serializada:

```ts
export async function criarAuditoria(req: Request, res: Response) {
  const parse = criarAuditoriaSchema.safeParse(req.body);
  if (!parse.success) {
    throw new HttpError(400, parse.error.issues[0]?.message || "Dados inválidos.");
  }

  let { url } = parse.data;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  try {
    const id = await executarAuditoriaCompleta(url);
    const auditoriaFinal = await prisma.auditoria.findUnique({
      where: { id },
      include: { resultado: true, relatorio: true },
    });
    res.status(201).json({ sucesso: true, dados: serializarAuditoria(auditoriaFinal) });
  } catch (e) {
    const mensagem = e instanceof ScanError ? e.message : "Erro inesperado ao executar a análise.";
    throw new HttpError(e instanceof ScanError ? 422 : 500, mensagem);
  }
}
```

Adicionar import: `import { executarAuditoriaCompleta } from "../services/auditoria.runner";`
Remover imports agora não usados em `criarAuditoria` SOMENTE se não forem usados em outro lugar do arquivo (atenção: `gerarRelatorioMarkdown`, `fs`, `path`, `calcularScore` podem ficar órfãos — verificar e remover apenas os realmente não usados; `executarScan`/`ScanError` ainda é usado via tipo `ScanError`).

- [ ] **Step 5: Verificação**

Run: `cd backend && npx tsc --noEmit && npm test`
Expected: tsc sem erros (remover imports órfãos se acusados por `noUnusedLocals` — está `false`, então não falha, mas limpar mesmo assim); testes passam.

- [ ] **Step 6: Commit**

```bash
git add backend/prisma backend/src
git commit -m "feat(runner): executarAuditoriaCompleta com geração de alertas"
```

---

### Task 4: scheduler (node-cron) + start no index

**Files:**
- Create: `backend/src/scheduler.ts`
- Modify: `backend/src/index.ts`
- Modify: `backend/package.json` (dependência node-cron)

- [ ] **Step 1: Instalar node-cron**

Run: `cd backend && npm i node-cron && npm i -D @types/node-cron`
Expected: adicionadas as dependências.

- [ ] **Step 2: Implementar `scheduler.ts`**

```ts
import cron from "node-cron";
import { prisma } from "./database/prisma";
import { filtrarVencidos, calcularProximaExecucao } from "./services/agendamento.service";
import { executarAuditoriaCompleta } from "./services/auditoria.runner";

export async function executarAgendamentosVencidos(agora = new Date()): Promise<void> {
  const ativos = await prisma.agendamento.findMany({ where: { ativo: true } });
  const vencidos = filtrarVencidos(ativos, agora);
  for (const ag of vencidos) {
    try {
      await executarAuditoriaCompleta(ag.url);
    } catch (e) {
      console.error(`[scheduler] Falha ao auditar ${ag.url}:`, (e as Error).message);
    }
    await prisma.agendamento.update({
      where: { id: ag.id },
      data: { ultimaExecucao: agora, proximaExecucao: calcularProximaExecucao(ag.frequencia, agora) },
    });
  }
}

export function iniciarScheduler(): void {
  cron.schedule("0 * * * *", () => {
    executarAgendamentosVencidos().catch((e) => console.error("[scheduler]", e));
  });
  console.log("[scheduler] Agendador de auditorias iniciado (de hora em hora).");
}
```

- [ ] **Step 3: Iniciar no `index.ts`** — adicionar após `app.listen(...)`:

```ts
import { iniciarScheduler } from "./scheduler";
// ...
if (env.nodeEnv !== "test") {
  iniciarScheduler();
}
```
(import no topo junto aos demais.)

- [ ] **Step 4: Verificação**

Run: `cd backend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add backend/src/scheduler.ts backend/src/index.ts backend/package.json backend/package-lock.json
git commit -m "feat(scheduler): execução agendada com node-cron"
```

---

### Task 5: API de agendamentos e alertas

**Files:**
- Create: `backend/src/controllers/agendamento.controller.ts`
- Create: `backend/src/controllers/alerta.controller.ts`
- Create: `backend/src/routes/agendamento.routes.ts`
- Create: `backend/src/routes/alerta.routes.ts`
- Modify: `backend/src/routes/index.ts`

- [ ] **Step 1: `agendamento.controller.ts`**

```ts
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../database/prisma";
import { calcularProximaExecucao } from "../services/agendamento.service";
import { HttpError } from "../middlewares/error.middleware";

const criarSchema = z.object({
  url: z.string().min(1).max(2048),
  frequencia: z.enum(["DIARIA", "SEMANAL", "MENSAL"]),
});
const atualizarSchema = z.object({
  ativo: z.boolean().optional(),
  frequencia: z.enum(["DIARIA", "SEMANAL", "MENSAL"]).optional(),
});

export async function criarAgendamento(req: Request, res: Response) {
  const parse = criarSchema.safeParse(req.body);
  if (!parse.success) throw new HttpError(400, parse.error.issues[0]?.message || "Dados inválidos.");
  let { url, frequencia } = parse.data;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  const ag = await prisma.agendamento.create({
    data: { url, frequencia, proximaExecucao: calcularProximaExecucao(frequencia, new Date()) },
  });
  res.status(201).json({ sucesso: true, dados: ag });
}

export async function listarAgendamentos(_req: Request, res: Response) {
  const dados = await prisma.agendamento.findMany({ orderBy: { criadoEm: "desc" } });
  res.json({ sucesso: true, dados });
}

export async function atualizarAgendamento(req: Request, res: Response) {
  const parse = atualizarSchema.safeParse(req.body);
  if (!parse.success) throw new HttpError(400, parse.error.issues[0]?.message || "Dados inválidos.");
  const existente = await prisma.agendamento.findUnique({ where: { id: req.params.id } });
  if (!existente) throw new HttpError(404, "Agendamento não encontrado.");
  const data: any = { ...parse.data };
  if (parse.data.frequencia) data.proximaExecucao = calcularProximaExecucao(parse.data.frequencia, new Date());
  const ag = await prisma.agendamento.update({ where: { id: req.params.id }, data });
  res.json({ sucesso: true, dados: ag });
}

export async function excluirAgendamento(req: Request, res: Response) {
  const existente = await prisma.agendamento.findUnique({ where: { id: req.params.id } });
  if (!existente) throw new HttpError(404, "Agendamento não encontrado.");
  await prisma.agendamento.delete({ where: { id: req.params.id } });
  res.json({ sucesso: true });
}
```

- [ ] **Step 2: `alerta.controller.ts`**

```ts
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../database/prisma";
import { HttpError } from "../middlewares/error.middleware";

const lidoSchema = z.object({ lido: z.boolean() });

export async function listarAlertas(req: Request, res: Response) {
  const limite = Math.min(Number(req.query.limite) || 50, 200);
  const where = req.query.lido === "false" ? { lido: false } : req.query.lido === "true" ? { lido: true } : undefined;
  const dados = await prisma.alerta.findMany({ where, orderBy: { criadoEm: "desc" }, take: limite });
  res.json({ sucesso: true, dados });
}

export async function marcarAlertaLido(req: Request, res: Response) {
  const parse = lidoSchema.safeParse(req.body);
  if (!parse.success) throw new HttpError(400, "Dados inválidos.");
  const existente = await prisma.alerta.findUnique({ where: { id: req.params.id } });
  if (!existente) throw new HttpError(404, "Alerta não encontrado.");
  const dados = await prisma.alerta.update({ where: { id: req.params.id }, data: { lido: parse.data.lido } });
  res.json({ sucesso: true, dados });
}

export async function marcarAlertasLidos(_req: Request, res: Response) {
  await prisma.alerta.updateMany({ where: { lido: false }, data: { lido: true } });
  res.json({ sucesso: true });
}
```

- [ ] **Step 3: Rotas** — `agendamento.routes.ts`

```ts
import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { criarAgendamento, listarAgendamentos, atualizarAgendamento, excluirAgendamento } from "../controllers/agendamento.controller";

export const agendamentoRouter = Router();
agendamentoRouter.post("/", asyncHandler(criarAgendamento));
agendamentoRouter.get("/", asyncHandler(listarAgendamentos));
agendamentoRouter.patch("/:id", asyncHandler(atualizarAgendamento));
agendamentoRouter.delete("/:id", asyncHandler(excluirAgendamento));
```

`alerta.routes.ts`

```ts
import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { listarAlertas, marcarAlertaLido, marcarAlertasLidos } from "../controllers/alerta.controller";

export const alertaRouter = Router();
alertaRouter.get("/", asyncHandler(listarAlertas));
alertaRouter.post("/marcar-lidos", asyncHandler(marcarAlertasLidos));
alertaRouter.patch("/:id", asyncHandler(marcarAlertaLido));
```

- [ ] **Step 4: Registrar** — `backend/src/routes/index.ts`

```ts
import { agendamentoRouter } from "./agendamento.routes";
import { alertaRouter } from "./alerta.routes";
// ...
router.use("/agendamentos", agendamentoRouter);
router.use("/alertas", alertaRouter);
```

- [ ] **Step 5: Verificação**

Run: `cd backend && npx tsc --noEmit && npm test`
Expected: tsc sem erros; testes passam.

- [ ] **Step 6: Commit**

```bash
git add backend/src
git commit -m "feat(api): endpoints de agendamentos e alertas"
```

---

### Task 6: Frontend — dashboard de monitoramento

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/services/api.ts`
- Create: `frontend/src/components/AlertasPanel.tsx`
- Create: `frontend/src/components/AgendamentosManager.tsx`
- Modify: `frontend/src/pages/Monitoramento.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`

- [ ] **Step 1: Tipos** — `frontend/src/types/index.ts` (ao final)

```ts
export type Frequencia = "DIARIA" | "SEMANAL" | "MENSAL";
export type TipoAlerta = "NOVO_ACHADO" | "QUEDA_SCORE" | "QUEDA_CONFORMIDADE";

export interface Agendamento {
  id: string;
  url: string;
  frequencia: Frequencia;
  ativo: boolean;
  ultimaExecucao: string | null;
  proximaExecucao: string;
  criadoEm: string;
}

export interface Alerta {
  id: string;
  url: string;
  tipo: TipoAlerta;
  mensagem: string;
  lido: boolean;
  auditoriaId: string | null;
  criadoEm: string;
}
```

- [ ] **Step 2: API** — `frontend/src/services/api.ts` (adicionar)

```ts
import type { Agendamento, Alerta, Frequencia } from "../types";

export async function listarAgendamentos(): Promise<Agendamento[]> {
  const { data } = await api.get("/agendamentos");
  return data.dados;
}
export async function criarAgendamento(url: string, frequencia: Frequencia): Promise<Agendamento> {
  const { data } = await api.post("/agendamentos", { url, frequencia });
  return data.dados;
}
export async function atualizarAgendamento(id: string, payload: { ativo?: boolean; frequencia?: Frequencia }): Promise<Agendamento> {
  const { data } = await api.patch(`/agendamentos/${id}`, payload);
  return data.dados;
}
export async function excluirAgendamento(id: string): Promise<void> {
  await api.delete(`/agendamentos/${id}`);
}
export async function listarAlertas(lido?: boolean): Promise<Alerta[]> {
  const { data } = await api.get("/alertas", { params: lido === undefined ? {} : { lido } });
  return data.dados;
}
export async function marcarAlertaLido(id: string, lido: boolean): Promise<void> {
  await api.patch(`/alertas/${id}`, { lido });
}
export async function marcarAlertasLidos(): Promise<void> {
  await api.post("/alertas/marcar-lidos");
}
```

(Se já existir um import de tipos de `../types`, juntar os novos nele.)

- [ ] **Step 3: `AlertasPanel.tsx`**

```tsx
import { useEffect, useState } from "react";
import type { Alerta } from "../types";
import { Card } from "./Card";
import { listarAlertas, marcarAlertaLido, marcarAlertasLidos } from "../services/api";

const ROTULO: Record<Alerta["tipo"], string> = {
  NOVO_ACHADO: "Novo achado",
  QUEDA_SCORE: "Queda de score",
  QUEDA_CONFORMIDADE: "Queda de conformidade",
};

export function AlertasPanel() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);

  async function carregar() {
    setAlertas(await listarAlertas());
  }
  useEffect(() => { carregar().catch(() => {}); }, []);

  async function marcar(id: string) {
    await marcarAlertaLido(id, true);
    await carregar();
  }
  async function marcarTodos() {
    await marcarAlertasLidos();
    await carregar();
  }

  const naoLidos = alertas.filter((a) => !a.lido);

  return (
    <Card title={`Alertas (${naoLidos.length} não lido(s))`} action={
      naoLidos.length > 0 ? <button onClick={marcarTodos} className="text-xs text-accent hover:underline">Marcar todos como lidos</button> : undefined
    }>
      {alertas.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum alerta.</p>
      ) : (
        <div className="space-y-2">
          {alertas.map((a) => (
            <div key={a.id} className={`flex items-start gap-3 rounded-lg border border-line p-2.5 ${a.lido ? "opacity-50" : "bg-bg-raised/40"}`}>
              <span className="text-xs text-warn">{ROTULO[a.tipo]}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-200">{a.mensagem}</p>
                <p className="text-[11px] text-slate-500">{a.url} · {new Date(a.criadoEm).toLocaleString("pt-BR")}</p>
              </div>
              {!a.lido && <button onClick={() => marcar(a.id)} className="text-[11px] text-accent hover:underline">marcar lido</button>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 4: `AgendamentosManager.tsx`**

```tsx
import { useEffect, useState } from "react";
import type { Agendamento, Frequencia } from "../types";
import { Card } from "./Card";
import { listarAgendamentos, criarAgendamento, atualizarAgendamento, excluirAgendamento } from "../services/api";

const FREQ: { valor: Frequencia; rotulo: string }[] = [
  { valor: "DIARIA", rotulo: "Diária" },
  { valor: "SEMANAL", rotulo: "Semanal" },
  { valor: "MENSAL", rotulo: "Mensal" },
];

export function AgendamentosManager() {
  const [lista, setLista] = useState<Agendamento[]>([]);
  const [url, setUrl] = useState("");
  const [frequencia, setFrequencia] = useState<Frequencia>("SEMANAL");

  async function carregar() { setLista(await listarAgendamentos()); }
  useEffect(() => { carregar().catch(() => {}); }, []);

  async function adicionar() {
    if (!url.trim()) return;
    await criarAgendamento(url.trim(), frequencia);
    setUrl("");
    await carregar();
  }

  return (
    <Card title="Agendamentos">
      <div className="mb-4 flex flex-wrap gap-2">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="exemplo.com"
          className="flex-1 rounded-md border border-line bg-bg-raised px-3 py-1.5 text-sm text-slate-200 outline-none placeholder:text-slate-600" />
        <select value={frequencia} onChange={(e) => setFrequencia(e.target.value as Frequencia)}
          className="rounded-md border border-line bg-bg-raised px-3 py-1.5 text-sm text-slate-200 outline-none">
          {FREQ.map((f) => <option key={f.valor} value={f.valor}>{f.rotulo}</option>)}
        </select>
        <button onClick={adicionar} className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-bg hover:opacity-90">Agendar</button>
      </div>
      {lista.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum agendamento.</p>
      ) : (
        <div className="space-y-2">
          {lista.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-bg-raised/40 p-2.5 text-sm">
              <span className="text-slate-200">{a.url}</span>
              <span className="text-xs text-slate-500">{a.frequencia.toLowerCase()}</span>
              <span className="text-[11px] text-slate-500">próxima: {new Date(a.proximaExecucao).toLocaleString("pt-BR")}</span>
              <div className="ml-auto flex items-center gap-3">
                <button onClick={async () => { await atualizarAgendamento(a.id, { ativo: !a.ativo }); await carregar(); }}
                  className={`text-xs ${a.ativo ? "text-ok" : "text-slate-500"} hover:underline`}>
                  {a.ativo ? "ativo" : "inativo"}
                </button>
                <button onClick={async () => { await excluirAgendamento(a.id); await carregar(); }} className="text-xs text-danger hover:underline">excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 5: Integrar no `Monitoramento.tsx`** — adicionar os dois painéis no topo do `<main>`, antes do loop de evolução:

```tsx
import { AlertasPanel } from "../components/AlertasPanel";
import { AgendamentosManager } from "../components/AgendamentosManager";
// ...
// no início do conteúdo do <main>, antes/junto das seções:
<AlertasPanel />
<AgendamentosManager />
```

- [ ] **Step 6: Badge na Sidebar** — `frontend/src/components/Sidebar.tsx`

Ler o arquivo e, no item de navegação "Monitoramento", adicionar um badge com a contagem de alertas não lidos: buscar via `listarAlertas(false)` num `useEffect` e exibir `lista.length` num `<span>` quando `> 0`, seguindo o estilo visual existente da Sidebar. (Importar `useEffect`/`useState` e `listarAlertas` conforme necessário.)

- [ ] **Step 7: Build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: sem erros; build conclui.

- [ ] **Step 8: Commit**

```bash
git add frontend/src
git commit -m "feat(monitoramento): dashboard de alertas e agendamentos"
```

---

### Task 7: Verificação final

- [ ] `cd backend && npm test` → todos verdes.
- [ ] `cd backend && npx tsc --noEmit` → sem erros.
- [ ] `cd frontend && npm run build` → sucesso.
- [ ] Commit final se necessário.

## Self-Review

**1. Spec coverage:**
- Agendamento diário/semanal/mensal → Task 1 (cálculo) + Task 3 (modelo) + Task 5 (API) + Task 6 (UI). ✓
- Scheduler automático → Task 4. ✓
- Alertas (novos/queda score/queda conformidade) → Task 2 + Task 3 (persistência). ✓
- Histórico/comparação reuso → Task 3 (comparacao.service da 5A). ✓
- Dashboard de monitoramento → Task 6. ✓
- Notificações in-app + badge → Task 6. ✓
- YAGNI (e-mail, SSL expiry, retenção) → sem tarefa. ✓

**2. Placeholder scan:** sem TBD/TODO. Task 6 Step 6 (Sidebar) instrui ler e replicar o padrão existente — depende do layout atual, sem nova lógica. Task 3 Step 2 oferece `migrate dev` ou `db push` conforme o ambiente.

**3. Type consistency:** `Frequencia`/`TipoAlerta` iguais no Prisma, backend e frontend. `AlertaGerado`/`OpcoesAlerta` em `alertas.service`; `gerarAlertas(comparacao, opts?)` consome `ComparacaoResultado` (5A). `executarAuditoriaCompleta(url): Promise<string>` consistente entre runner, controller e scheduler. `calcularProximaExecucao`/`filtrarVencidos` consistentes entre service, scheduler e controllers.
