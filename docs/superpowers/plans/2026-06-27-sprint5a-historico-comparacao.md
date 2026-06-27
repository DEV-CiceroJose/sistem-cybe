# Sprint 5A — Histórico & Comparação: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps usam checkbox (`- [ ]`).

**Goal:** Comparar uma auditoria com a anterior da mesma URL (score, conformidade, achados) e visualizar a evolução do score por URL.

**Architecture:** `comparacao.service` puro faz o diff entre duas auditorias; a controller busca a anterior e calcula a conformidade de cada lado; o frontend mostra a comparação no visualizador e uma página de Monitoramento com a evolução do score.

**Tech Stack:** TypeScript (CommonJS), Express, Prisma, Vitest, React/Vite (SVG puro p/ gráfico).

## Global Constraints

- Linguagem: pt-BR. Sem novas dependências. Sem novas tabelas.
- Chave de identidade do achado: `\`${refId}|${detalhe ?? ""}\``.
- Diffs ordenados por severidade (`SEVERIDADE_RANK` de `vulnerabilidades.catalog`).
- Testes co-localizados; rodar de `backend/`. Após cada tarefa: suíte verde + commit.

---

### Task 1: comparacao.service (TDD)

**Files:**
- Modify: `backend/src/types/scanner.types.ts` (tipos de comparação)
- Create: `backend/src/services/comparacao.service.ts`
- Test: `backend/src/services/comparacao.service.test.ts`

**Interfaces:**
- Consumes: `Vulnerabilidade`, `Severidade` de `../types/scanner.types`; `SEVERIDADE_RANK` de `./vulnerabilidades.catalog`.
- Produces:
  - `AuditoriaComparavel { id: string; score: number; conformidadePercentual: number; vulnerabilidades: Vulnerabilidade[] }`
  - `AchadoDiff { refId: string; titulo: string; severidade: Severidade; detalhe?: string }`
  - `ComparacaoResultado { baseId; atualId; scoreAnterior; scoreAtual; scoreDelta; conformidadeAnterior; conformidadeAtual; conformidadeDelta; novos: AchadoDiff[]; resolvidos: AchadoDiff[]; mantidos: AchadoDiff[] }`
  - `compararAuditorias(anterior: AuditoriaComparavel, atual: AuditoriaComparavel): ComparacaoResultado`

- [ ] **Step 1: Adicionar tipos** em `backend/src/types/scanner.types.ts` (ao final)

```ts
export interface AuditoriaComparavel {
  id: string;
  score: number;
  conformidadePercentual: number;
  vulnerabilidades: Vulnerabilidade[];
}

export interface AchadoDiff {
  refId: string;
  titulo: string;
  severidade: Severidade;
  detalhe?: string;
}

export interface ComparacaoResultado {
  baseId: string;
  atualId: string;
  scoreAnterior: number;
  scoreAtual: number;
  scoreDelta: number;
  conformidadeAnterior: number;
  conformidadeAtual: number;
  conformidadeDelta: number;
  novos: AchadoDiff[];
  resolvidos: AchadoDiff[];
  mantidos: AchadoDiff[];
}
```

