# Sprint 4 — DNS e Segurança de E-mail (Design / Spec)

**Data:** 2026-06-27
**Autor:** Cícero José (DEV-CiceroJose) + Claude
**Status:** Aguardando revisão do usuário

## Objetivo

Avaliar a infraestrutura de domínio e e-mail do site: consultar registros DNS
(A, AAAA, MX, TXT, NS, CNAME) e verificar SPF, DKIM e DMARC, com explicação de
riscos e recomendações, integrado à auditoria existente e ao relatório.

## Decisões aprovadas

- **DKIM:** sondar selectors comuns (best-effort) e reportar os encontrados.
- **Integração:** parte da auditoria existente (adiciona `dns` ao `ScanResultado`).
- **Conformidade:** SPF/DKIM/DMARC entram no checklist como grupo "Segurança de E-mail".
- **Sem novas dependências:** usar `dns/promises` do Node.

## Escopo

### No escopo
- `dns.scanner.ts`: resolve A, AAAA, MX, TXT, NS, CNAME (cada um tolerante a falha).
- `email.scanner.ts`: SPF (TXT `v=spf1`), DMARC (`_dmarc.<dom>` `v=DMARC1`, política `p=`), DKIM (sonda selectors comuns).
- `ScanResultado.dns: DnsInfo` (inclui `email: EmailSeguranca`); persistência (coluna `dns`).
- Grupo de conformidade "Segurança de E-mail".
- Seção DNS & E-mail no relatório HTML/MD.
- Componente `RegistrosDns` no visualizador.
- Injeção de resolver para testes sem rede; timeout por consulta; degradação graciosa.

### Fora do escopo (YAGNI)
- DNSSEC, BIMI, MTA-STS, TLS-RPT.
- Resolução de Public Suffix List / eTLD+1 (usa hostname sem `www.`).
- Sondagem de selectors DKIM arbitrários além da lista comum.
- Página/endpoint de DNS separados (fica na auditoria).

## Arquitetura

```
scanner/index (hostnameFinal)
   ├─ consultarDns(hostname, resolver) ─► DnsInfo (A/AAAA/MX/TXT/NS/CNAME)
   └─ analisarEmail(hostname, resolver) ─► EmailSeguranca (SPF/DKIM/DMARC)
                         │
                         ▼
        ScanResultado.dns = { ...DnsInfo, email: EmailSeguranca }
                         │
        ┌────────────────┼─────────────────────────┐
        ▼                ▼                          ▼
 persistência      conformidade.service       montarDados → html/markdown
 (coluna dns)      (grupo "Segurança          (seção DNS & E-mail)
                    de E-mail")
                         ▼
                 Frontend: RegistrosDns + grupo no ChecklistConformidade
```

### Unidades

| Arquivo (backend) | Responsabilidade |
|---|---|
| `scanner/dns.scanner.ts` | `consultarDns(hostname, resolver?)` → registros DNS. |
| `scanner/email.scanner.ts` | `analisarEmail(hostname, resolver?)` → SPF/DKIM/DMARC. |
| `scanner/dns.resolver.ts` | Interface `DnsResolver` + resolver padrão (`dns/promises`). |
| `services/conformidade.service.ts` | (existente) novo grupo "Segurança de E-mail". |
| `reports/html.report.ts` / `markdown.report.ts` | (existentes) seção DNS & E-mail. |

| Arquivo (frontend) | Responsabilidade |
|---|---|
| `components/RegistrosDns.tsx` | Tabela de registros + status de e-mail. |
| `pages/VisualizadorRelatorio.tsx` | Inclui `RegistrosDns`. |

## Contratos (interfaces)

```ts
// scanner.types.ts (novos)
interface MxRecord { exchange: string; prioridade: number }

interface SpfInfo { presente: boolean; registro: string | null }
interface DmarcInfo { presente: boolean; politica: string | null; registro: string | null }
interface DkimInfo { selectoresEncontrados: string[] }   // [] se nenhum selector comum bateu
interface EmailSeguranca { spf: SpfInfo; dkim: DkimInfo; dmarc: DmarcInfo }

interface DnsInfo {
  a: string[];
  aaaa: string[];
  mx: MxRecord[];
  txt: string[];
  ns: string[];
  cname: string[];
  email: EmailSeguranca;
  erro?: string;          // preenchido se a consulta DNS falhar por completo
}
// ScanResultado ganha: dns: DnsInfo

// dns.resolver.ts
interface DnsResolver {
  resolve4(host: string): Promise<string[]>;
  resolve6(host: string): Promise<string[]>;
  resolveMx(host: string): Promise<{ exchange: string; priority: number }[]>;
  resolveTxt(host: string): Promise<string[][]>;
  resolveNs(host: string): Promise<string[]>;
  resolveCname(host: string): Promise<string[]>;
}
const resolverPadrao: DnsResolver; // baseado em node:dns/promises

// dns.scanner.ts
function consultarDns(hostname: string, resolver?: DnsResolver): Promise<Omit<DnsInfo, "email">>;

// email.scanner.ts
const SELECTORS_DKIM_COMUNS: string[]; // ["default","google","selector1","selector2","dkim","mail","k1","s1","s2","smtp"]
function analisarEmail(hostname: string, resolver?: DnsResolver): Promise<EmailSeguranca>;
```

