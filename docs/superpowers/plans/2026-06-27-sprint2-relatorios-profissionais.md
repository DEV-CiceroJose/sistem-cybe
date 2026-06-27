# Sprint 2 — Relatórios Profissionais: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para implementar tarefa-a-tarefa. Steps usam checkbox (`- [ ]`).

**Goal:** Gerar relatórios profissionais da auditoria em PDF, HTML e Markdown a partir dos dados já persistidos, com capa personalizável, gráficos SVG, sumário, evidências e plano de ação.

**Architecture:** Um gerador no backend é a fonte de verdade: `branding.service` lê a marca do `Configuracao`; `charts.svg` produz SVG puro; `html.report` monta um HTML autocontido; `markdown.report` é aprimorado. O frontend exibe e exporta (PDF via print de iframe, HTML/MD via download).

**Tech Stack:** TypeScript (CommonJS) + Express + Prisma no backend; Vitest para testes; React + Vite + Tailwind no frontend.

## Global Constraints

- Linguagem do código/comentários e do conteúdo do relatório: português (pt-BR).
- Sem novas dependências pesadas (sem Puppeteer/headless). Gráficos = SVG manual.
- Tipos da Sprint 1 reusados de `backend/src/types/scanner.types.ts` (não recriar): `Severidade`, `Vulnerabilidade`, `ResumoPrioridades`, `ScanResultado`, `ScoreCategoria`.
- `MarcaRelatorio` = { empresa, site, auditor, contato, logoUrl } (strings; defaults: empresa="Web Security Analyzer", resto="").
- Chaves de config: `relatorio.empresa`, `relatorio.site`, `relatorio.auditor`, `relatorio.contato`, `relatorio.logoUrl`.
- Testes co-localizados em `backend/src/**/*.test.ts`. Sem mocks (funções puras).
- Após cada tarefa: suíte verde + commit. Rodar testes a partir de `backend/`.

---

### Task 1: Tipos do relatório + branding.service (TDD)

**Files:**
- Create: `backend/src/reports/relatorio.types.ts`
- Create: `backend/src/reports/branding.service.ts`
- Test: `backend/src/reports/branding.service.test.ts`

**Interfaces:**
- Consumes: tipos de `../types/scanner.types`.
- Produces:
  - `MarcaRelatorio { empresa: string; site: string; auditor: string; contato: string; logoUrl: string }`
  - `DadosRelatorio { url; criadoEm; concluidoEm: string|null; score: number; classificacao: "EXCELENTE"|"BOA"|"ATENCAO"|"CRITICA"; resultado: ScanResultado; categorias: ScoreCategoria[]; vulnerabilidades: Vulnerabilidade[]; resumoPrioridades: ResumoPrioridades; marca: MarcaRelatorio }`
  - `lerMarca(configs: { chave: string; valor: string }[]): MarcaRelatorio`

- [ ] **Step 1: Escrever o teste que falha**

Criar `backend/src/reports/relatorio.types.ts` apenas com os tipos (sem lógica) para o teste compilar:

```ts
import type {
  ScanResultado, ScoreCategoria, Vulnerabilidade, ResumoPrioridades,
} from "../types/scanner.types";

export interface MarcaRelatorio {
  empresa: string;
  site: string;
  auditor: string;
  contato: string;
  logoUrl: string;
}

export interface DadosRelatorio {
  url: string;
  criadoEm: string;
  concluidoEm: string | null;
  score: number;
  classificacao: "EXCELENTE" | "BOA" | "ATENCAO" | "CRITICA";
  resultado: ScanResultado;
  categorias: ScoreCategoria[];
  vulnerabilidades: Vulnerabilidade[];
  resumoPrioridades: ResumoPrioridades;
  marca: MarcaRelatorio;
}
```

Teste `backend/src/reports/branding.service.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { lerMarca } from "./branding.service";

describe("lerMarca", () => {
  it("usa defaults quando não há configurações", () => {
    const m = lerMarca([]);
    expect(m.empresa).toBe("Web Security Analyzer");
    expect(m.site).toBe("");
    expect(m.auditor).toBe("");
    expect(m.contato).toBe("");
    expect(m.logoUrl).toBe("");
  });

  it("aplica overrides das chaves relatorio.*", () => {
    const m = lerMarca([
      { chave: "relatorio.empresa", valor: "ACME Seg" },
      { chave: "relatorio.site", valor: "acme.com" },
      { chave: "relatorio.auditor", valor: "Cícero" },
      { chave: "relatorio.contato", valor: "ci@acme.com" },
      { chave: "relatorio.logoUrl", valor: "https://acme.com/logo.png" },
    ]);
    expect(m.empresa).toBe("ACME Seg");
    expect(m.site).toBe("acme.com");
    expect(m.auditor).toBe("Cícero");
    expect(m.contato).toBe("ci@acme.com");
    expect(m.logoUrl).toBe("https://acme.com/logo.png");
  });

  it("ignora chaves desconhecidas e mantém defaults", () => {
    const m = lerMarca([{ chave: "tema", valor: "claro" }]);
    expect(m.empresa).toBe("Web Security Analyzer");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/reports/branding.service.test.ts`
Expected: FAIL — `Cannot find module './branding.service'`.

- [ ] **Step 3: Implementar `branding.service.ts`**

```ts
import type { MarcaRelatorio } from "./relatorio.types";

const PADRAO: MarcaRelatorio = {
  empresa: "Web Security Analyzer",
  site: "",
  auditor: "",
  contato: "",
  logoUrl: "",
};

const MAPA: Record<string, keyof MarcaRelatorio> = {
  "relatorio.empresa": "empresa",
  "relatorio.site": "site",
  "relatorio.auditor": "auditor",
  "relatorio.contato": "contato",
  "relatorio.logoUrl": "logoUrl",
};

export function lerMarca(configs: { chave: string; valor: string }[]): MarcaRelatorio {
  const marca: MarcaRelatorio = { ...PADRAO };
  for (const { chave, valor } of configs) {
    const campo = MAPA[chave];
    if (campo && valor.trim() !== "") marca[campo] = valor;
  }
  return marca;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx vitest run src/reports/branding.service.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/reports/relatorio.types.ts backend/src/reports/branding.service.ts backend/src/reports/branding.service.test.ts
git commit -m "test(report): tipos do relatório e branding.service via TDD"
```

