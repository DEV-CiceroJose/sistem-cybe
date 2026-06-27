# Sprint 2 — Relatórios Profissionais (Design / Spec)

**Data:** 2026-06-27
**Autor:** Cícero José (DEV-CiceroJose) + Claude
**Status:** Aguardando revisão do usuário

## Objetivo

Gerar relatórios de auditoria prontos para clientes/empresas/auditorias, com
visual profissional, exportáveis em **PDF**, **HTML** e **Markdown**, a partir
dos dados já produzidos pela auditoria (Sprint 1). Sem refazer nenhum scan.

## Decisões aprovadas

- **PDF:** gerado no navegador (print de um HTML autocontido em iframe).
- **Evidências:** técnicas estruturadas (headers, cookies, certificado, tempos,
  timestamps). Sem screenshot do site.
- **Marca/personalização:** vinda de **Configurações** (store chave/valor).
- **Arquitetura:** um único gerador de HTML no backend é a fonte de verdade
  (Approach A). Gráficos como SVG inline. Frontend exibe e dispara export.

## Escopo

### No escopo
Mapeado às funcionalidades do roadmap (Sprint 2):
- Capa personalizada (empresa, logo, título, URL, data, auditor).
- Sumário automático + índice clicável (âncoras internas).
- Resumo executivo (score, classificação, contagem de achados por severidade).
- Gráficos: donut do score, barras de pontos por categoria, barras de
  distribuição por severidade — **SVG inline**.
- Linha do tempo da auditoria (criada → concluída, com duração).
- Evidências técnicas (headers HTTP, atributos de cookies, dados do
  certificado, tempos de resposta).
- Plano de ação priorizado + recomendações priorizadas (reusa Sprint 1).
- Assinatura do relatório (auditor/empresa/contato/data).
- Numeração de páginas (CSS `@page`/print) e rodapé.
- Exportação: PDF (print do HTML), HTML (download do arquivo), Markdown.

### Fora do escopo (YAGNI)
- Screenshot da página auditada (exigiria navegador headless).
- Múltiplos templates selecionáveis / temas de relatório.
- Internacionalização do relatório (fica em pt-BR).
- Geração server-side de PDF (Puppeteer) — pode voltar na Sprint 6 (API).

## Arquitetura

```
Configuracao (chave/valor)──► branding.service ─┐
Auditoria+Resultado+Score+Vulns ────────────────┼─► DadosRelatorio
                                                 │
                       charts.svg (SVG puro) ◄───┤
                                                 ▼
                                   html.report  ─► HTML autocontido (string)
                                   markdown.report ─► Markdown (string)
                                                 ▼
        GET /auditorias/:id/relatorio.html   GET /auditorias/:id/relatorio (MD)
                                                 ▼
              Frontend: VisualizadorRelatorio (Exportar ▾ PDF/HTML/MD)
                        Configuracoes (seção Relatório/Marca)
```

### Unidades (fronteiras claras)

| Arquivo (backend) | Responsabilidade |
|---|---|
| `reports/relatorio.types.ts` | Tipos `MarcaRelatorio`, `DadosRelatorio`. |
| `reports/branding.service.ts` | Lê marca do `Configuracao` com defaults. |
| `reports/charts.svg.ts` | Funções puras → strings SVG (donut, barras). |
| `reports/html.report.ts` | Monta o HTML profissional autocontido. |
| `reports/markdown.report.ts` | (existente) aprimorado com capa/evidências/assinatura. |

Frontend:
| Arquivo | Responsabilidade |
|---|---|
| `pages/VisualizadorRelatorio.tsx` | Botão Exportar ▾ (PDF/HTML/MD). |
| `pages/Configuracoes.tsx` | Seção Relatório/Marca. |
| `services/api.ts` | `buscarRelatorioHtml`, get/set de configurações. |

## Contratos (interfaces)

