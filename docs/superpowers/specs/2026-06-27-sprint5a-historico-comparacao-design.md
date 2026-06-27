# Sprint 5A — Histórico & Comparação (Design / Spec)

**Data:** 2026-06-27
**Autor:** Cícero José (DEV-CiceroJose) + Claude
**Status:** Aguardando revisão do usuário

## Contexto

A Sprint 5 (Monitoramento Contínuo) foi decomposta em duas sub-sprints:
- **5A (esta):** Histórico & Comparação — análise read-only sobre os dados existentes.
- **5B (depois):** Agendamento & Alertas — agendador (node-cron), alertas in-app +
  e-mail opcional, dashboard de monitoramento.

## Objetivo (5A)

Permitir acompanhar a evolução de uma URL ao longo do tempo: comparar uma
auditoria com a anterior (score, achados, conformidade) e visualizar a evolução
do score por URL. Sem novas dependências, sem novas tabelas.

## Escopo

### No escopo
- `comparacao.service.ts`: `compararAuditorias(anterior, atual)` (função pura).
- Endpoint `GET /api/auditorias/:id/comparacao` (compara com a anterior da mesma URL).
- Filtro `?url=` em `GET /api/auditorias` (série temporal de uma URL).
- Frontend: seção "Comparação com a auditoria anterior" no visualizador.
- Frontend: página **Monitoramento** (`/monitoramento`) com evolução do score por URL.
- Componente `EvolucaoScore` (line chart SVG) + item na Sidebar.

### Fora do escopo (YAGNI / 5B)
- Agendamento, alertas, notificações por e-mail, dashboard de alertas (5B).
- Diff campo-a-campo de DNS/headers/cookies (foco: achados + score + conformidade).
- Paginação avançada / exportação da comparação.

## Arquitetura

```
GET /auditorias/:id/comparacao
   ├─ busca auditoria :id (com resultado)
   ├─ busca a auditoria anterior da MESMA url (criadoEm < e status CONCLUIDA)
   └─ compararAuditorias(anterior, atual) ─► ComparacaoResultado | null

GET /auditorias?url=...&limite=...
   └─ histórico filtrado por url (série para o gráfico de evolução)

Frontend:
  VisualizadorRelatorio ── buscarComparacao(id) ─► seção de comparação
  Monitoramento page ── listarHistorico(url?) ─► EvolucaoScore (SVG) por URL
```

## Contratos (interfaces)

```ts
// comparacao.types.ts (backend) — ou em scanner.types.ts
interface AuditoriaComparavel {
  id: string;
  score: number;
  conformidadePercentual: number;     // 0-100
  vulnerabilidades: Vulnerabilidade[];
}

interface AchadoDiff {
  refId: string;
  titulo: string;
  severidade: Severidade;
  detalhe?: string;
}

interface ComparacaoResultado {
  baseId: string;                     // auditoria anterior
  atualId: string;
  scoreAnterior: number;
  scoreAtual: number;
  scoreDelta: number;                 // atual - anterior
  conformidadeAnterior: number;
  conformidadeAtual: number;
  conformidadeDelta: number;
  novos: AchadoDiff[];                // refId|detalhe presentes só na atual
  resolvidos: AchadoDiff[];           // presentes só na anterior
  mantidos: AchadoDiff[];             // presentes em ambas
}

// comparacao.service.ts
function compararAuditorias(
  anterior: AuditoriaComparavel,
  atual: AuditoriaComparavel,
): ComparacaoResultado;
```

**Chave de identidade do achado:** `\`${refId}|${detalhe ?? ""}\``.

## Lógica de comparação

- `scoreDelta = atual.score - anterior.score`.
- `conformidadeDelta = atual.conformidadePercentual - anterior.conformidadePercentual`.
- Conjuntos por chave:
  - `novos` = chaves em `atual` e não em `anterior`.
  - `resolvidos` = chaves em `anterior` e não em `atual`.
  - `mantidos` = chaves em ambos.
- Cada `AchadoDiff` carrega `refId`, `titulo`, `severidade`, `detalhe` (do lado onde existe).
- Ordenação dos diffs por severidade (reusa `SEVERIDADE_RANK`).

## Endpoints

- `GET /api/auditorias/:id/comparacao`
  - 404 se a auditoria `:id` não existir ou não tiver resultado.
  - Busca a auditoria anterior: mesma `url`, `status = CONCLUIDA`, `criadoEm < atual.criadoEm`, ordenada desc, primeira.
  - Sem anterior → `{ sucesso: true, dados: null }`.
  - Com anterior → calcula `conformidadePercentual` de cada lado via `avaliarConformidade(resultado)` e retorna `ComparacaoResultado`.
- `GET /api/auditorias?url=<url>&limite=<n>`
  - Adiciona filtro opcional `where: { url }` ao `listarHistorico` existente.

## Frontend

- `services/api.ts`:
  - `buscarComparacao(id): Promise<ComparacaoResultado | null>`.
  - `listarHistorico(limite?, url?)` — adiciona o parâmetro `url`.
- `VisualizadorRelatorio.tsx`: após o checklist, seção **Comparação** (se houver
  anterior): Δ de score e de conformidade (setas ↑/↓ coloridas), listas de
  achados resolvidos (✅) e novos (⚠️). Carregada com um fetch próprio.
- `pages/Monitoramento.tsx` (rota `/monitoramento`): agrupa o histórico por URL;
  para cada URL, score atual + `EvolucaoScore` (sparkline) + nº de auditorias +
  link para a auditoria mais recente.
- `components/EvolucaoScore.tsx`: line chart SVG simples (pontos = score por data),
  responsivo, sem dependências.
- `components/Sidebar.tsx`: novo item "Monitoramento".
- `App.tsx`: nova rota `/monitoramento`.

## Tratamento de erros

- Sem auditoria anterior → seção de comparação não é exibida (dados `null`).
- Auditoria sem resultado → endpoint 404; UI ignora a seção.
- URL com 1 só ponto → `EvolucaoScore` mostra o ponto único sem traçar linha.

## Estratégia de testes (TDD, Vitest backend)

- `comparacao.service`:
  - `scoreDelta` e `conformidadeDelta` corretos (positivo/negativo).
  - achado só na atual → `novos`; só na anterior → `resolvidos`; em ambos → `mantidos`.
  - chave considera `detalhe` (mesmo refId, detalhe diferente → contam separados).
  - sem vulnerabilidades em ambos → listas vazias.
  - diffs ordenados por severidade (crítico primeiro).
- Frontend coberto por `tsc`/build.

## Critérios de sucesso

- [ ] `npm test` (backend) verde, cobrindo `comparacao.service`.
- [ ] `tsc --noEmit` (backend) e `npm run build` (frontend) sem erros.
- [ ] `GET /auditorias/:id/comparacao` retorna o diff ou `null`.
- [ ] `GET /auditorias?url=` filtra por URL.
- [ ] Visualizador mostra a comparação com a anterior (quando existir).
- [ ] Página Monitoramento mostra a evolução do score por URL.
- [ ] Sem regressão nas Sprints 1–4.

## Plano de corte / ordem sugerida

1. `comparacao.service.ts` (TDD).
2. Endpoints (`/comparacao`, filtro `?url=`) + controller.
3. Frontend: tipos + `buscarComparacao`/filtro + seção de comparação no visualizador.
4. Frontend: `EvolucaoScore` + página Monitoramento + rota + Sidebar.
5. Verificação final.