---

### Task 2: charts.svg (TDD)

**Files:**
- Create: `backend/src/reports/charts.svg.ts`
- Test: `backend/src/reports/charts.svg.test.ts`

**Interfaces:**
- Consumes: `ScoreCategoria` de `../types/scanner.types`; `Severidade`.
- Produces:
  - `donutScore(score: number, classificacao: string): string`
  - `barrasCategorias(categorias: ScoreCategoria[]): string`
  - `barrasSeveridade(porSeveridade: Record<Severidade, number>): string`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { donutScore, barrasCategorias, barrasSeveridade } from "./charts.svg";
import type { ScoreCategoria } from "../types/scanner.types";

describe("donutScore", () => {
  it("retorna um SVG contendo o número do score", () => {
    const svg = donutScore(72, "BOA");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("72");
  });
  it("score 0 e 100 não quebram o SVG", () => {
    expect(donutScore(0, "CRITICA").startsWith("<svg")).toBe(true);
    expect(donutScore(100, "EXCELENTE")).toContain("100");
  });
});

describe("barrasCategorias", () => {
  it("gera uma barra (<rect) por categoria", () => {
    const cats: ScoreCategoria[] = [
      { categoria: "HTTPS", pontos: 30, pontosMaximos: 30, problemas: [], aprovados: [] },
      { categoria: "Headers", pontos: 10, pontosMaximos: 25, problemas: [], aprovados: [] },
    ];
    const svg = barrasCategorias(cats);
    expect(svg.startsWith("<svg")).toBe(true);
    expect((svg.match(/<rect/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(svg).toContain("HTTPS");
    expect(svg).toContain("Headers");
  });
  it("lista vazia ainda retorna um SVG", () => {
    expect(barrasCategorias([]).startsWith("<svg")).toBe(true);
  });
});

describe("barrasSeveridade", () => {
  it("mostra a contagem por severidade", () => {
    const svg = barrasSeveridade({ CRITICA: 2, ALTA: 1, MEDIA: 0, BAIXA: 3, INFORMATIVA: 0 });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("Crítica");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/reports/charts.svg.test.ts`
Expected: FAIL — `Cannot find module './charts.svg'`.

- [ ] **Step 3: Implementar `charts.svg.ts`**

```ts
import type { ScoreCategoria, Severidade } from "../types/scanner.types";

const COR = {
  accent: "#2A9D85",
  trilho: "#E2E8F0",
  texto: "#0F172A",
  critica: "#DC2626",
  alta: "#EA580C",
  media: "#D97706",
  baixa: "#2563EB",
  informativa: "#64748B",
};

function escapar(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function donutScore(score: number, classificacao: string): string {
  const v = Math.max(0, Math.min(100, score));
  const r = 52;
  const circ = 2 * Math.PI * r;
  const preenchido = (v / 100) * circ;
  return `<svg width="140" height="140" viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Score ${v}">
  <circle cx="70" cy="70" r="${r}" fill="none" stroke="${COR.trilho}" stroke-width="14"/>
  <circle cx="70" cy="70" r="${r}" fill="none" stroke="${COR.accent}" stroke-width="14"
    stroke-dasharray="${preenchido.toFixed(2)} ${circ.toFixed(2)}" stroke-linecap="round"
    transform="rotate(-90 70 70)"/>
  <text x="70" y="68" text-anchor="middle" font-size="30" font-weight="700" fill="${COR.texto}">${v}</text>
  <text x="70" y="88" text-anchor="middle" font-size="11" fill="${COR.informativa}">${escapar(classificacao)}</text>
</svg>`;
}

export function barrasCategorias(categorias: ScoreCategoria[]): string {
  const larguraBarra = 280;
  const alturaLinha = 28;
  const altura = Math.max(alturaLinha, categorias.length * alturaLinha) + 10;
  const linhas = categorias
    .map((c, i) => {
      const y = i * alturaLinha + 6;
      const frac = c.pontosMaximos ? c.pontos / c.pontosMaximos : 0;
      const w = Math.round(frac * larguraBarra);
      return `<text x="0" y="${y + 12}" font-size="11" fill="${COR.texto}">${escapar(c.categoria)}</text>
  <rect x="120" y="${y}" width="${larguraBarra}" height="16" rx="3" fill="${COR.trilho}"/>
  <rect x="120" y="${y}" width="${w}" height="16" rx="3" fill="${COR.accent}"/>
  <text x="${120 + larguraBarra + 6}" y="${y + 12}" font-size="10" fill="${COR.informativa}">${c.pontos}/${c.pontosMaximos}</text>`;
    })
    .join("\n  ");
  return `<svg width="460" height="${altura}" viewBox="0 0 460 ${altura}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Pontos por categoria">
  ${linhas}
</svg>`;
}

export function barrasSeveridade(porSeveridade: Record<Severidade, number>): string {
  const ordem: { chave: Severidade; rotulo: string; cor: string }[] = [
    { chave: "CRITICA", rotulo: "Crítica", cor: COR.critica },
    { chave: "ALTA", rotulo: "Alta", cor: COR.alta },
    { chave: "MEDIA", rotulo: "Média", cor: COR.media },
    { chave: "BAIXA", rotulo: "Baixa", cor: COR.baixa },
    { chave: "INFORMATIVA", rotulo: "Informativa", cor: COR.informativa },
  ];
  const max = Math.max(1, ...ordem.map((o) => porSeveridade[o.chave]));
  const larguraBarra = 240;
  const alturaLinha = 26;
  const altura = ordem.length * alturaLinha + 10;
  const linhas = ordem
    .map((o, i) => {
      const y = i * alturaLinha + 6;
      const w = Math.round((porSeveridade[o.chave] / max) * larguraBarra);
      return `<text x="0" y="${y + 12}" font-size="11" fill="${COR.texto}">${o.rotulo}</text>
  <rect x="90" y="${y}" width="${larguraBarra}" height="16" rx="3" fill="${COR.trilho}"/>
  <rect x="90" y="${y}" width="${w}" height="16" rx="3" fill="${o.cor}"/>
  <text x="${90 + larguraBarra + 6}" y="${y + 12}" font-size="10" fill="${COR.informativa}">${porSeveridade[o.chave]}</text>`;
    })
    .join("\n  ");
  return `<svg width="380" height="${altura}" viewBox="0 0 380 ${altura}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Achados por severidade">
  ${linhas}
</svg>`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx vitest run src/reports/charts.svg.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/reports/charts.svg.ts backend/src/reports/charts.svg.test.ts
git commit -m "test(report): gráficos SVG (donut/barras) via TDD"
```

---

### Task 3: html.report (TDD)

**Files:**
- Create: `backend/src/reports/html.report.ts`
- Test: `backend/src/reports/html.report.test.ts`

**Interfaces:**
- Consumes: `DadosRelatorio` (Task 1); `donutScore`, `barrasCategorias`, `barrasSeveridade` (Task 2); `SEVERIDADE_LABEL` de `../services/vulnerabilidades.catalog`.
- Produces: `gerarRelatorioHtml(dados: DadosRelatorio): string`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { gerarRelatorioHtml } from "./html.report";
import type { DadosRelatorio } from "./relatorio.types";

function dados(over: Partial<DadosRelatorio> = {}): DadosRelatorio {
  return {
    url: "https://exemplo.com",
    criadoEm: "2026-06-27T10:00:00.000Z",
    concluidoEm: "2026-06-27T10:00:03.000Z",
    score: 72,
    classificacao: "BOA",
    resultado: {
      https: { habilitado: true, versaoTLS: "TLSv1.3", emissor: "R3", diasParaExpirar: 80, cadeiaConfiavel: true },
      headers: { contentSecurityPolicy: null, strictTransportSecurity: "x", xFrameOptions: "x", xContentTypeOptions: "x", referrerPolicy: "x", permissionsPolicy: "x" },
      cookies: [{ nome: "sid", secure: true, httpOnly: true, sameSite: "Lax" }],
      exposicao: { server: "nginx", xPoweredBy: null, comentariosHtmlEncontrados: 2, robotsTxtExiste: true, sitemapXmlExiste: false },
      tecnologias: { frameworks: ["React"], cms: [], servidorWeb: "nginx", cdn: [], bibliotecasJs: [], linguagem: null },
      performance: { tempoRespostaMs: 320, compressao: "br", cache: "max-age=60", tamanhoPaginaBytes: 2048, quantidadeRequisicoesIniciais: 5 },
    },
    categorias: [
      { categoria: "HTTPS", pontos: 30, pontosMaximos: 30, problemas: [], aprovados: ["ok"] },
      { categoria: "Headers", pontos: 20, pontosMaximos: 25, problemas: ["CSP ausente"], aprovados: [] },
    ],
    vulnerabilidades: [
      { id: "v1", refId: "header-csp-ausente", titulo: "CSP ausente", descricao: "d", categoria: "Headers", severidade: "ALTA", cvss: 6.1, impacto: 4, facilidadeCorrecao: 2, tempoEstimado: "2-4h", tempoEstimadoMin: 180, recomendacao: "Defina CSP" },
    ],
    resumoPrioridades: { total: 1, porSeveridade: { CRITICA: 0, ALTA: 1, MEDIA: 0, BAIXA: 0, INFORMATIVA: 0 }, tempoTotalEstimadoMin: 180, corrijaPrimeiro: [] },
    marca: { empresa: "ACME Seg", site: "acme.com", auditor: "Cícero", contato: "ci@acme.com", logoUrl: "" },
    ...over,
  };
}

describe("gerarRelatorioHtml", () => {
  it("é um documento HTML completo", () => {
    const html = gerarRelatorioHtml(dados());
    expect(html).toContain("<!DOCTYPE html>");
    expect(html.toLowerCase()).toContain("<html");
    expect(html).toContain("</html>");
  });

  it("capa traz empresa, site e URL auditada", () => {
    const html = gerarRelatorioHtml(dados());
    expect(html).toContain("ACME Seg");
    expect(html).toContain("acme.com");
    expect(html).toContain("https://exemplo.com");
  });

  it("inclui índice clicável com âncoras que existem como ids de seção", () => {
    const html = gerarRelatorioHtml(dados());
    for (const id of ["resumo", "graficos", "linha-do-tempo", "evidencias", "plano-de-acao", "recomendacoes", "assinatura"]) {
      expect(html).toContain(`href="#${id}"`);
      expect(html).toContain(`id="${id}"`);
    }
  });

  it("embute os gráficos SVG", () => {
    const html = gerarRelatorioHtml(dados());
    expect((html.match(/<svg/g) || []).length).toBeGreaterThanOrEqual(3);
  });

  it("mostra evidências técnicas (cookie e certificado)", () => {
    const html = gerarRelatorioHtml(dados());
    expect(html).toContain("sid");
    expect(html).toContain("TLSv1.3");
  });

  it("lista os achados do plano de ação com severidade", () => {
    const html = gerarRelatorioHtml(dados());
    expect(html).toContain("CSP ausente");
    expect(html).toContain("Alta");
  });

  it("assinatura mostra auditor e empresa", () => {
    const html = gerarRelatorioHtml(dados());
    const fim = html.slice(html.indexOf('id="assinatura"'));
    expect(fim).toContain("Cícero");
    expect(fim).toContain("ACME Seg");
  });

  it("traz CSS de impressão com quebra de página", () => {
    const html = gerarRelatorioHtml(dados());
    expect(html).toContain("@media print");
    expect(html).toContain("break-before");
  });

  it("sem vulnerabilidades, o plano mostra estado positivo", () => {
    const html = gerarRelatorioHtml(dados({ vulnerabilidades: [], resumoPrioridades: { total: 0, porSeveridade: { CRITICA: 0, ALTA: 0, MEDIA: 0, BAIXA: 0, INFORMATIVA: 0 }, tempoTotalEstimadoMin: 0, corrijaPrimeiro: [] } }));
    expect(html).toContain("Nenhuma vulnerabilidade");
  });

  it("escapa HTML vindo dos dados (sem injeção)", () => {
    const html = gerarRelatorioHtml(dados({ url: "https://x.com/<script>alert(1)</script>" }));
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/reports/html.report.test.ts`
Expected: FAIL — `Cannot find module './html.report'`.

- [ ] **Step 3: Implementar `html.report.ts`**

Requisitos da implementação (todos cobertos pelos testes acima):
- Documento começando com `<!DOCTYPE html>`, `<html lang="pt-BR">`, `<meta charset>`.
- `<style>` com CSS base + bloco `@media print` contendo `break-before: page` nas seções e `@page { margin: 18mm; }` com numeração no rodapé.
- Capa: logo (se `logoUrl`, `<img>` com `onerror` para esconder), `marca.empresa`, `marca.site`, título "Relatório de Análise de Segurança", `url`, data formatada de `criadoEm`, `marca.auditor`.
- Índice (`<nav>`): links `href="#<id>"` para as seções `resumo, graficos, linha-do-tempo, evidencias, plano-de-acao, recomendacoes, assinatura`.
- Seções com os respectivos `id`:
  - `resumo`: score, classificação, total de achados e contagem por severidade.
  - `graficos`: `donutScore`, `barrasCategorias`, `barrasSeveridade` (SVG inline).
  - `linha-do-tempo`: criadoEm, concluidoEm e duração (se ambos).
  - `evidencias`: tabela/itens com HTTPS (versão TLS, emissor, dias p/ expirar), headers presentes/ausentes, cookies (nome + atributos), exposição, performance (tempos).
  - `plano-de-acao`: lista ordenada de `vulnerabilidades` com título, `SEVERIDADE_LABEL[severidade]`, CVSS, tempo; se vazio, texto "Nenhuma vulnerabilidade identificada".
  - `recomendacoes`: recomendações dos achados (dedup por `refId`).
  - `assinatura`: auditor, empresa, contato e data.
- Toda interpolação de dados passa por uma função `esc()` (escapa `& < > "`).

Código:

```ts
import type { DadosRelatorio } from "./relatorio.types";
import type { Severidade } from "../types/scanner.types";
import { donutScore, barrasCategorias, barrasSeveridade } from "./charts.svg";
import { SEVERIDADE_LABEL } from "../services/vulnerabilidades.catalog";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dataBr(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function duracao(ini: string, fim: string | null): string {
  if (!fim) return "—";
  const ms = new Date(fim).getTime() - new Date(ini).getTime();
  if (ms < 0) return "—";
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}min ${s % 60}s`;
}

const ORDEM_SEV: Severidade[] = ["CRITICA", "ALTA", "MEDIA", "BAIXA", "INFORMATIVA"];

export function gerarRelatorioHtml(d: DadosRelatorio): string {
  const { marca, resultado: r } = d;

  const logo = marca.logoUrl
    ? `<img class="logo" src="${esc(marca.logoUrl)}" alt="logo" onerror="this.style.display='none'"/>`
    : "";

  const resumoSev = ORDEM_SEV
    .map((s) => `<li><strong>${d.resumoPrioridades.porSeveridade[s]}</strong> ${SEVERIDADE_LABEL[s]}</li>`)
    .join("");

  const cookies = r.cookies.length
    ? r.cookies
        .map(
          (c) =>
            `<tr><td>${esc(c.nome)}</td><td>${c.secure ? "✓" : "✗"}</td><td>${c.httpOnly ? "✓" : "✗"}</td><td>${esc(c.sameSite || "—")}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="4">Nenhum cookie na resposta inicial.</td></tr>`;

  const headersList = [
    ["Content-Security-Policy", r.headers.contentSecurityPolicy],
    ["Strict-Transport-Security", r.headers.strictTransportSecurity],
    ["X-Frame-Options", r.headers.xFrameOptions],
    ["X-Content-Type-Options", r.headers.xContentTypeOptions],
    ["Referrer-Policy", r.headers.referrerPolicy],
    ["Permissions-Policy", r.headers.permissionsPolicy],
  ]
    .map(([nome, val]) => `<tr><td>${esc(nome)}</td><td>${val ? "Presente" : "Ausente"}</td></tr>`)
    .join("");

  const planoLinhas = d.vulnerabilidades.length
    ? d.vulnerabilidades
        .map(
          (v) =>
            `<tr><td>${esc(SEVERIDADE_LABEL[v.severidade])}</td><td>${esc(v.titulo)}${v.detalhe ? ` <span class="muted">(${esc(v.detalhe)})</span>` : ""}</td><td>${esc(v.categoria)}</td><td>${v.cvss.toFixed(1)}</td><td>${esc(v.tempoEstimado)}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="5">Nenhuma vulnerabilidade identificada. 🎉</td></tr>`;

  const recsVistas = new Set<string>();
  const recomendacoes = d.vulnerabilidades
    .filter((v) => (recsVistas.has(v.refId) ? false : (recsVistas.add(v.refId), true)))
    .map((v) => `<li><strong>${esc(v.titulo)}:</strong> ${esc(v.recomendacao)}</li>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Relatório de Análise de Segurança — ${esc(d.url)}</title>
<style>
  :root { --accent:#2A9D85; --line:#E2E8F0; --muted:#64748B; --texto:#0F172A; }
  * { box-sizing: border-box; }
  body { font-family: Inter, system-ui, Arial, sans-serif; color: var(--texto); margin: 0; background:#fff; }
  .pagina { max-width: 820px; margin: 0 auto; padding: 32px; }
  h1,h2 { color: var(--texto); }
  h2 { border-bottom: 2px solid var(--line); padding-bottom: 6px; margin-top: 0; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th,td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); }
  .muted { color: var(--muted); }
  .capa { text-align:center; padding: 80px 0; }
  .logo { max-height: 64px; margin-bottom: 16px; }
  nav ul { list-style: none; padding: 0; }
  nav a { color: var(--accent); text-decoration: none; }
  .secao { margin-top: 28px; }
  .badge { display:inline-block; padding:2px 8px; border-radius:999px; background:var(--line); font-size:12px; }
  @page { margin: 18mm; }
  @media print {
    .pagina { max-width: none; padding: 0; }
    .secao, .capa { break-before: page; }
    nav { break-after: page; }
  }
</style>
</head>
<body>
<div class="pagina">

  <header class="capa">
    ${logo}
    <p class="muted">${esc(marca.empresa)}${marca.site ? ` · ${esc(marca.site)}` : ""}</p>
    <h1>Relatório de Análise de Segurança</h1>
    <p><strong>${esc(d.url)}</strong></p>
    <p class="muted">Gerado em ${dataBr(d.criadoEm)}${marca.auditor ? ` · Auditor: ${esc(marca.auditor)}` : ""}</p>
  </header>

  <nav>
    <h2>Sumário</h2>
    <ul>
      <li><a href="#resumo">1. Resumo Executivo</a></li>
      <li><a href="#graficos">2. Gráficos</a></li>
      <li><a href="#linha-do-tempo">3. Linha do Tempo</a></li>
      <li><a href="#evidencias">4. Evidências Técnicas</a></li>
      <li><a href="#plano-de-acao">5. Plano de Ação</a></li>
      <li><a href="#recomendacoes">6. Recomendações</a></li>
      <li><a href="#assinatura">7. Assinatura</a></li>
    </ul>
  </nav>

  <section id="resumo" class="secao">
    <h2>1. Resumo Executivo</h2>
    <p>Score geral: <strong>${d.score}/100</strong> — ${esc(d.classificacao)}.</p>
    <p>Total de achados: <strong>${d.resumoPrioridades.total}</strong>. Esforço estimado: ${d.resumoPrioridades.tempoTotalEstimadoMin} min.</p>
    <ul>${resumoSev}</ul>
  </section>

  <section id="graficos" class="secao">
    <h2>2. Gráficos</h2>
    <div>${donutScore(d.score, d.classificacao)}</div>
    <div>${barrasCategorias(d.categorias)}</div>
    <div>${barrasSeveridade(d.resumoPrioridades.porSeveridade)}</div>
  </section>

  <section id="linha-do-tempo" class="secao">
    <h2>3. Linha do Tempo</h2>
    <table>
      <tr><td>Auditoria iniciada</td><td>${dataBr(d.criadoEm)}</td></tr>
      <tr><td>Auditoria concluída</td><td>${dataBr(d.concluidoEm)}</td></tr>
      <tr><td>Duração</td><td>${duracao(d.criadoEm, d.concluidoEm)}</td></tr>
    </table>
  </section>

  <section id="evidencias" class="secao">
    <h2>4. Evidências Técnicas</h2>
    <h3>HTTPS / TLS</h3>
    <table>
      <tr><td>Habilitado</td><td>${r.https.habilitado ? "Sim" : "Não"}</td></tr>
      <tr><td>Versão TLS</td><td>${esc(r.https.versaoTLS || "—")}</td></tr>
      <tr><td>Emissor</td><td>${esc(r.https.emissor || "—")}</td></tr>
      <tr><td>Dias para expirar</td><td>${r.https.diasParaExpirar ?? "—"}</td></tr>
    </table>
    <h3>Cabeçalhos HTTP</h3>
    <table><thead><tr><th>Cabeçalho</th><th>Estado</th></tr></thead><tbody>${headersList}</tbody></table>
    <h3>Cookies</h3>
    <table><thead><tr><th>Nome</th><th>Secure</th><th>HttpOnly</th><th>SameSite</th></tr></thead><tbody>${cookies}</tbody></table>
    <h3>Performance</h3>
    <table>
      <tr><td>Tempo de resposta</td><td>${r.performance.tempoRespostaMs} ms</td></tr>
      <tr><td>Compressão</td><td>${esc(r.performance.compressao || "—")}</td></tr>
      <tr><td>Cache</td><td>${esc(r.performance.cache || "—")}</td></tr>
    </table>
  </section>

  <section id="plano-de-acao" class="secao">
    <h2>5. Plano de Ação</h2>
    <table><thead><tr><th>Severidade</th><th>Achado</th><th>Categoria</th><th>CVSS</th><th>Esforço</th></tr></thead>
    <tbody>${planoLinhas}</tbody></table>
  </section>

  <section id="recomendacoes" class="secao">
    <h2>6. Recomendações</h2>
    <ul>${recomendacoes || "<li>Nenhuma recomendação adicional.</li>"}</ul>
  </section>

  <section id="assinatura" class="secao">
    <h2>7. Assinatura</h2>
    <p>Relatório emitido por <strong>${esc(marca.empresa)}</strong>${marca.site ? ` (${esc(marca.site)})` : ""}.</p>
    <p>Auditor responsável: <strong>${esc(marca.auditor || "—")}</strong>${marca.contato ? ` · ${esc(marca.contato)}` : ""}.</p>
    <p class="muted">Data de emissão: ${dataBr(d.concluidoEm || d.criadoEm)}</p>
    <p class="muted">Verificações exclusivamente passivas; nenhuma exploração de vulnerabilidades foi realizada.</p>
  </section>

</div>
</body>
</html>`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx vitest run src/reports/html.report.test.ts`
Expected: PASS (10 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/reports/html.report.ts backend/src/reports/html.report.test.ts
git commit -m "test(report): gerador de HTML profissional via TDD"
```

---

### Task 4: Endpoint HTML + montagem de DadosRelatorio

**Files:**
- Modify: `backend/src/controllers/auditoria.controller.ts`
- Modify: `backend/src/routes/auditoria.routes.ts`
- Test: `backend/src/reports/montarDados.test.ts`
- Create (helper): `backend/src/reports/montarDados.ts`

**Interfaces:**
- Consumes: `lerMarca` (Task 1), `DadosRelatorio` (Task 1).
- Produces: `montarDadosRelatorio(auditoria, resultadoSerializado, configs): DadosRelatorio` (pura, testável) e a rota `GET /auditorias/:id/relatorio.html`.

- [ ] **Step 1: Escrever o teste que falha** (`montarDados.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { montarDadosRelatorio } from "./montarDados";

const auditoria = {
  url: "https://exemplo.com",
  criadoEm: new Date("2026-06-27T10:00:00Z"),
  concluidoEm: new Date("2026-06-27T10:00:03Z"),
  score: 72,
  classificacao: "BOA" as const,
};
const resultado = {
  https: { habilitado: true }, headers: { contentSecurityPolicy: null, strictTransportSecurity: null, xFrameOptions: null, xContentTypeOptions: null, referrerPolicy: null, permissionsPolicy: null },
  cookies: [], exposicao: { server: null, xPoweredBy: null, comentariosHtmlEncontrados: 0, robotsTxtExiste: false, sitemapXmlExiste: false },
  tecnologias: { frameworks: [], cms: [], servidorWeb: null, cdn: [], bibliotecasJs: [], linguagem: null },
  performance: { tempoRespostaMs: 100, compressao: null, cache: null, tamanhoPaginaBytes: 1, quantidadeRequisicoesIniciais: 1 },
  scoreDetalhe: [{ categoria: "HTTPS", pontos: 30, pontosMaximos: 30, problemas: [], aprovados: [] }],
  vulnerabilidades: [{ id: "v1", refId: "header-csp-ausente", titulo: "CSP ausente", descricao: "d", categoria: "Headers", severidade: "ALTA", cvss: 6.1, impacto: 4, facilidadeCorrecao: 2, tempoEstimado: "2-4h", tempoEstimadoMin: 180, recomendacao: "Defina CSP" }],
};

describe("montarDadosRelatorio", () => {
  it("monta DadosRelatorio combinando auditoria, resultado e marca", () => {
    const d = montarDadosRelatorio(auditoria, resultado, [{ chave: "relatorio.empresa", valor: "ACME" }]);
    expect(d.url).toBe("https://exemplo.com");
    expect(d.score).toBe(72);
    expect(d.categorias).toHaveLength(1);
    expect(d.vulnerabilidades).toHaveLength(1);
    expect(d.marca.empresa).toBe("ACME");
    expect(d.resumoPrioridades.total).toBe(1);
    expect(d.resumoPrioridades.porSeveridade.ALTA).toBe(1);
  });

  it("converte datas para ISO string", () => {
    const d = montarDadosRelatorio(auditoria, resultado, []);
    expect(typeof d.criadoEm).toBe("string");
    expect(d.criadoEm).toContain("2026-06-27");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/reports/montarDados.test.ts`
Expected: FAIL — `Cannot find module './montarDados'`.

- [ ] **Step 3: Implementar `montarDados.ts`**

```ts
import type { DadosRelatorio } from "./relatorio.types";
import type { ScanResultado, ScoreCategoria, Vulnerabilidade } from "../types/scanner.types";
import { lerMarca } from "./branding.service";
import { resumirPrioridades } from "../services/priorizacao.service";

interface AuditoriaBasica {
  url: string;
  criadoEm: Date;
  concluidoEm: Date | null;
  score: number | null;
  classificacao: "EXCELENTE" | "BOA" | "ATENCAO" | "CRITICA" | null;
}

interface ResultadoDesserializado extends ScanResultado {
  scoreDetalhe: ScoreCategoria[];
  vulnerabilidades: Vulnerabilidade[];
}

export function montarDadosRelatorio(
  auditoria: AuditoriaBasica,
  resultado: ResultadoDesserializado,
  configs: { chave: string; valor: string }[],
): DadosRelatorio {
  const vulnerabilidades = resultado.vulnerabilidades ?? [];
  return {
    url: auditoria.url,
    criadoEm: auditoria.criadoEm.toISOString(),
    concluidoEm: auditoria.concluidoEm ? auditoria.concluidoEm.toISOString() : null,
    score: auditoria.score ?? 0,
    classificacao: auditoria.classificacao ?? "CRITICA",
    resultado: {
      https: resultado.https,
      headers: resultado.headers,
      cookies: resultado.cookies,
      exposicao: resultado.exposicao,
      tecnologias: resultado.tecnologias,
      performance: resultado.performance,
    },
    categorias: resultado.scoreDetalhe ?? [],
    vulnerabilidades,
    resumoPrioridades: resumirPrioridades(vulnerabilidades),
    marca: lerMarca(configs),
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx vitest run src/reports/montarDados.test.ts`
Expected: PASS.

- [ ] **Step 5: Adicionar o handler na controller**

Em `backend/src/controllers/auditoria.controller.ts`, adicionar imports no topo:

```ts
import { gerarRelatorioHtml } from "../reports/html.report";
import { montarDadosRelatorio } from "../reports/montarDados";
```

E adicionar a função handler (após `buscarRelatorioMarkdown`):

```ts
export async function buscarRelatorioHtml(req: Request, res: Response) {
  const auditoria = await prisma.auditoria.findUnique({
    where: { id: req.params.id },
    include: { resultado: true },
  });
  if (!auditoria || !auditoria.resultado) {
    throw new HttpError(404, "Relatório não disponível para esta auditoria.");
  }

  const configs = await prisma.configuracao.findMany();
  const resultado = {
    https: JSON.parse(auditoria.resultado.https),
    headers: JSON.parse(auditoria.resultado.headers),
    cookies: JSON.parse(auditoria.resultado.cookies),
    exposicao: JSON.parse(auditoria.resultado.exposicao),
    tecnologias: JSON.parse(auditoria.resultado.tecnologias),
    performance: JSON.parse(auditoria.resultado.performance),
    scoreDetalhe: JSON.parse(auditoria.resultado.scoreDetalhe),
    vulnerabilidades: JSON.parse(auditoria.resultado.vulnerabilidades || "[]"),
  };

  const dados = montarDadosRelatorio(auditoria, resultado, configs);
  const html = gerarRelatorioHtml(dados);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
}
```

- [ ] **Step 6: Registrar a rota**

Em `backend/src/routes/auditoria.routes.ts`, importar `buscarRelatorioHtml` junto dos demais handlers e adicionar **antes** da rota genérica `/:id` (para evitar conflito), na mesma vizinhança de `/:id/relatorio`:

```ts
router.get("/:id/relatorio.html", asyncHandler(buscarRelatorioHtml));
```

- [ ] **Step 7: Verificar typecheck + suíte**

Run: `cd backend && npx tsc --noEmit && npm test`
Expected: tsc sem erros; todos os testes passam.

- [ ] **Step 8: Commit**

```bash
git add backend/src/reports/montarDados.ts backend/src/reports/montarDados.test.ts backend/src/controllers/auditoria.controller.ts backend/src/routes/auditoria.routes.ts
git commit -m "feat(report): endpoint GET /auditorias/:id/relatorio.html"
```

---

### Task 5: Markdown aprimorado (TDD)

**Files:**
- Modify: `backend/src/reports/markdown.report.ts`
- Test: `backend/src/reports/markdown.report.test.ts`

**Interfaces:**
- Consumes: `gerarRelatorioMarkdown(url, resultado, scoreFinal)` (assinatura mantida).
- Note: a marca não é passada aqui (mantém a assinatura atual). As novas seções
  são metadados/evidências/assinatura genérica derivadas dos dados já recebidos.

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { gerarRelatorioMarkdown } from "./markdown.report";
import { calcularScore } from "../services/scoring.service";
import type { ScanResultado } from "../types/scanner.types";

function base(): ScanResultado {
  return {
    https: { habilitado: true, versaoTLS: "TLSv1.3", emissor: "R3", diasParaExpirar: 90, cadeiaConfiavel: true },
    headers: { contentSecurityPolicy: null, strictTransportSecurity: "x", xFrameOptions: "x", xContentTypeOptions: "x", referrerPolicy: "x", permissionsPolicy: "x" },
    cookies: [{ nome: "sid", secure: true, httpOnly: true, sameSite: "Lax" }],
    exposicao: { server: "nginx", xPoweredBy: null, comentariosHtmlEncontrados: 0, robotsTxtExiste: true, sitemapXmlExiste: true },
    tecnologias: { frameworks: [], cms: [], servidorWeb: "nginx", cdn: [], bibliotecasJs: [], linguagem: null },
    performance: { tempoRespostaMs: 200, compressao: "br", cache: "max-age=60", tamanhoPaginaBytes: 1000, quantidadeRequisicoesIniciais: 3 },
  };
}

describe("gerarRelatorioMarkdown (aprimorado)", () => {
  it("mantém o plano de ação priorizado da Sprint 1", () => {
    const r = base();
    const md = gerarRelatorioMarkdown("https://exemplo.com", r, calcularScore(r));
    expect(md).toContain("Plano de Ação Priorizado");
  });

  it("inclui seção de evidências técnicas", () => {
    const r = base();
    const md = gerarRelatorioMarkdown("https://exemplo.com", r, calcularScore(r));
    expect(md).toContain("## Evidências Técnicas");
    expect(md).toContain("TLSv1.3");
    expect(md).toContain("sid");
  });

  it("inclui assinatura ao final", () => {
    const r = base();
    const md = gerarRelatorioMarkdown("https://exemplo.com", r, calcularScore(r));
    expect(md).toContain("## Assinatura");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/reports/markdown.report.test.ts`
Expected: FAIL — faltam "## Evidências Técnicas" e "## Assinatura".

- [ ] **Step 3: Implementar as novas seções**

Em `backend/src/reports/markdown.report.ts`, dentro do template retornado por `gerarRelatorioMarkdown`, inserir **antes** da linha `## Conclusão` os blocos abaixo (usando as variáveis `resultado` e `dataHora` já existentes na função):

```ts
## Evidências Técnicas

**HTTPS/TLS:** ${resultado.https.habilitado ? "habilitado" : "ausente"}${resultado.https.versaoTLS ? ` · ${resultado.https.versaoTLS}` : ""}${resultado.https.emissor ? ` · Emissor: ${resultado.https.emissor}` : ""}${resultado.https.diasParaExpirar !== undefined ? ` · Expira em ${resultado.https.diasParaExpirar} dia(s)` : ""}

**Cookies:** ${resultado.cookies.length > 0 ? resultado.cookies.map((c) => `${c.nome} (Secure=${c.secure}, HttpOnly=${c.httpOnly}, SameSite=${c.sameSite || "—"})`).join("; ") : "nenhum cookie na resposta inicial."}

**Performance:** tempo de resposta ${resultado.performance.tempoRespostaMs} ms · compressão ${resultado.performance.compressao || "nenhuma"} · cache ${resultado.performance.cache || "nenhum"}.
```

E **após** a seção `## Conclusão` (antes do rodapé final em itálico), inserir:

```ts
## Assinatura

Relatório emitido pelo Web Security Analyzer em ${dataHora}.
As verificações realizadas são exclusivamente passivas.
```

(Concatenar essas strings no template literal existente; não alterar a assinatura da função.)

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx vitest run src/reports/markdown.report.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/reports/markdown.report.ts backend/src/reports/markdown.report.test.ts
git commit -m "test(report): markdown com evidências e assinatura via TDD"
```

---

### Task 6: Frontend — Exportar PDF/HTML/MD

**Files:**
- Modify: `frontend/src/services/api.ts`
- Modify: `frontend/src/pages/VisualizadorRelatorio.tsx`

**Interfaces:**
- Consumes: endpoints `/auditorias/:id/relatorio.html` (Task 4) e `/auditorias/:id/relatorio` (MD existente).
- Produces: `buscarRelatorioHtml(id): Promise<string>` e UI de exportação.

- [ ] **Step 1: Adicionar a função de API**

Em `frontend/src/services/api.ts`, após `buscarRelatorioMarkdown`:

```ts
export async function buscarRelatorioHtml(id: string): Promise<string> {
  const { data } = await api.get(`/auditorias/${id}/relatorio.html`, { responseType: "text" });
  return data;
}
```

- [ ] **Step 2: Implementar a UI de exportação**

Em `frontend/src/pages/VisualizadorRelatorio.tsx`:
- importar `buscarRelatorioHtml` e `buscarRelatorioMarkdown`.
- adicionar helpers e botões (substituir o botão único "Ver relatório em Markdown" por um grupo de exportação). Código dos helpers:

```tsx
function baixarArquivo(nome: string, conteudo: string, tipo: string) {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportarPdf(id: string) {
  const html = await buscarRelatorioHtml(id);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  iframe.srcdoc = html;
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  };
}
```

Botões (no cabeçalho do relatório, quando `auditoria.relatorio` existir):

```tsx
<div className="flex gap-3">
  <button onClick={() => exportarPdf(auditoria.id)} className="text-xs text-accent hover:underline">Exportar PDF</button>
  <button onClick={async () => baixarArquivo(`relatorio-${auditoria.id}.html`, await buscarRelatorioHtml(auditoria.id), "text/html")} className="text-xs text-accent hover:underline">Exportar HTML</button>
  <button onClick={async () => baixarArquivo(`relatorio-${auditoria.id}.md`, await buscarRelatorioMarkdown(auditoria.id), "text/markdown")} className="text-xs text-accent hover:underline">Exportar Markdown</button>
</div>
```

(Manter o restante da página intacto. Pode remover o estado `mostrarMarkdown` se não for mais usado, ou mantê-lo — sem regressão.)

- [ ] **Step 3: Verificar build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: sem erros; build conclui.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/api.ts frontend/src/pages/VisualizadorRelatorio.tsx
git commit -m "feat(report): exportação de PDF/HTML/Markdown no visualizador"
```

---

### Task 7: Frontend — Seção de marca em Configurações

**Files:**
- Modify: `frontend/src/pages/Configuracoes.tsx`
- Modify: `frontend/src/services/api.ts`

**Interfaces:**
- Consumes: `GET /configuracoes`, `PUT /configuracoes` (existentes).
- Produces: UI para editar `relatorio.empresa`, `relatorio.site`, `relatorio.auditor`, `relatorio.contato`, `relatorio.logoUrl`.

- [ ] **Step 1: Funções de API**

Em `frontend/src/services/api.ts`:

```ts
export async function listarConfiguracoes(): Promise<{ chave: string; valor: string }[]> {
  const { data } = await api.get("/configuracoes");
  return data.dados;
}

export async function salvarConfiguracao(chave: string, valor: string): Promise<void> {
  await api.put("/configuracoes", { chave, valor });
}
```

- [ ] **Step 2: Seção de marca na página**

Em `frontend/src/pages/Configuracoes.tsx`, adicionar um segundo `Card` "Relatório / Marca" com inputs controlados para os 5 campos, carregando valores via `listarConfiguracoes` no `useEffect` e salvando cada um via `salvarConfiguracao` no botão "Salvar marca". Estrutura:

```tsx
const [marca, setMarca] = useState({ empresa: "", site: "", auditor: "", contato: "", logoUrl: "" });

useEffect(() => {
  listarConfiguracoes().then((cfgs) => {
    const get = (k: string) => cfgs.find((c) => c.chave === k)?.valor ?? "";
    setMarca({
      empresa: get("relatorio.empresa"),
      site: get("relatorio.site"),
      auditor: get("relatorio.auditor"),
      contato: get("relatorio.contato"),
      logoUrl: get("relatorio.logoUrl"),
    });
  }).catch(() => {});
}, []);

async function salvarMarca() {
  await Promise.all([
    salvarConfiguracao("relatorio.empresa", marca.empresa),
    salvarConfiguracao("relatorio.site", marca.site),
    salvarConfiguracao("relatorio.auditor", marca.auditor),
    salvarConfiguracao("relatorio.contato", marca.contato),
    salvarConfiguracao("relatorio.logoUrl", marca.logoUrl),
  ]);
}
```

Renderizar 5 inputs (empresa, site, auditor, contato, logoUrl) com `value`/`onChange` ligados a `marca`, e um botão chamando `salvarMarca` com feedback de sucesso/erro (reusar `Alert`).

- [ ] **Step 3: Verificar build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: sem erros; build conclui.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Configuracoes.tsx frontend/src/services/api.ts
git commit -m "feat(report): edição da marca do relatório em Configurações"
```

---

### Task 8: Verificação final

- [ ] `cd backend && npm test` → todos verdes.
- [ ] `cd backend && npx tsc --noEmit` → sem erros.
- [ ] `cd frontend && npm run build` → sucesso.
- [ ] Conferir manualmente que `GET /auditorias/:id/relatorio.html` (com servidor rodando, opcional) retorna HTML — ou confiar nos testes de `html.report`.
- [ ] Commit final se houver ajustes: `chore(report): verificação Sprint 2`.

## Self-Review

**1. Spec coverage:**
- Capa personalizada → Task 3 (capa) + Task 7 (marca). ✓
- Sumário/índice clicável → Task 3 (nav + âncoras, testado). ✓
- Resumo executivo → Task 3 (#resumo). ✓
- Gráficos → Task 2 + Task 3 (#graficos). ✓
- Linha do tempo → Task 3 (#linha-do-tempo). ✓
- Evidências técnicas → Task 3 (#evidencias) + Task 5 (MD). ✓
- Plano de ação + recomendações priorizadas → Task 3 (#plano-de-acao, #recomendacoes). ✓
- Assinatura → Task 3 (#assinatura) + Task 5 (MD). ✓
- Numeração de páginas → Task 3 (CSS @page/@media print, testado por "break-before"). ✓
- Exportação PDF/HTML/MD → Task 6. ✓
- Marca via Configurações → Task 7. ✓
- Endpoints → Task 4. ✓

**2. Placeholder scan:** sem TBD/TODO; todos os steps de código trazem o código real.

**3. Type consistency:** `DadosRelatorio`/`MarcaRelatorio` (Task 1) usados igualmente em Tasks 3 e 4; `lerMarca(configs[])`, `gerarRelatorioHtml(dados)`, `montarDadosRelatorio(...)`, `buscarRelatorioHtml(id)` consistentes entre tasks; chaves `relatorio.*` idênticas em Tasks 1, 4 e 7; `SEVERIDADE_LABEL` importado de `../services/vulnerabilidades.catalog` (existe).