```ts
// relatorio.types.ts
interface MarcaRelatorio {
  empresa: string;     // default "Web Security Analyzer"
  auditor: string;     // default ""
  contato: string;     // default ""
  logoUrl: string;     // default "" (sem logo)
}

interface DadosRelatorio {
  url: string;
  criadoEm: string;
  concluidoEm: string | null;
  score: number;
  classificacao: "EXCELENTE" | "BOA" | "ATENCAO" | "CRITICA";
  resultado: ScanResultado;            // https, headers, cookies, ...
  categorias: ScoreCategoria[];        // scoreDetalhe
  vulnerabilidades: Vulnerabilidade[];
  resumoPrioridades: ResumoPrioridades;
  marca: MarcaRelatorio;
}

// branding.service.ts
function lerMarca(configs: { chave: string; valor: string }[]): MarcaRelatorio;
// chaves: relatorio.empresa, relatorio.auditor, relatorio.contato, relatorio.logoUrl

// charts.svg.ts  (todas retornam string SVG autocontida)
function donutScore(score: number, classificacao: string): string;
function barrasCategorias(categorias: ScoreCategoria[]): string;
function barrasSeveridade(porSeveridade: Record<Severidade, number>): string;

// html.report.ts
function gerarRelatorioHtml(dados: DadosRelatorio): string;

// markdown.report.ts (mantém assinatura atual)
function gerarRelatorioMarkdown(url, resultado, scoreFinal): string;
```

## Endpoints

- `GET /api/auditorias/:id/relatorio.html` → `text/html; charset=utf-8`,
  HTML autocontido. 404 se auditoria/resultado inexistente.
- `GET /api/auditorias/:id/relatorio` (existente) → Markdown aprimorado.
- `GET /api/configuracoes` e `PUT /api/configuracoes` (existentes) → usados
  para a marca (`relatorio.*`). A geração HTML/MD lê as configs no momento.

## Comportamento de export (frontend)

- **Markdown:** baixa o texto do endpoint atual como `.md`.
- **HTML:** busca `/relatorio.html` e baixa como `.html` (Blob).
- **PDF:** busca `/relatorio.html`, injeta em `iframe` oculto (`srcdoc`),
  chama `iframe.contentWindow.print()`; o usuário salva como PDF. O HTML traz
  CSS `@media print` (quebras de página, `@page` com numeração e margens).

## Numeração de páginas

Via CSS de impressão: `@page { margin; @bottom-right { content: counter(page) }}`
quando suportado; fallback de rodapé fixo por seção. Capa e cada seção principal
com `break-before: page`. (Limitação conhecida do print do navegador é aceita.)

## Tratamento de erros

- Auditoria sem `resultado` (status ERRO/EM_ANDAMENTO) → 404 no endpoint HTML,
  e o frontend mantém a mensagem de erro atual.
- Logo URL inválida → `<img onerror>` esconde a imagem (degrada para sem logo).
- Configs ausentes → defaults da marca.

## Estratégia de testes (TDD, Vitest no backend)

- `branding.service`: defaults quando vazio; override por chave; ignora chaves
  estranhas.
- `charts.svg`: retorna `<svg`; donut reflete o score (ângulo/segmento); barras
  geram uma barra por item; lida com lista vazia / zeros.
- `html.report`: contém a empresa na capa; âncoras do índice batem com ids das
  seções; inclui todas as seções (resumo, gráficos, timeline, evidências, plano,
  recomendações, assinatura); embute os SVGs; tem CSS de quebra de página; sem
  achados → seção de plano mostra estado "sem vulnerabilidades".
- `markdown.report`: novas seções (capa/metadados, evidências, assinatura)
  presentes; mantém o plano de ação da Sprint 1.

Frontend permanece coberto por `tsc`/build (sem runner de testes nesta sprint).

## Critérios de sucesso

- [ ] `npm test` (backend) verde, cobrindo as unidades acima.
- [ ] `npx tsc --noEmit` (backend) e `npm run build` (frontend) sem erros.
- [ ] `GET /relatorio.html` retorna HTML profissional autocontido e válido.
- [ ] Frontend exporta PDF (print), HTML (download) e Markdown.
- [ ] Marca configurável em Configurações reflete na capa/assinatura.
- [ ] Sem regressão na Sprint 1 (achados/score/plano intactos).

## Plano de corte / ordem sugerida (para o plano de implementação)

1. `relatorio.types.ts` + `branding.service.ts` (TDD).
2. `charts.svg.ts` (TDD).
3. `html.report.ts` (TDD) + endpoint HTML + rota.
4. `markdown.report.ts` aprimorado (TDD).
5. Frontend: Exportar ▾ no VisualizadorRelatorio + seção de marca em Configurações.
6. Verificação final (tests, tsc, build).
