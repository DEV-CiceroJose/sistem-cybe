# Sprint 1 — Rebuild TDD do Núcleo: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (execução inline nesta sessão). Steps usam checkbox (`- [ ]`).

**Goal:** Reconstruir test-first (Vitest) as três unidades de lógica pura do Sistema de Prioridades, mantendo comportamento equivalente ao baseline.

**Architecture:** `calcularScore` orquestra `criarVulnerabilidade` (catalog) + `ordenarVulnerabilidades`/`resumirPrioridades` (priorizacao), produzindo `ScoreFinal` com achados ordenados e resumo.

**Tech Stack:** TypeScript (ESM), Vitest, tsx, Prisma (não tocado), Express (não tocado).

## Global Constraints

- Linguagem do código/comentários: português (pt-BR), seguindo o existente.
- Tipos em `backend/src/types/scanner.types.ts` permanecem; não recriar.
- Pesos do score: https 30, headers 25, cookies 15, exposicao 15, performance 15.
- `SEVERIDADE_RANK`: CRITICA 5, ALTA 4, MEDIA 3, BAIXA 2, INFORMATIVA 1.
- Testes co-localizados em `backend/src/**/*.test.ts`. Sem mocks (funções puras).
- Após cada tarefa: suíte verde + commit.

---

### Task 0: Setup do Vitest

**Files:**
- Modify: `backend/package.json` (devDependency `vitest`, script `test`)
- Create: `backend/vitest.config.ts`

- [ ] Instalar vitest: `npm i -D vitest` (em `backend/`)
- [ ] Adicionar script `"test": "vitest run"` e `"test:watch": "vitest"`
- [ ] Criar `vitest.config.ts` com `environment: 'node'`, `globals: false`
- [ ] Criar teste sentinela `backend/src/sentinela.test.ts` que afirma `expect(1+1).toBe(2)`
- [ ] Rodar `npm test` → PASS; depois apagar o sentinela
- [ ] Commit: `chore(test): configura Vitest no backend`

---

### Task 1: catalog — `criarVulnerabilidade` (TDD)

**Files:**
- Test: `backend/src/services/vulnerabilidades.catalog.test.ts`
- Recreate: `backend/src/services/vulnerabilidades.catalog.ts`

**Interfaces:**
- Produces: `criarVulnerabilidade(refId, overrides?) => Vulnerabilidade`,
  `SEVERIDADE_RANK`, `SEVERIDADE_LABEL`.

- [ ] **Step 1 — Deletar** o conteúdo de implementação de `vulnerabilidades.catalog.ts`.
- [ ] **Step 2 — Teste falha:** cria a partir de um refId conhecido devolve campos do catálogo:

```ts
import { describe, it, expect } from "vitest";
import { criarVulnerabilidade, SEVERIDADE_RANK } from "./vulnerabilidades.catalog";

describe("criarVulnerabilidade", () => {
  it("cria uma vulnerabilidade a partir de um refId conhecido", () => {
    const v = criarVulnerabilidade("https-ausente");
    expect(v.refId).toBe("https-ausente");
    expect(v.severidade).toBe("CRITICA");
    expect(v.categoria).toBe("HTTPS");
    expect(v.cvss).toBeGreaterThan(0);
    expect(v.tempoEstimadoMin).toBeGreaterThan(0);
  });

  it("aplica overrides de severidade, cvss e detalhe", () => {
    const v = criarVulnerabilidade("cert-expirado", { detalhe: "há 3 dias", severidade: "ALTA" });
    expect(v.severidade).toBe("ALTA");
    expect(v.detalhe).toBe("há 3 dias");
  });

  it("gera ids únicos por instância", () => {
    const a = criarVulnerabilidade("https-ausente");
    const b = criarVulnerabilidade("https-ausente");
    expect(a.id).not.toBe(b.id);
  });

  it("lança erro para refId desconhecido", () => {
    expect(() => criarVulnerabilidade("nao-existe")).toThrow();
  });

  it("expõe SEVERIDADE_RANK ordenando CRITICA acima de INFORMATIVA", () => {
    expect(SEVERIDADE_RANK.CRITICA).toBeGreaterThan(SEVERIDADE_RANK.INFORMATIVA);
  });
});
```

- [ ] **Step 3 — Rodar** `npx vitest run src/services/vulnerabilidades.catalog.test.ts` → FAIL.
- [ ] **Step 4 — Implementar** o catálogo mínimo (entradas necessárias) + `criarVulnerabilidade` + ranks/labels. (Reconstruir as entradas usadas pelo scoring: https-ausente, tls-nao-confiavel, cert-expirado, cert-expirando, header-csp/hsts/xframe/xcto/referrer/permissions-ausente, cookie-sem-secure/httponly/samesite, exposicao-server/xpoweredby/comentarios, perf-tempo-elevado/sem-compressao/sem-cache.)
- [ ] **Step 5 — Rodar** o teste → PASS.
- [ ] **Step 6 — Commit:** `test(catalog): reconstrói criarVulnerabilidade via TDD`.

---