- [ ] **Step 2: Escrever o teste que falha** (`comparacao.service.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { compararAuditorias } from "./comparacao.service";
import type { AuditoriaComparavel, Vulnerabilidade } from "../types/scanner.types";

function v(p: Partial<Vulnerabilidade>): Vulnerabilidade {
  return {
    id: Math.random().toString(36), refId: "x", titulo: "t", descricao: "d", categoria: "C",
    severidade: "BAIXA", cvss: 1, impacto: 1, facilidadeCorrecao: 1, tempoEstimado: "10 min",
    tempoEstimadoMin: 10, recomendacao: "r", ...p,
  };
}
function aud(p: Partial<AuditoriaComparavel>): AuditoriaComparavel {
  return { id: "a", score: 50, conformidadePercentual: 50, vulnerabilidades: [], ...p };
}

describe("compararAuditorias", () => {
  it("calcula os deltas de score e conformidade", () => {
    const c = compararAuditorias(
      aud({ id: "ant", score: 40, conformidadePercentual: 60 }),
      aud({ id: "atu", score: 70, conformidadePercentual: 80 }),
    );
    expect(c.baseId).toBe("ant");
    expect(c.atualId).toBe("atu");
    expect(c.scoreDelta).toBe(30);
    expect(c.conformidadeDelta).toBe(20);
  });

  it("classifica achados em novos, resolvidos e mantidos", () => {
    const anterior = aud({ vulnerabilidades: [v({ refId: "header-csp-ausente", titulo: "CSP" }), v({ refId: "exp-server", titulo: "Server" })] });
    const atual = aud({ vulnerabilidades: [v({ refId: "header-csp-ausente", titulo: "CSP" }), v({ refId: "cookie-sem-secure", titulo: "Secure" })] });
    const c = compararAuditorias(anterior, atual);
    expect(c.novos.map((x) => x.refId)).toEqual(["cookie-sem-secure"]);
    expect(c.resolvidos.map((x) => x.refId)).toEqual(["exp-server"]);
    expect(c.mantidos.map((x) => x.refId)).toEqual(["header-csp-ausente"]);
  });

  it("usa refId+detalhe como identidade (mesmo refId, detalhe diferente conta separado)", () => {
    const anterior = aud({ vulnerabilidades: [v({ refId: "cookie-sem-secure", detalhe: "Cookie: a" })] });
    const atual = aud({ vulnerabilidades: [v({ refId: "cookie-sem-secure", detalhe: "Cookie: b" })] });
    const c = compararAuditorias(anterior, atual);
    expect(c.novos).toHaveLength(1);
    expect(c.resolvidos).toHaveLength(1);
    expect(c.mantidos).toHaveLength(0);
  });

  it("ordena diffs por severidade (crítico primeiro)", () => {
    const atual = aud({ vulnerabilidades: [v({ refId: "b", severidade: "BAIXA" }), v({ refId: "a", severidade: "CRITICA" })] });
    const c = compararAuditorias(aud({}), atual);
    expect(c.novos[0].severidade).toBe("CRITICA");
  });

  it("sem vulnerabilidades em ambos => listas vazias", () => {
    const c = compararAuditorias(aud({}), aud({}));
    expect(c.novos).toEqual([]);
    expect(c.resolvidos).toEqual([]);
    expect(c.mantidos).toEqual([]);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/services/comparacao.service.test.ts`
Expected: FAIL — `Cannot find module './comparacao.service'`.

- [ ] **Step 4: Implementar `comparacao.service.ts`**

```ts
import type {
  AuditoriaComparavel,
  AchadoDiff,
  ComparacaoResultado,
  Vulnerabilidade,
} from "../types/scanner.types";
import { SEVERIDADE_RANK } from "./vulnerabilidades.catalog";

function chave(v: Vulnerabilidade): string {
  return `${v.refId}|${v.detalhe ?? ""}`;
}

function paraDiff(v: Vulnerabilidade): AchadoDiff {
  return { refId: v.refId, titulo: v.titulo, severidade: v.severidade, detalhe: v.detalhe };
}

function ordenar(itens: AchadoDiff[]): AchadoDiff[] {
  return [...itens].sort((a, b) => SEVERIDADE_RANK[b.severidade] - SEVERIDADE_RANK[a.severidade]);
}

export function compararAuditorias(
  anterior: AuditoriaComparavel,
  atual: AuditoriaComparavel,
): ComparacaoResultado {
  const mapaAnterior = new Map(anterior.vulnerabilidades.map((v) => [chave(v), v]));
  const mapaAtual = new Map(atual.vulnerabilidades.map((v) => [chave(v), v]));

  const novos: AchadoDiff[] = [];
  const mantidos: AchadoDiff[] = [];
  for (const [k, v] of mapaAtual) {
    if (mapaAnterior.has(k)) mantidos.push(paraDiff(v));
    else novos.push(paraDiff(v));
  }

  const resolvidos: AchadoDiff[] = [];
  for (const [k, v] of mapaAnterior) {
    if (!mapaAtual.has(k)) resolvidos.push(paraDiff(v));
  }

  return {
    baseId: anterior.id,
    atualId: atual.id,
    scoreAnterior: anterior.score,
    scoreAtual: atual.score,
    scoreDelta: atual.score - anterior.score,
    conformidadeAnterior: anterior.conformidadePercentual,
    conformidadeAtual: atual.conformidadePercentual,
    conformidadeDelta: atual.conformidadePercentual - anterior.conformidadePercentual,
    novos: ordenar(novos),
    resolvidos: ordenar(resolvidos),
    mantidos: ordenar(mantidos),
  };
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd backend && npx vitest run src/services/comparacao.service.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 6: Commit**

```bash
git add backend/src/types/scanner.types.ts backend/src/services/comparacao.service.ts backend/src/services/comparacao.service.test.ts
git commit -m "test(comparacao): diff entre auditorias via TDD"
```

---

### Task 2: Endpoints (comparação + filtro por URL)

**Files:**
- Modify: `backend/src/controllers/auditoria.controller.ts`
- Modify: `backend/src/routes/auditoria.routes.ts`

**Interfaces:**
- Consumes: `compararAuditorias`, `avaliarConformidade`.
- Produces: `GET /:id/comparacao`; filtro `?url=` em `GET /`.

- [ ] **Step 1: Filtro por URL em `listarHistorico`** — `auditoria.controller.ts`

Substituir o corpo de `listarHistorico` por:

```ts
export async function listarHistorico(req: Request, res: Response) {
  const limite = Math.min(Number(req.query.limite) || 20, 100);
  const url = typeof req.query.url === "string" && req.query.url ? req.query.url : undefined;
  const auditorias = await prisma.auditoria.findMany({
    where: url ? { url } : undefined,
    orderBy: { criadoEm: "desc" },
    take: limite,
  });
  res.json({ sucesso: true, dados: auditorias });
}
```

- [ ] **Step 2: Handler de comparação** — `auditoria.controller.ts`

Importar (caso ainda não): `import { compararAuditorias } from "../services/comparacao.service";` e `import type { AuditoriaComparavel } from "../types/scanner.types";`.
Adicionar a função (antes de `excluirAuditoria`):

```ts
function paraComparavel(auditoria: any): AuditoriaComparavel {
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

export async function compararComAnterior(req: Request, res: Response) {
  const atual = await prisma.auditoria.findUnique({
    where: { id: req.params.id },
    include: { resultado: true },
  });
  if (!atual || !atual.resultado) throw new HttpError(404, "Auditoria não encontrada ou sem resultado.");

  const anterior = await prisma.auditoria.findFirst({
    where: { url: atual.url, status: "CONCLUIDA", criadoEm: { lt: atual.criadoEm }, resultado: { isNot: null } },
    orderBy: { criadoEm: "desc" },
    include: { resultado: true },
  });

  if (!anterior || !anterior.resultado) {
    res.json({ sucesso: true, dados: null });
    return;
  }

  const comparacao = compararAuditorias(paraComparavel(anterior), paraComparavel(atual));
  res.json({ sucesso: true, dados: comparacao });
}
```

(Confirmar que `DNS_VAZIO` e `avaliarConformidade` já estão importados no arquivo — da Sprint 4/3; se não, importar `import { DNS_VAZIO } from "../scanner/dns.scanner";`.)

- [ ] **Step 3: Rotas** — `auditoria.routes.ts`

Importar `compararComAnterior` e registrar (antes de `/:id`):

```ts
auditoriaRouter.get("/:id/comparacao", asyncHandler(compararComAnterior));
```

- [ ] **Step 4: Verificação**

Run: `cd backend && npx tsc --noEmit && npm test`
Expected: tsc ok; testes passam.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/auditoria.controller.ts backend/src/routes/auditoria.routes.ts
git commit -m "feat(comparacao): endpoint de comparação e filtro por URL"
```

---

### Task 3: Frontend — comparação no visualizador

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/services/api.ts`
- Create: `frontend/src/components/ComparacaoAnterior.tsx`
- Modify: `frontend/src/pages/VisualizadorRelatorio.tsx`

**Interfaces:**
- Consumes: `GET /:id/comparacao`.
- Produces: `buscarComparacao`, `listarHistorico(limite?, url?)`, componente `ComparacaoAnterior`.

- [ ] **Step 1: Tipos** — `frontend/src/types/index.ts` (ao final)

```ts
export interface AchadoDiff {
  refId: string;
  titulo: string;
  severidade: Severidade;
  detalhe?: string;
}

export interface ComparacaoResultado {
  baseId: string;
  atualId: string;
  scoreAnterior: number;
  scoreAtual: number;
  scoreDelta: number;
  conformidadeAnterior: number;
  conformidadeAtual: number;
  conformidadeDelta: number;
  novos: AchadoDiff[];
  resolvidos: AchadoDiff[];
  mantidos: AchadoDiff[];
}
```

- [ ] **Step 2: API** — `frontend/src/services/api.ts`

Alterar `listarHistorico` para aceitar `url`:

```ts
export async function listarHistorico(limite = 20, url?: string): Promise<Auditoria[]> {
  const { data } = await api.get("/auditorias", { params: { limite, ...(url ? { url } : {}) } });
  return data.dados;
}
```

Adicionar:

```ts
import type { ComparacaoResultado } from "../types";

export async function buscarComparacao(id: string): Promise<ComparacaoResultado | null> {
  const { data } = await api.get(`/auditorias/${id}/comparacao`);
  return data.dados;
}
```

(Se já houver um import de tipos de `../types`, juntar `ComparacaoResultado` nele em vez de duplicar.)

- [ ] **Step 3: Componente** — `frontend/src/components/ComparacaoAnterior.tsx`

```tsx
import type { ComparacaoResultado } from "../types";
import { Card } from "./Card";
import { SeverityBadge } from "./SeverityBadge";

function Delta({ rotulo, anterior, atual, delta }: { rotulo: string; anterior: number; atual: number; delta: number }) {
  const cor = delta > 0 ? "text-ok" : delta < 0 ? "text-danger" : "text-slate-400";
  const seta = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
  return (
    <div className="flex items-center justify-between rounded-lg border border-line bg-bg-raised/40 px-3 py-2">
      <span className="text-sm text-slate-400">{rotulo}</span>
      <span className="text-sm text-slate-300">
        {anterior} → {atual} <span className={`ml-1 font-display ${cor}`}>{seta} {delta > 0 ? "+" : ""}{delta}</span>
      </span>
    </div>
  );
}

export function ComparacaoAnterior({ comparacao }: { comparacao: ComparacaoResultado }) {
  return (
    <Card title="Comparação com a auditoria anterior">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Delta rotulo="Score" anterior={comparacao.scoreAnterior} atual={comparacao.scoreAtual} delta={comparacao.scoreDelta} />
        <Delta rotulo="Conformidade (%)" anterior={comparacao.conformidadeAnterior} atual={comparacao.conformidadeAtual} delta={comparacao.conformidadeDelta} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <h4 className="mb-1.5 text-sm text-ok">Resolvidos ({comparacao.resolvidos.length})</h4>
          <ul className="space-y-1">
            {comparacao.resolvidos.length === 0 ? (
              <li className="text-xs text-slate-500">Nenhum.</li>
            ) : comparacao.resolvidos.map((a, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-slate-300">✅ {a.titulo}{a.detalhe ? ` (${a.detalhe})` : ""}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-1.5 text-sm text-danger">Novos ({comparacao.novos.length})</h4>
          <ul className="space-y-1">
            {comparacao.novos.length === 0 ? (
              <li className="text-xs text-slate-500">Nenhum.</li>
            ) : comparacao.novos.map((a, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-slate-300">
                <SeverityBadge severidade={a.severidade} /> {a.titulo}{a.detalhe ? ` (${a.detalhe})` : ""}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 4: Integrar no visualizador** — `frontend/src/pages/VisualizadorRelatorio.tsx`

Importar e adicionar estado + fetch. No topo, junto aos imports:
`import { ComparacaoAnterior } from "../components/ComparacaoAnterior";`
`import { buscarComparacao } from "../services/api";` (juntar ao import existente de api).
`import type { Auditoria, ComparacaoResultado } from "../types";` (ajustar import existente).

Dentro do componente, adicionar:

```tsx
const [comparacao, setComparacao] = useState<ComparacaoResultado | null>(null);
useEffect(() => {
  if (!id) return;
  buscarComparacao(id).then(setComparacao).catch(() => setComparacao(null));
}, [id]);
```

E na árvore, após `{r && r.dns && <RegistrosDns .../>}`:

```tsx
{comparacao && <ComparacaoAnterior comparacao={comparacao} />}
```

- [ ] **Step 5: Build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "feat(comparacao): seção de comparação no visualizador"
```

---

### Task 4: Frontend — página Monitoramento + evolução do score

**Files:**
- Create: `frontend/src/components/EvolucaoScore.tsx`
- Create: `frontend/src/pages/Monitoramento.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`

**Interfaces:**
- Consumes: `listarHistorico` (sem filtro, agrupa por URL no cliente).

- [ ] **Step 1: Componente de gráfico** — `frontend/src/components/EvolucaoScore.tsx`

```tsx
interface Ponto { data: string; score: number }

export function EvolucaoScore({ pontos }: { pontos: Ponto[] }) {
  if (pontos.length === 0) return null;
  const w = 280;
  const h = 60;
  const pad = 6;
  const xs = (i: number) => (pontos.length === 1 ? w / 2 : pad + (i * (w - 2 * pad)) / (pontos.length - 1));
  const ys = (s: number) => h - pad - (s / 100) * (h - 2 * pad);
  const pathD = pontos.map((p, i) => `${i === 0 ? "M" : "L"} ${xs(i).toFixed(1)} ${ys(p.score).toFixed(1)}`).join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="text-accent">
      {pontos.length > 1 && <path d={pathD} fill="none" stroke="currentColor" strokeWidth="2" />}
      {pontos.map((p, i) => (
        <circle key={i} cx={xs(i)} cy={ys(p.score)} r="2.5" fill="currentColor" />
      ))}
    </svg>
  );
}
```

- [ ] **Step 2: Página Monitoramento** — `frontend/src/pages/Monitoramento.tsx`

```tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { Card } from "../components/Card";
import { Loader } from "../components/Loader";
import { Alert } from "../components/Alert";
import { EvolucaoScore } from "../components/EvolucaoScore";
import { listarHistorico, extrairMensagemErro } from "../services/api";
import type { Auditoria } from "../types";

export function Monitoramento() {
  const [auditorias, setAuditorias] = useState<Auditoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    listarHistorico(100)
      .then(setAuditorias)
      .catch((e) => setErro(extrairMensagemErro(e)))
      .finally(() => setCarregando(false));
  }, []);

  const concluidas = auditorias.filter((a) => a.status === "CONCLUIDA");
  const porUrl = new Map<string, Auditoria[]>();
  for (const a of concluidas) {
    const lista = porUrl.get(a.url) ?? [];
    lista.push(a);
    porUrl.set(a.url, lista);
  }

  return (
    <>
      <Navbar title="Monitoramento" subtitle="Evolução do score por URL" />
      <main className="flex-1 overflow-y-auto p-6 space-y-4">
        {carregando && <Loader texto="Carregando" />}
        {erro && <Alert tipo="erro">{erro}</Alert>}
        {!carregando && !erro && porUrl.size === 0 && (
          <p className="text-sm text-slate-500">Nenhuma auditoria concluída ainda.</p>
        )}
        {[...porUrl.entries()].map(([url, lista]) => {
          const ordenadas = [...lista].sort((a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime());
          const recente = ordenadas[ordenadas.length - 1];
          const pontos = ordenadas.map((a) => ({ data: a.criadoEm, score: a.score ?? 0 }));
          return (
            <Card key={url} title={url} action={
              <Link to={`/auditorias/${recente.id}`} className="text-xs text-accent hover:underline">Ver última →</Link>
            }>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-display text-3xl text-accent">{recente.score ?? "—"}</p>
                  <p className="text-xs text-slate-500">{ordenadas.length} auditoria(s)</p>
                </div>
                <EvolucaoScore pontos={pontos} />
              </div>
            </Card>
          );
        })}
      </main>
    </>
  );
}
```

- [ ] **Step 3: Rota** — `frontend/src/App.tsx`

Importar `import { Monitoramento } from "./pages/Monitoramento";` e adicionar dentro de `<Routes>`:
`<Route path="/monitoramento" element={<Monitoramento />} />`

- [ ] **Step 4: Sidebar** — `frontend/src/components/Sidebar.tsx`

Adicionar um item de navegação "Monitoramento" apontando para `/monitoramento`, seguindo o mesmo padrão dos itens existentes (ler o arquivo e replicar a estrutura de link/ícone usada para "Histórico").

- [ ] **Step 5: Build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "feat(monitoramento): página de evolução do score por URL"
```

---

### Task 5: Verificação final

- [ ] `cd backend && npm test` → todos verdes.
- [ ] `cd backend && npx tsc --noEmit` → sem erros.
- [ ] `cd frontend && npm run build` → sucesso.
- [ ] Commit final se necessário.

## Self-Review

**1. Spec coverage:**
- `comparacao.service` → Task 1. ✓
- Endpoint `/comparacao` + filtro `?url=` → Task 2. ✓
- Seção de comparação no visualizador → Task 3. ✓
- Página Monitoramento + evolução do score + Sidebar + rota → Task 4. ✓
- Diff por achados+score+conformidade → Task 1. ✓
- YAGNI (agendamento/alertas/diff campo-a-campo) → sem tarefa. ✓

**2. Placeholder scan:** sem TBD/TODO. Step 4 da Task 4 (Sidebar) instrui ler e replicar o padrão existente — aceitável por depender do layout atual do arquivo, mas sem código novo de lógica.

**3. Type consistency:** `AuditoriaComparavel`, `AchadoDiff`, `ComparacaoResultado` definidos na Task 1 e reusados (backend Task 2; frontend Tasks 3). `compararAuditorias` e `buscarComparacao` consistentes. `listarHistorico(limite?, url?)` atualizado em Task 2 (backend) e Task 3 (frontend).
