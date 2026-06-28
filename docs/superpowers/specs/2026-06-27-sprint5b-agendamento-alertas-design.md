# Sprint 5B — Agendamento & Alertas (Design / Spec)

**Data:** 2026-06-27
**Autor:** Cícero José (DEV-CiceroJose) + Claude
**Status:** Aguardando revisão do usuário

## Objetivo

Automatizar auditorias recorrentes (diária/semanal/mensal) e gerar alertas
quando o estado de segurança de uma URL piora, exibindo tudo num dashboard de
monitoramento. Complementa a Sprint 5A (histórico/comparação).

## Decisões aprovadas

- **Agendador:** `node-cron` (1 dependência).
- **Notificações:** apenas **in-app** nesta sprint (e-mail/SMTP fica para depois).
- **Gatilhos de alerta:** novos achados, queda de score, queda de conformidade.
  (Alerta de SSL vencendo fora de escopo aqui; já visível no checklist.)

## Escopo

### No escopo
- Tabelas `Agendamento` e `Alerta` (Prisma) + migração.
- `alertas.service.ts` (`gerarAlertas`, puro, reusa `ComparacaoResultado` da 5A).
- `agendamento.service.ts` (`calcularProximaExecucao`, `filtrarVencidos`, puros).
- `auditoria.runner.ts` (`executarAuditoriaCompleta`) extraído do controller; gera/persiste alertas após cada auditoria (manual ou agendada).
- `scheduler.ts` (node-cron, de hora em hora) iniciado no `index.ts`.
- API de agendamentos (CRUD) e de alertas (listar/marcar lido).
- Frontend: dashboard de monitoramento (alertas + agendamentos + evolução do score) e badge de não lidos na Sidebar.

### Fora do escopo (YAGNI)
- E-mail/SMTP (nodemailer).
- Alerta de certificado SSL vencendo (fácil de somar depois).
- Retenção/limpeza automática de alertas; fuso horário configurável.
- Concorrência avançada (lock distribuído) — processo único assumido.

## Arquitetura

```
node-cron (scheduler.ts, hora em hora)
   └─ filtrarVencidos(agendamentos, agora)
        └─ para cada vencido: executarAuditoriaCompleta(url)
             ├─ executarScan + calcularScore + persiste Auditoria/Resultado/Relatorio  (auditoria.runner)
             ├─ compara com a anterior (comparacao.service da 5A)
             ├─ gerarAlertas(comparacao) → persiste Alerta[]
             └─ atualiza ultimaExecucao / proximaExecucao

POST /auditorias (manual) também chama executarAuditoriaCompleta (gera alertas).

API:
  /agendamentos  (CRUD)        /alertas (listar, marcar lido)
Frontend:
  Monitoramento = Alertas + Agendamentos + Evolução do score
  Sidebar: badge de alertas não lidos
```

## Modelo de dados (Prisma)

```prisma
enum Frequencia { DIARIA SEMANAL MENSAL }
enum TipoAlerta { NOVO_ACHADO QUEDA_SCORE QUEDA_CONFORMIDADE }

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

## Contratos (interfaces)

```ts
// agendamento.service.ts
type Frequencia = "DIARIA" | "SEMANAL" | "MENSAL";
function calcularProximaExecucao(freq: Frequencia, base: Date): Date;
// DIARIA +1 dia, SEMANAL +7 dias, MENSAL +1 mês (setMonth+1).
function filtrarVencidos<T extends { ativo: boolean; proximaExecucao: Date }>(
  lista: T[], agora: Date,
): T[];  // ativo && proximaExecucao <= agora

// alertas.service.ts
type TipoAlerta = "NOVO_ACHADO" | "QUEDA_SCORE" | "QUEDA_CONFORMIDADE";
interface AlertaGerado { tipo: TipoAlerta; mensagem: string }
interface OpcoesAlerta { limiarScore?: number }  // default 5
function gerarAlertas(comparacao: ComparacaoResultado, opts?: OpcoesAlerta): AlertaGerado[];