## Lógica de detecção

- **Domínio de e-mail:** `hostname.replace(/^www\./, "")`.
- **SPF:** entre os TXT do domínio, achar o que começa com `v=spf1` (case-insensitive). `presente = !!registro`.
- **DMARC:** `resolveTxt("_dmarc." + dominio)`, juntar partes, achar `v=DMARC1`; extrair `p=` (regex `p=(\w+)`). `presente`, `politica` (ex.: "reject"/"quarantine"/"none"), `registro`.
- **DKIM:** para cada selector em `SELECTORS_DKIM_COMUNS`, `resolveTxt(sel + "._domainkey." + dominio)`; se a resposta contém `v=DKIM1` ou `p=` (chave), adicionar selector a `selectoresEncontrados`. Erros por selector são ignorados.
- **Cada consulta** é tolerante: erros (`ENOTFOUND`, `ENODATA`, timeout) → resultado vazio para aquele registro. Se TODAS as consultas DNS base falharem, `DnsInfo.erro` é preenchido.

## Conformidade — grupo "Segurança de E-mail"

Referência: *A05:2021 – Security Misconfiguration* (proteção de e-mail/spoofing).

- `email-spf`: SPF presente → CONFORME; ausente → NAO_CONFORME.
- `email-dmarc`: DMARC presente → CONFORME; ausente → NAO_CONFORME.
- `email-dmarc-politica`: `p=reject`/`p=quarantine` → CONFORME; `p=none` → PARCIAL; sem DMARC → NAO_CONFORME.
- `email-dkim`: ≥1 selector encontrado → CONFORME; nenhum → PARCIAL (best-effort, pode haver selector não listado).

O grupo entra no cálculo da % geral (pesos já existentes: 1 / 0.5 / 0).

## Integração no scanner

`scanner/index.ts`: após obter `hostnameFinal`, incluir nas chamadas paralelas:
```ts
const [dnsBase, email] = await Promise.all([
  consultarDns(hostnameFinal),
  analisarEmail(hostnameFinal),
]);
const dns = { ...dnsBase, email };
```
(envolto em try/catch que produz `DnsInfo` vazio com `erro` se algo escapar).
`resultado.dns = dns`.

## Persistência

- Nova coluna `dns String @default("{...vazio...}")` em `Resultado`.
- Controller: gravar `JSON.stringify(resultado.dns)`; desserializar com fallback ao default.

## Relatório

- `html.report.ts`: nova seção "DNS & E-mail" (após Evidências): tabelas de A/AAAA/MX/TXT/NS/CNAME e bloco de e-mail (SPF/DKIM/DMARC com status). Adicionar ao índice e renumerar.
- `markdown.report.ts`: seção equivalente após Evidências.

## Frontend

- Tipos espelhados (`DnsInfo`, `EmailSeguranca`, etc.); `ResultadoAuditoria.dns`.
- `RegistrosDns.tsx`: cartões com registros DNS e o status de e-mail (ícones por estado + recomendação quando ausente).
- Integrado no `VisualizadorRelatorio` (após o checklist de conformidade).

## Tratamento de erros

- Domínio inexistente / sem registros → listas vazias; a seção exibe "nenhum registro".
- Falha total de DNS → `DnsInfo.erro` exibido como aviso; não quebra a auditoria.
- Timeout por consulta (ex.: 4s) para não travar o scan.

## Estratégia de testes (TDD, Vitest backend)

- `dns.scanner`: com `DnsResolver` fake → mapeia A/AAAA/MX/TXT/NS/CNAME; resolver que lança em um tipo → aquele registro vem vazio sem quebrar os demais.
- `email.scanner`: fake resolver com TXT contendo SPF/DMARC/DKIM → detecta presença, política e selectors; ausência → flags false / listas vazias; usa domínio sem `www.`.
- `conformidade.service`: grupo "Segurança de E-mail" com SPF+DMARC `reject`+DKIM → CONFORME; `p=none` → PARCIAL; sem nada → NAO_CONFORME.
- `html.report`/`markdown.report`: seção DNS presente; âncora no índice (HTML).
- Frontend: coberto por `tsc`/build.

## Critérios de sucesso

- [ ] `npm test` (backend) verde, cobrindo dns/email/conformidade/relatório.
- [ ] `tsc --noEmit` (backend) e `npm run build` (frontend) sem erros.
- [ ] `GET /auditorias/:id` retorna `resultado.dns` com registros e e-mail.
- [ ] Relatório HTML/MD inclui a seção DNS & E-mail.
- [ ] Checklist mostra o grupo "Segurança de E-mail" na % geral.
- [ ] Visualizador mostra os registros DNS e o status de e-mail.
- [ ] Sem regressão nas Sprints 1–3.

## Plano de corte / ordem sugerida

1. `dns.resolver.ts` + tipos + `dns.scanner.ts` (TDD).
2. `email.scanner.ts` (TDD).
3. Wiring no scanner + coluna `dns` + controller (persistência).
4. Grupo de conformidade "Segurança de E-mail" (TDD).
5. Relatório HTML/MD: seção DNS & E-mail (TDD).
6. Frontend: tipos + `RegistrosDns` + integração.
7. Verificação final.