### Task 2: priorizacao — ordenar + resumir (TDD)

**Files:**
- Test: `backend/src/services/priorizacao.service.test.ts`
- Recreate: `backend/src/services/priorizacao.service.ts`

**Interfaces:**
- Consumes: `criarVulnerabilidade`, `SEVERIDADE_RANK`.
- Produces: `ordenarVulnerabilidades(v[])`, `resumirPrioridades(v[], topN?)`.

- [ ] **Step 1 — Deletar** conteúdo de `priorizacao.service.ts`.
- [ ] **Step 2 — Teste falha** (ordenação, desempate, imutabilidade, resumo):

```ts
import { describe, it, expect } from "vitest";
import { ordenarVulnerabilidades, resumirPrioridades } from "./priorizacao.service";
import type { Vulnerabilidade } from "../types/scanner.types";

function v(p: Partial<Vulnerabilidade>): Vulnerabilidade {
  return {
    id: Math.random().toString(36), refId: "x", titulo: "t", descricao: "d",
    categoria: "C", severidade: "BAIXA", cvss: 1, impacto: 1,
    facilidadeCorrecao: 1, tempoEstimado: "10 min", tempoEstimadoMin: 10,
    recomendacao: "r", ...p,
  };
}

describe("ordenarVulnerabilidades", () => {
  it("ordena por severidade (mais grave primeiro)", () => {
    const r = ordenarVulnerabilidades([v({ severidade: "BAIXA" }), v({ severidade: "CRITICA" })]);
    expect(r[0].severidade).toBe("CRITICA");
  });
  it("desempata por cvss, depois facilidade, depois impacto", () => {
    const a = v({ severidade: "ALTA", cvss: 5, facilidadeCorrecao: 2, impacto: 2 });
    const b = v({ severidade: "ALTA", cvss: 5, facilidadeCorrecao: 5, impacto: 2 });
    const r = ordenarVulnerabilidades([a, b]);
    expect(r[0]).toBe(b); // facilidade maior primeiro
  });
  it("não muta o array de entrada", () => {
    const arr = [v({ severidade: "BAIXA" }), v({ severidade: "CRITICA" })];
    const copia = [...arr];
    ordenarVulnerabilidades(arr);
    expect(arr).toEqual(copia);
  });
});

describe("resumirPrioridades", () => {
  it("conta por severidade incluindo zeros e soma o tempo", () => {
    const r = resumirPrioridades([v({ severidade: "CRITICA", tempoEstimadoMin: 60 }), v({ severidade: "CRITICA", tempoEstimadoMin: 30 })]);
    expect(r.total).toBe(2);
    expect(r.porSeveridade.CRITICA).toBe(2);
    expect(r.porSeveridade.BAIXA).toBe(0);
    expect(r.tempoTotalEstimadoMin).toBe(90);
  });
  it("corrijaPrimeiro respeita topN e vem ordenado", () => {
    const r = resumirPrioridades([v({ severidade: "BAIXA" }), v({ severidade: "CRITICA" }), v({ severidade: "ALTA" })], 2);
    expect(r.corrijaPrimeiro).toHaveLength(2);
    expect(r.corrijaPrimeiro[0].severidade).toBe("CRITICA");
  });
  it("lida com lista vazia", () => {
    const r = resumirPrioridades([]);
    expect(r.total).toBe(0);
    expect(r.corrijaPrimeiro).toEqual([]);
  });
});
```

- [ ] **Step 3 — Rodar** → FAIL.
- [ ] **Step 4 — Implementar** `ordenarVulnerabilidades` (cascata) + `resumirPrioridades`.
- [ ] **Step 5 — Rodar** → PASS.
- [ ] **Step 6 — Commit:** `test(priorizacao): reconstrói ordenação e resumo via TDD`.

---

### Task 3: scoring — `calcularScore` (TDD)

**Files:**
- Test: `backend/src/services/scoring.service.test.ts`
- Recreate: `backend/src/services/scoring.service.ts`

**Interfaces:**
- Consumes: `criarVulnerabilidade`, `ordenarVulnerabilidades`, `resumirPrioridades`.
- Produces: `calcularScore(resultado) => ScoreFinal`.

- [ ] **Step 1 — Deletar** conteúdo de `scoring.service.ts`.
- [ ] **Step 2 — Teste falha** com helper de `ScanResultado`:

