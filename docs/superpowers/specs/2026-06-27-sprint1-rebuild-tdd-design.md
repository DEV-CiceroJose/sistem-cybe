# Sprint 1 — Rebuild TDD do Núcleo de Priorização (Design / Spec)

**Data:** 2026-06-27
**Autor:** Cícero José (DEV-CiceroJose) + Claude
**Status:** Aprovado para implementação

## Objetivo

Reconstruir, com **TDD** (Vitest), o núcleo de lógica do Sistema de Prioridades
da Sprint 1 do Web Security Analyzer. O comportamento final deve ser equivalente
ao já entregue, mas agora coberto por testes automatizados executáveis via
`npm test`. A motivação é confiança/regressão: a Sprint 1 foi implementada sem
nenhum teste.

## Escopo

### No escopo (reconstruído test-first)

Três unidades de lógica pura no backend:

1. **`vulnerabilidades.catalog.ts`** — função `criarVulnerabilidade(refId, overrides?)`
   e tabelas auxiliares (`SEVERIDADE_RANK`, `SEVERIDADE_LABEL`). Os dados do
   catálogo são configuração exercitada pelos testes de scoring/ordenação.
2. **`priorizacao.service.ts`** — `ordenarVulnerabilidades()` e `resumirPrioridades()`.
3. **`scoring.service.ts`** — `calcularScore()` (score numérico + emissão de
   `Vulnerabilidade[]` ordenadas + `resumoPrioridades`).

### Fora do escopo (mantido como está, já verificado por build)

- Tipos: `backend/src/types/scanner.types.ts`
- Persistência: `auditoria.controller.ts`, `prisma/schema.prisma`
- Relatório: `reports/markdown.report.ts`
- Todo o frontend: `PlanoDeAcao`, `SeverityBadge`, `utils/severidade`,
  `Dashboard`, `VisualizadorRelatorio`, tipos do frontend.

## Arquitetura

```
scanner → ScanResultado
                │
                ▼
        calcularScore(resultado)                (scoring.service.ts)
           │  emite achados via criarVulnerabilidade()  (catalog)
           │  ordena + resume via priorizacao.service
           ▼
        ScoreFinal { score, classificacao, categorias,
                     vulnerabilidades, resumoPrioridades }
```

Unidades têm fronteiras claras e são testáveis isoladamente:
- **catalog**: dado um `refId`, devolve uma `Vulnerabilidade` com metadados;
  permite overrides dinâmicos (`severidade`, `cvss`, `detalhe`, `descricao`).
- **priorizacao**: funções puras sobre `Vulnerabilidade[]`.
- **scoring**: orquestra catálogo + priorização e calcula a pontuação.

## Contratos (interfaces)

```ts
type Severidade = "CRITICA" | "ALTA" | "MEDIA" | "BAIXA" | "INFORMATIVA";

criarVulnerabilidade(
  refId: string,
  overrides?: Partial<Pick<Vulnerabilidade,
    "severidade" | "cvss" | "detalhe" | "descricao">>
): Vulnerabilidade        // lança Error se refId desconhecido

ordenarVulnerabilidades(v: Vulnerabilidade[]): Vulnerabilidade[]
resumirPrioridades(v: Vulnerabilidade[], topN?: number): ResumoPrioridades

calcularScore(resultado: ScanResultado): ScoreFinal
```

## Regras de negócio (a serem fixadas por testes)

### Ordenação (`ordenarVulnerabilidades`)
Critério em cascata, todos decrescentes:
1. severidade (`SEVERIDADE_RANK`: CRITICA 5 → INFORMATIVA 1)
2. `cvss`
3. `facilidadeCorrecao` (quick wins primeiro dentro da mesma severidade)
4. `impacto`
Não muta o array de entrada (retorna cópia).

### Resumo (`resumirPrioridades`)
- `total` = nº de achados.
- `porSeveridade` = contagem por cada uma das 5 severidades (zeros incluídos).
- `tempoTotalEstimadoMin` = soma de `tempoEstimadoMin`.
- `corrijaPrimeiro` = primeiros `topN` (default 3) já ordenados.

### Scoring (`calcularScore`) — invariantes vs. comportamento original
Pesos: https 30, headers 25, cookies 15, exposicao 15, performance 15 (total 100).
- **HTTPS:** sem HTTPS → 0 pts e achado `https-ausente`. Com HTTPS: +40% base;
  +30% se cadeia confiável (senão achado `tls-nao-confiavel`); validade:
  expirado (`diasParaExpirar < 0`) → achado `cert-expirado` severidade CRÍTICA;
  `< 15` dias → +15% e achado `cert-expirando` severidade MÉDIA; senão +30%.
- **Headers:** 6 cabeçalhos; pontos proporcionais aos presentes; cada ausente
  gera o achado correspondente (`header-*-ausente`).
- **Cookies:** sem cookies → pontuação máxima; senão média por cookie dos 3
  atributos (Secure/HttpOnly/SameSite); cada atributo ausente gera achado com
  `detalhe` contendo o nome do cookie.
- **Exposição:** começa no máximo; −25% por Server, X-Powered-By e
  comentários HTML > 5; cada um gera achado.
- **Performance:** tempo < 800ms (+40%) / < 2000ms (+20%) / senão achado
  `perf-tempo-elevado`; compressão (+30% ou achado); cache (+30% ou achado).
- `score = round(totalPontos / totalMaximo * 100)`.
- Classificação: ≥90 EXCELENTE, ≥70 BOA, ≥40 ATENCAO, senão CRITICA.
- `vulnerabilidades` no resultado vêm **ordenadas**; `resumoPrioridades`
  calculado sobre elas.

## Estratégia de testes

Runner **Vitest** no backend (`backend/vitest.config.ts`, script `test`).
Arquivos em `backend/src/**/*.test.ts` (co-localizados). Testes usam código real
(sem mocks — são funções puras). Helper local cria `ScanResultado` mínimos.

Casos-chave:
- catalog: cria do refId; aplica overrides; lança em refId inexistente; ids únicos.
- priorizacao: ordem por cada critério e desempates; imutabilidade; resumo
  (contagens com zeros, soma de tempo, topN, lista vazia).
- scoring: site perfeito (score 100, 0 achados, EXCELENTE); site sem HTTPS
  (achado crítico); severidade dinâmica do certificado; mapeamento de cada
  categoria → achados; achados retornados ordenados; faixas de classificação.

## Plano de corte (TDD / Iron Law)

Para cada unidade: deletar a implementação atual → escrever teste que falha →
ver falhar → implementação mínima → ver passar → refatorar mantendo verde.
Ordem: (1) catalog, (2) priorizacao, (3) scoring (depende das duas).
Tipos são declarações e permanecem. Commits a cada unidade verde.

## Critérios de sucesso

- [ ] `npm test` (backend) verde com a suíte cobrindo as regras acima.
- [ ] `npx tsc --noEmit` (backend) sem erros.
- [ ] Frontend continua compilando (`npm run build`) sem alterações de contrato.
- [ ] Comportamento de `calcularScore` equivalente ao baseline (mesmos scores
      para entradas equivalentes).
```
