# Sprint 3 — Checklist de Conformidade (Design / Spec)

**Data:** 2026-06-27
**Autor:** Cícero José (DEV-CiceroJose) + Claude
**Status:** Aguardando revisão do usuário

## Objetivo

Mostrar o nível de aderência do site às boas práticas de segurança, com um
checklist de conformidade derivado dos dados do scan, mapeado ao **OWASP Top 10**,
com **% de conformidade** (por grupo e geral), explicação e recomendação por item,
exibido na aplicação e incluído no relatório exportável.

## Decisões aprovadas

- **Enquadramento:** OWASP Top 10 curado — apenas controles auto-avaliáveis a
  partir do `ScanResultado`.
- **CORS:** adicionar captura de CORS ao scanner.
- **Itens não verificáveis passivamente** (autenticação etc.): **excluídos** (YAGNI).
- **Arquitetura:** Approach A — serviço puro no backend + seção no relatório +
  seção no visualizador do frontend.

## Escopo

### No escopo
- Captura de CORS no scanner (`Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials`).
- Serviço `avaliarConformidade(resultado)` (função pura, TDD).
- Grupos de checklist mapeados ao OWASP Top 10 (HTTPS/TLS, Cabeçalhos, Cookies, CORS, Exposição).
- Status por item: Conforme / Parcial / Não conforme; explicação + recomendação + referência OWASP.
- % de conformidade por grupo e geral.
- `conformidade` no payload da auditoria (calculado on the fly).
- Seção "Conformidade" no relatório HTML e Markdown (export do checklist).
- Componente/seção de conformidade no frontend (barra %, grupos, itens, filtro por status).

### Fora do escopo (YAGNI)
- OWASP ASVS completo.
- Checklist de autenticação / itens não verificáveis passivamente.
- Persistir a conformidade no banco (é derivada do resultado; calculada sob demanda).
- Página/rota dedicada separada (fica como seção no visualizador).

## Arquitetura

```
scanner/index ──► ScanResultado (agora com `cors`)
                        │
                        ▼
        avaliarConformidade(resultado)  (conformidade.service, puro)
                        │
                        ▼
        ConformidadeResultado { grupos[], conformes, total, percentual }
            │                                   │
            ▼                                   ▼
  buscarAuditoria (payload.conformidade)   DadosRelatorio.conformidade
            │                                   │
            ▼                                   ▼
  Frontend: ChecklistConformidade       html.report / markdown.report (seção)
```

## Contratos (interfaces)

```ts
// scanner.types.ts (novos)
interface CorsInfo {
  accessControlAllowOrigin: string | null;
  accessControlAllowCredentials: boolean;
}
// ScanResultado ganha: cors: CorsInfo

type StatusConformidade = "CONFORME" | "PARCIAL" | "NAO_CONFORME";

interface ItemConformidade {
  id: string;                 // estável, ex.: "https-habilitado"
  titulo: string;
  status: StatusConformidade;
  referenciaOwasp: string;    // ex.: "A05:2021 – Security Misconfiguration"
  explicacao: string;
  recomendacao: string;
  detalhe?: string;
}

interface GrupoConformidade {
  grupo: string;              // "HTTPS/TLS", "Cabeçalhos HTTP", "Cookies", "CORS", "Exposição de Informação"
  itens: ItemConformidade[];
  conformes: number;          // soma ponderada (Conforme=1, Parcial=0.5)
  total: number;              // nº de itens
  percentual: number;         // 0-100
}

interface ConformidadeResultado {
  grupos: GrupoConformidade[];
  conformes: number;          // soma ponderada geral
  total: number;
  percentual: number;         // 0-100 geral
}

// conformidade.service.ts
function avaliarConformidade(resultado: ScanResultado): ConformidadeResultado;

// cors.scanner.ts
function extrairCors(headers: Headers): CorsInfo;
```

## Itens do checklist (curados)

**HTTPS/TLS** — *A02:2021 – Cryptographic Failures*
- `https-habilitado`: HTTPS está habilitado.
- `tls-confiavel`: certificado emitido por cadeia confiável.
- `cert-valido`: certificado dentro da validade (não expirado nem a < 15 dias → Parcial se < 15 dias).

**Cabeçalhos HTTP** — *A05:2021 – Security Misconfiguration*
- `header-csp`, `header-hsts`, `header-xfo`, `header-xcto`, `header-referrer`, `header-permissions`
  (Conforme se presente; Não conforme se ausente).

**Cookies** — *A05:2021 / A07:2021*
- `cookie-secure`, `cookie-httponly`, `cookie-samesite`:
  - Sem cookies → Conforme (nada a proteger).
  - Todos os cookies com o atributo → Conforme; alguns → Parcial; nenhum → Não conforme.