```ts
import { describe, it, expect } from "vitest";
import { calcularScore } from "./scoring.service";
import type { ScanResultado } from "../types/scanner.types";

function base(): ScanResultado {
  return {
    https: { habilitado: true, cadeiaConfiavel: true, diasParaExpirar: 200 },
    headers: {
      contentSecurityPolicy: "x", strictTransportSecurity: "x", xFrameOptions: "x",
      xContentTypeOptions: "x", referrerPolicy: "x", permissionsPolicy: "x",
    },
    cookies: [],
    exposicao: { server: null, xPoweredBy: null, comentariosHtmlEncontrados: 0, robotsTxtExiste: true, sitemapXmlExiste: true },
    tecnologias: { frameworks: [], cms: [], servidorWeb: null, cdn: [], bibliotecasJs: [], linguagem: null },
    performance: { tempoRespostaMs: 100, compressao: "br", cache: "max-age=60", tamanhoPaginaBytes: 1000, quantidadeRequisicoesIniciais: 1 },
  };
}

describe("calcularScore", () => {
  it("site perfeito => score 100, EXCELENTE, sem vulnerabilidades", () => {
    const s = calcularScore(base());
    expect(s.score).toBe(100);
    expect(s.classificacao).toBe("EXCELENTE");
    expect(s.vulnerabilidades).toHaveLength(0);
    expect(s.resumoPrioridades.total).toBe(0);
  });

  it("sem HTTPS => achado crítico https-ausente e score reduzido", () => {
    const r = base();
    r.https = { habilitado: false };
    const s = calcularScore(r);
    expect(s.vulnerabilidades.some((v) => v.refId === "https-ausente")).toBe(true);
    expect(s.score).toBeLessThan(100);
  });

  it("certificado expirado => achado cert-expirado severidade CRITICA", () => {
    const r = base();
    r.https = { habilitado: true, cadeiaConfiavel: true, diasParaExpirar: -2 };
    const s = calcularScore(r);
    const achado = s.vulnerabilidades.find((v) => v.refId === "cert-expirado");
    expect(achado?.severidade).toBe("CRITICA");
  });

  it("certificado expirando (<15d) => achado cert-expirando severidade MEDIA", () => {
    const r = base();
    r.https = { habilitado: true, cadeiaConfiavel: true, diasParaExpirar: 5 };
    const s = calcularScore(r);
    const achado = s.vulnerabilidades.find((v) => v.refId === "cert-expirando");
    expect(achado?.severidade).toBe("MEDIA");
  });

  it("cookie sem atributos => três achados com nome do cookie no detalhe", () => {
    const r = base();
    r.cookies = [{ nome: "sid", secure: false, httpOnly: false, sameSite: null }];
    const s = calcularScore(r);
    const doCookie = s.vulnerabilidades.filter((v) => v.categoria === "Cookies");
    expect(doCookie).toHaveLength(3);
    expect(doCookie.every((v) => v.detalhe?.includes("sid"))).toBe(true);
  });

  it("headers ausentes geram um achado por cabeçalho", () => {
    const r = base();
    r.headers = { contentSecurityPolicy: null, strictTransportSecurity: null, xFrameOptions: null, xContentTypeOptions: null, referrerPolicy: null, permissionsPolicy: null };
    const s = calcularScore(r);
    expect(s.vulnerabilidades.filter((v) => v.categoria === "Headers")).toHaveLength(6);
  });

  it("retorna vulnerabilidades já ordenadas por severidade", () => {
    const r = base();
    r.https = { habilitado: false };               // crítico
    r.headers.xContentTypeOptions = null;          // baixa
    const s = calcularScore(r);
    expect(s.vulnerabilidades[0].severidade).toBe("CRITICA");
  });

  it("classifica faixas: site ruim => CRITICA", () => {
    const r = base();
    r.https = { habilitado: false };
    r.headers = { contentSecurityPolicy: null, strictTransportSecurity: null, xFrameOptions: null, xContentTypeOptions: null, referrerPolicy: null, permissionsPolicy: null };
    r.exposicao = { server: "nginx", xPoweredBy: "PHP", comentariosHtmlEncontrados: 10, robotsTxtExiste: false, sitemapXmlExiste: false };
    r.performance = { tempoRespostaMs: 5000, compressao: null, cache: null, tamanhoPaginaBytes: 1, quantidadeRequisicoesIniciais: 1 };
    const s = calcularScore(r);
    expect(s.classificacao).toBe("CRITICA");
  });
});
```

- [ ] **Step 3 — Rodar** → FAIL.
- [ ] **Step 4 — Implementar** `calcularScore` (avaliar https/headers/cookies/exposicao/performance, emitir achados, ordenar, resumir) conforme regras do spec.
- [ ] **Step 5 — Rodar** toda a suíte `npm test` → PASS.
- [ ] **Step 6 — Commit:** `test(scoring): reconstrói calcularScore via TDD`.

---

### Task 4: Verificação final

- [ ] `npm test` (backend) → todos verdes.
- [ ] `npx tsc --noEmit` (backend) → sem erros.
- [ ] `cd frontend && npm run build` → sucesso (contratos intactos).
- [ ] Commit final se houver ajustes: `chore: verificação Sprint 1 rebuild TDD`.

## Self-Review

- Cobertura do spec: ordenação ✓, resumo ✓, severidade dinâmica cert ✓,
  mapeamento headers/cookies/exposição/performance ✓, score perfeito ✓,
  classificação ✓. (Catálogo exercitado indiretamente via scoring + direto na Task 1.)
- Sem placeholders: todos os steps de código trazem o código real do teste.
- Consistência de tipos: usa `Vulnerabilidade`, `ScanResultado`, `ScoreFinal`
  de `scanner.types.ts` (inalterados).
