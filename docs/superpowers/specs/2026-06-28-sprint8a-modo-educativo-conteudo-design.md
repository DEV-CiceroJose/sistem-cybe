# Sprint 8A — Modo Educativo: Conteúdo (Design / Spec)

**Data:** 2026-06-28
**Autor:** Cícero José (DEV-CiceroJose) + Claude
**Status:** Aguardando revisão do usuário

## Contexto

Primeira metade da Sprint 8 (última do roadmap). A 8B trará a Central de
Aprendizado (quiz + progresso do usuário).

## Objetivo (8A)

Transformar cada achado numa oportunidade de aprendizado: explicação em
linguagem simples e técnica, exemplo de ataque (textual), referências oficiais
(OWASP/MDN/CWE) e glossário, com modo iniciante/avançado, integrado ao Plano de
Ação e ao relatório.

## Decisões aprovadas

- Conteúdo educativo em **catálogo estático no código** (por `refId`).
- **Demonstrações fora de escopo**: exemplos de ataque apenas como texto ilustrativo.
- Modo **iniciante/avançado** alterna explicação simples ↔ técnica (client-side).

## Escopo

### No escopo
- `services/educativo.catalog.ts` (TDD): conteúdo por `refId` + glossário.
- `educativo.controller.ts` + `GET /api/v1/educativo` (protegido).
- Frontend: tipos, `buscarEducativo`, modo iniciante/avançado (localStorage),
  "Modo educativo" expansível no `PlanoDeAcao`, card de Glossário.
- Relatório: apêndice "Aprenda mais" (explicação simples + referências por achado) em HTML e Markdown.

### Fora do escopo (8B / YAGNI)
- Quiz, progresso do usuário, página dedicada de Central de Aprendizado (8B).
- Demonstrações interativas / execução de ataques.
- Edição do conteúdo em runtime / persistência em banco.

## Arquitetura

```
educativo.catalog (estático, por refId) ── obterConteudoEducativo / listarGlossario
        │                                          │
        ├─ GET /api/v1/educativo → { conteudos, glossario }
        │        └─ Frontend: buscarEducativo() → PlanoDeAcao (expansível) + Glossário
        └─ reports: apêndice "Aprenda mais" (html.report / markdown.report)
```

## Contratos (interfaces)

```ts
// educativo.catalog.ts
interface ReferenciaEducativa { titulo: string; url: string }
interface ConteudoEducativo {
  refId: string;
  explicacaoSimples: string;
  explicacaoTecnica: string;
  exemploAtaque: string;        // texto ilustrativo (sem execução)
  referencias: ReferenciaEducativa[];
}
interface TermoGlossario { termo: string; definicao: string }

function obterConteudoEducativo(refId: string): ConteudoEducativo | null;
function listarConteudos(): ConteudoEducativo[];
function listarGlossario(): TermoGlossario[];
```

Cobertura: há um `ConteudoEducativo` para **cada `refId`** que o
`scoring.service` pode emitir (os 19 do `vulnerabilidades.catalog`:
`https-ausente`, `tls-nao-confiavel`, `cert-expirado`, `cert-expirando`,
`header-csp-ausente`, `header-hsts-ausente`, `header-xframe-ausente`,
`header-xcto-ausente`, `header-referrer-ausente`, `header-permissions-ausente`,
`cookie-sem-secure`, `cookie-sem-httponly`, `cookie-sem-samesite`,
`exposicao-server`, `exposicao-xpoweredby`, `exposicao-comentarios`,
`perf-tempo-elevado`, `perf-sem-compressao`, `perf-sem-cache`).

Glossário: ~12 termos (XSS, CSRF, Clickjacking, MIME sniffing, CSP, HSTS, CORS,
TLS/SSL, SPF, DKIM, DMARC, MITM).

## API

`GET /api/v1/educativo` (protegido) →
```json
{ "sucesso": true, "dados": { "conteudos": { "<refId>": ConteudoEducativo, ... }, "glossario": TermoGlossario[] } }
```

## Frontend

- `types/index.ts`: `ReferenciaEducativa`, `ConteudoEducativo`, `TermoGlossario`,
  `Educativo { conteudos: Record<string, ConteudoEducativo>; glossario: TermoGlossario[] }`.
- `services/api.ts`: `buscarEducativo(): Promise<Educativo>`.
- `context` ou estado local: **modo** (`"iniciante" | "avancado"`) em
  `localStorage` (`wsa:modoEducativo`, default `"iniciante"`).
- `components/PlanoDeAcao.tsx`: por achado, um botão "Modo educativo" que expande
  e mostra a explicação (simples no modo iniciante, técnica no avançado), o
  exemplo de ataque e as referências (links). Um seletor de modo no topo do card.
  Carrega o educativo via `buscarEducativo()` uma vez (estado no componente).
- `components/GlossarioCard.tsx`: lista termo/definição (usado no visualizador).
  Renderizado no `VisualizadorRelatorio` quando há achados.

## Relatório

- `reports/educativo.report.ts` (puro): `gerarApendiceEducativoHtml(refIds)` e
  `gerarApendiceEducativoMd(refIds)` que, para os `refId` distintos recebidos,
  emitem a explicação simples + referências.
- `html.report.ts`: nova seção "Aprenda mais" (após Conformidade), com âncora no índice.
- `markdown.report.ts`: seção "## Aprenda mais" após a Conformidade.
- As funções recebem os `refId` a partir de `dados.vulnerabilidades`.

## Tratamento de erros

- `obterConteudoEducativo(refId)` desconhecido → `null` (frontend/relatório omitem).
- `buscarEducativo` falha → seção educativa não renderiza (degrada).
- Sem achados → apêndice "Aprenda mais" mostra "Nenhum achado para detalhar".

## Estratégia de testes (TDD, Vitest backend)

- `educativo.catalog`:
  - existe `ConteudoEducativo` para todos os refIds do `vulnerabilidades.catalog`
    (importa os refIds e verifica `obterConteudoEducativo` ≠ null para cada);
  - cada conteúdo tem explicações não vazias e ≥1 referência com URL `http`;
  - `obterConteudoEducativo("inexistente")` → null;
  - `listarGlossario()` não vazio; termos têm definição.
- `educativo.report`:
  - `gerarApendiceEducativoMd(["header-csp-ausente"])` contém a explicação simples
    e ao menos uma referência;
  - lista vazia → texto de "nenhum achado".
- Controller/UI cobertos por `tsc`/build.

## Critérios de sucesso

- [ ] `npm test` (backend) verde, cobrindo `educativo.catalog` e `educativo.report`.
- [ ] `tsc --noEmit` (backend) e `npm run build` (frontend) sem erros.
- [ ] `GET /educativo` retorna conteúdos + glossário.
- [ ] Plano de Ação mostra "Modo educativo" por achado, com toggle iniciante/avançado.
- [ ] Glossário visível; relatório (HTML/MD) traz o apêndice "Aprenda mais".
- [ ] Cobertura: todos os 19 refIds têm conteúdo educativo.
- [ ] Sem regressão (120 testes anteriores verdes).

## Plano de corte / ordem sugerida

1. `educativo.catalog.ts` (TDD: conteúdo + glossário, cobertura de refIds).
2. `educativo.report.ts` (TDD) + seções no html/markdown.
3. `educativo.controller.ts` + rota + OpenAPI + Postman snapshot.
4. Frontend: tipos + `buscarEducativo` + modo iniciante/avançado + PlanoDeAcao + GlossarioCard.
5. Verificação final.