**CORS** — *A05:2021 – Security Misconfiguration*
- `cors-sem-wildcard-credenciais`: NÃO usar `Access-Control-Allow-Origin: *` junto de `Allow-Credentials: true`
  (Não conforme se a combinação insegura ocorrer; Conforme caso contrário).
- `cors-restritivo`: se há ACAO, ele é restrito (não `*`).
  - Sem ACAO → Conforme (não há exposição CORS); `*` → Parcial; origem específica → Conforme.

**Exposição de Informação** — *A05:2021 – Security Misconfiguration*
- `exp-server`: cabeçalho Server não expõe software/versão.
- `exp-xpoweredby`: sem X-Powered-By.
- `exp-comentarios`: comentários HTML ≤ 5.

## Cálculo da % de conformidade

- Peso por status: Conforme = 1, Parcial = 0.5, Não conforme = 0.
- `grupo.percentual = round(somaPesos / grupo.total * 100)`.
- Geral: `percentual = round(somaPesosGeral / totalGeral * 100)`.
- `conformes` (no grupo e geral) = soma de pesos (número, pode ser fracionário).

## Endpoints / Integração

- `GET /api/auditorias/:id` passa a incluir `resultado.conformidade`? Não — para
  não inflar o tipo `ResultadoAuditoria`. A conformidade vai como campo irmão no
  payload da auditoria: `dados.conformidade`. (Calculada na controller a partir do
  resultado desserializado.)
- Relatório: `montarDadosRelatorio` calcula e injeta `conformidade` em
  `DadosRelatorio`; `html.report` e `markdown.report` ganham a seção "Conformidade"
  (barra %, e por grupo: % + itens com status).

## Captura de CORS

- `extrairCors(headers)` lê `access-control-allow-origin` (string|null) e
  `access-control-allow-credentials` (=== "true").
- `scanner/index.ts` chama `extrairCors(resp.headers)` e inclui em `ScanResultado.cors`.
- Persistência: nova coluna `cors String @default("{\"accessControlAllowOrigin\":null,\"accessControlAllowCredentials\":false}")`
  em `Resultado`; controller grava `JSON.stringify(resultado.cors)` e desserializa.

## Frontend

- Tipos espelhados: `CorsInfo`, `StatusConformidade`, `ItemConformidade`,
  `GrupoConformidade`, `ConformidadeResultado`; `Auditoria` ganha `conformidade?`.
- `services/api.ts`: `buscarAuditoria` já traz `conformidade` no payload.
- Componente `ChecklistConformidade.tsx`: barra de conformidade geral (reusa
  `ProgressBar`), cartões/colapsáveis por grupo com % e itens (ícone por status,
  explicação, recomendação), filtro por status (Todos / Não conforme / Parcial /
  Conforme).
- Integrado no `VisualizadorRelatorio` como seção "Conformidade" (após o Plano de Ação).

## Tratamento de erros

- Auditoria sem `resultado` → `conformidade` ausente no payload; a seção não renderiza.
- `cors` ausente em registros antigos → default `{}` desserializa para CORS vazio
  (tratado como sem exposição CORS).

## Estratégia de testes (TDD, Vitest backend)

- `cors.scanner`: lê ACAO e credentials; ausência → null/false; credentials "true" → true.
- `conformidade.service`:
  - site perfeito → 100% e todos CONFORME.
  - sem HTTPS → grupo HTTPS reprova (itens NAO_CONFORME), % geral cai.
  - 1 cookie sem Secure → `cookie-secure` Não conforme; cookie ok → Conforme; sem cookies → Conforme.
  - CORS `*` + credentials → `cors-sem-wildcard-credenciais` NAO_CONFORME.
  - CORS `*` sem credentials → `cors-restritivo` PARCIAL.
  - matemática: grupo com 1 Conforme + 1 Parcial em 2 itens → 75%.
  - estrutura: 5 grupos presentes; total de itens esperado.
- Frontend permanece coberto por `tsc`/build.

## Critérios de sucesso

- [ ] `npm test` (backend) verde, cobrindo cors.scanner e conformidade.service.
- [ ] `npx tsc --noEmit` (backend) e `npm run build` (frontend) sem erros.
- [ ] `GET /auditorias/:id` retorna `conformidade` com grupos e %.
- [ ] Relatório HTML/MD inclui a seção de Conformidade.
- [ ] Visualizador mostra o checklist com barra %, status, explicação e filtro.
- [ ] Sem regressão nas Sprints 1 e 2 (suíte existente continua verde).

## Plano de corte / ordem sugerida

1. `cors.scanner.ts` (TDD) + tipo `CorsInfo` + wiring no scanner + coluna `cors` + controller.
2. `conformidade.service.ts` (TDD).
3. Integração no payload da auditoria (controller) + no relatório (montarDados, html, markdown) com testes.
4. Frontend: tipos + `ChecklistConformidade` + integração no VisualizadorRelatorio.
5. Verificação final (tests, tsc, build).