// auditoria.runner.ts
function executarAuditoriaCompleta(url: string): Promise<{ id: string }>;
// scan + score + persistência + geração/persistência de alertas (compara com anterior).
```

## Lógica de geração de alertas (`gerarAlertas`)

A partir do `ComparacaoResultado` (5A):
- `comparacao.novos.length > 0` → `NOVO_ACHADO` — "N novo(s) achado(s) de segurança detectado(s)."
- `comparacao.scoreDelta <= -limiarScore` (default 5) → `QUEDA_SCORE` — "Score caiu de X para Y (−Z)."
- `comparacao.conformidadeDelta < 0` → `QUEDA_CONFORMIDADE` — "Conformidade caiu de X% para Y%."
Sem auditoria anterior → nenhum alerta (primeira auditoria não alerta).

## Execução automática (`auditoria.runner` + `scheduler`)

- `executarAuditoriaCompleta(url)`: replica o fluxo atual de `criarAuditoria`
  (cria Auditoria EM_ANDAMENTO → `executarScan` → `calcularScore` → grava
  Resultado/Relatorio/Auditoria CONCLUIDA). Em caso de `ScanError`, marca ERRO.
  Após CONCLUIDA: busca a auditoria anterior concluída da mesma URL, monta os
  `AuditoriaComparavel`, chama `compararAuditorias` + `gerarAlertas`, e grava as
  linhas `Alerta` (com `auditoriaId`).
- `criarAuditoria` (controller) passa a usar `executarAuditoriaCompleta` e
  retorna a auditoria serializada (sem duplicar lógica).
- `scheduler.ts`: `cron.schedule("0 * * * *", tick)` onde `tick` busca
  `Agendamento` ativos, aplica `filtrarVencidos`, e para cada um executa a
  auditoria e atualiza `ultimaExecucao = agora`,
  `proximaExecucao = calcularProximaExecucao(freq, agora)`. Erros por
  agendamento são logados e não derrubam o tick. Iniciado em `index.ts`
  (somente quando `NODE_ENV !== "test"`).

## API

**Agendamentos** (`/api/agendamentos`):
- `POST` `{ url, frequencia }` → cria (normaliza URL como em `criarAuditoria`;
  `proximaExecucao = calcularProximaExecucao(freq, agora)`).
- `GET` → lista (ordenada por `criadoEm` desc).
- `PATCH /:id` `{ ativo?, frequencia? }` → atualiza (recalcula `proximaExecucao`
  se `frequencia` mudar).
- `DELETE /:id` → remove.

**Alertas** (`/api/alertas`):
- `GET` `?lido=false&limite=` → lista.
- `PATCH /:id` `{ lido }` → marca como lido/não lido.
- `POST /marcar-lidos` → marca todos como lidos.

Respostas seguem o padrão `{ sucesso, dados }`. Validação com `zod`.

## Frontend

- `services/api.ts`: `listarAgendamentos`, `criarAgendamento`, `atualizarAgendamento`,
  `excluirAgendamento`, `listarAlertas`, `marcarAlertaLido`, `marcarAlertasLidos`.
- `pages/Monitoramento.tsx` (dashboard): seção **Alertas** (não lidos primeiro,
  botão marcar lido), seção **Agendamentos** (form URL + frequência; lista com
  ativar/desativar e excluir; mostra próxima execução), e a **evolução do score**
  por URL (já existe).
- `components/AlertasPanel.tsx` e `components/AgendamentosManager.tsx`.
- `components/Sidebar.tsx`: badge com a contagem de alertas não lidos
  (busca `GET /alertas?lido=false`).
- Tipos espelhados: `Frequencia`, `Agendamento`, `TipoAlerta`, `Alerta`.

## Tratamento de erros

- Falha de scan numa execução agendada → auditoria fica ERRO; o tick continua
  para os demais agendamentos; nenhum alerta é gerado para essa execução.
- Sem auditoria anterior → sem alertas.
- `node-cron` não roda em ambiente de teste (guard por `NODE_ENV`).
- URL inválida no agendamento → 400 (mesma normalização/validação do scan).

## Estratégia de testes (TDD, Vitest backend)

- `alertas.service.gerarAlertas`:
  - novos achados → 1 alerta NOVO_ACHADO; nenhum novo → sem esse alerta.
  - `scoreDelta = -10` (limiar 5) → QUEDA_SCORE; `-3` → não dispara.
  - `conformidadeDelta < 0` → QUEDA_CONFORMIDADE; `>= 0` → não.
  - combinação → múltiplos alertas; tudo estável → lista vazia.
- `agendamento.service`:
  - `calcularProximaExecucao` para DIARIA/SEMANAL/MENSAL a partir de uma data fixa.
  - `filtrarVencidos` retorna só ativos com `proximaExecucao <= agora`.
- Runner/scheduler: não testados unitariamente (rede/efeitos); cobertos pelas
  peças puras + `tsc`/build. Frontend por `tsc`/build.

## Critérios de sucesso

- [ ] `npm test` (backend) verde, cobrindo `alertas.service` e `agendamento.service`.
- [ ] `tsc --noEmit` (backend) e `npm run build` (frontend) sem erros.
- [ ] Migração cria `Agendamento` e `Alerta`.
- [ ] `POST /agendamentos` agenda; o scheduler executa quando vencido.
- [ ] Auditoria (manual/agendada) gera alertas comparando com a anterior.
- [ ] Dashboard mostra alertas + agendamentos + evolução; Sidebar mostra não lidos.
- [ ] Sem regressão nas Sprints 1–5A.

## Plano de corte / ordem sugerida

1. `agendamento.service.ts` (TDD: próxima execução + vencidos).
2. `alertas.service.ts` (TDD: gerarAlertas).
3. Prisma (`Agendamento`, `Alerta`) + `auditoria.runner.ts` (extrai do controller; gera/persiste alertas) + refatorar `criarAuditoria`.
4. `scheduler.ts` (node-cron) + start no `index.ts` + dependência `node-cron`.
5. API de agendamentos + alertas (controllers + rotas).
6. Frontend: tipos + serviços + `AlertasPanel` + `AgendamentosManager` + Monitoramento + badge na Sidebar.
7. Verificação final.
