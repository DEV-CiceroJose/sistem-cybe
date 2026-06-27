# Sprint 4 — DNS e Segurança de E-mail: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para implementar tarefa-a-tarefa. Steps usam checkbox (`- [ ]`).

**Goal:** Consultar DNS (A/AAAA/MX/TXT/NS/CNAME) e verificar SPF/DKIM/DMARC do domínio, integrando à auditoria, ao checklist de conformidade e ao relatório.

**Architecture:** Dois scanners puros (`dns.scanner`, `email.scanner`) que recebem um `DnsResolver` injetável (padrão = `node:dns/promises`); o resultado entra em `ScanResultado.dns`, é persistido, avaliado num grupo de conformidade "Segurança de E-mail" e exibido no relatório/frontend.

**Tech Stack:** TypeScript (CommonJS), Node `dns/promises`, Express, Prisma, Vitest, React/Vite.

## Global Constraints

- Linguagem do código/conteúdo: português (pt-BR).
- Sem novas dependências (usar `node:dns/promises`).
- Domínio de e-mail = `hostname.replace(/^www\./, "")`.
- Selectors DKIM comuns: `["default","google","selector1","selector2","dkim","mail","k1","s1","s2","smtp"]`.
- Status de conformidade: CONFORME=1, PARCIAL=0.5, NAO_CONFORME=0.
- Testes co-localizados `backend/src/**/*.test.ts`; rodar de `backend/`. Resolver injetado nos testes (sem rede).
- Após cada tarefa: suíte verde + commit.

---

### Task 1: Tipos + DnsResolver + dns.scanner (TDD)

**Files:**
- Modify: `backend/src/types/scanner.types.ts` (tipos DNS/e-mail + `dns` em `ScanResultado`)
- Create: `backend/src/scanner/dns.resolver.ts`
- Create: `backend/src/scanner/dns.scanner.ts`
- Test: `backend/src/scanner/dns.scanner.test.ts`

**Interfaces:**
- Produces:
  - `MxRecord { exchange: string; prioridade: number }`
  - `SpfInfo`, `DmarcInfo`, `DkimInfo`, `EmailSeguranca`, `DnsInfo` (ver código)
  - `ScanResultado.dns: DnsInfo`
  - `interface DnsResolver { resolve4; resolve6; resolveMx; resolveTxt; resolveNs; resolveCname }`
  - `consultarDns(hostname: string, resolver?: DnsResolver): Promise<Omit<DnsInfo, "email">>`

- [ ] **Step 1: Adicionar tipos** em `backend/src/types/scanner.types.ts` (após `CorsInfo`)

```ts
export interface MxRecord {
  exchange: string;
  prioridade: number;
}

export interface SpfInfo {
  presente: boolean;
  registro: string | null;
}

export interface DmarcInfo {
  presente: boolean;
  politica: string | null;
  registro: string | null;
}

export interface DkimInfo {
  selectoresEncontrados: string[];
}

export interface EmailSeguranca {
  spf: SpfInfo;
  dkim: DkimInfo;
  dmarc: DmarcInfo;
}

export interface DnsInfo {
  a: string[];
  aaaa: string[];
  mx: MxRecord[];
  txt: string[];
  ns: string[];
  cname: string[];
  email: EmailSeguranca;
  erro?: string;
}
```

E adicionar `dns: DnsInfo;` ao final da interface `ScanResultado`.

- [ ] **Step 2: Criar `dns.resolver.ts`**

```ts
import { promises as dnsPromises } from "node:dns";

export interface DnsResolver {
  resolve4(host: string): Promise<string[]>;
  resolve6(host: string): Promise<string[]>;
  resolveMx(host: string): Promise<{ exchange: string; priority: number }[]>;
  resolveTxt(host: string): Promise<string[][]>;
  resolveNs(host: string): Promise<string[]>;
  resolveCname(host: string): Promise<string[]>;
}

export const resolverPadrao: DnsResolver = {
  resolve4: (h) => dnsPromises.resolve4(h),
  resolve6: (h) => dnsPromises.resolve6(h),
  resolveMx: (h) => dnsPromises.resolveMx(h),
  resolveTxt: (h) => dnsPromises.resolveTxt(h),
  resolveNs: (h) => dnsPromises.resolveNs(h),
  resolveCname: (h) => dnsPromises.resolveCname(h),
};
```

- [ ] **Step 3: Escrever o teste que falha** (`dns.scanner.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { consultarDns } from "./dns.scanner";
import type { DnsResolver } from "./dns.resolver";

function fakeResolver(over: Partial<DnsResolver> = {}): DnsResolver {
  const vazio = async () => { throw Object.assign(new Error("ENODATA"), { code: "ENODATA" }); };
  return {
    resolve4: over.resolve4 ?? (async () => ["1.2.3.4"]),
    resolve6: over.resolve6 ?? (async () => ["::1"]),
    resolveMx: over.resolveMx ?? (async () => [{ exchange: "mx.exemplo.com", priority: 10 }]),
    resolveTxt: over.resolveTxt ?? (async () => [["v=spf1 -all"]]),
    resolveNs: over.resolveNs ?? (async () => ["ns1.exemplo.com"]),
    resolveCname: over.resolveCname ?? (vazio as DnsResolver["resolveCname"]),
  };
}

describe("consultarDns", () => {
  it("mapeia A/AAAA/MX/TXT/NS", async () => {
    const dns = await consultarDns("exemplo.com", fakeResolver());
    expect(dns.a).toEqual(["1.2.3.4"]);
    expect(dns.aaaa).toEqual(["::1"]);
    expect(dns.mx).toEqual([{ exchange: "mx.exemplo.com", prioridade: 10 }]);
    expect(dns.txt).toContain("v=spf1 -all");
    expect(dns.ns).toEqual(["ns1.exemplo.com"]);
  });

  it("registro que falha vira lista vazia sem quebrar os demais", async () => {
    const dns = await consultarDns("exemplo.com", fakeResolver({
      resolveCname: async () => { throw new Error("ENOTFOUND"); },
    }));
    expect(dns.cname).toEqual([]);
    expect(dns.a).toEqual(["1.2.3.4"]);
  });

  it("junta partes de TXT multi-string", async () => {
    const dns = await consultarDns("exemplo.com", fakeResolver({
      resolveTxt: async () => [["v=spf1 ", "include:_spf.google.com -all"]],
    }));
    expect(dns.txt).toContain("v=spf1 include:_spf.google.com -all");
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/scanner/dns.scanner.test.ts`
Expected: FAIL — `Cannot find module './dns.scanner'`.

- [ ] **Step 5: Implementar `dns.scanner.ts`**

```ts
import type { DnsResolver } from "./dns.resolver";
import { resolverPadrao } from "./dns.resolver";
import type { DnsInfo, MxRecord } from "../types/scanner.types";

async function seguro<T>(fn: () => Promise<T>, vazio: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return vazio;
  }
}

export async function consultarDns(
  hostname: string,
  resolver: DnsResolver = resolverPadrao,
): Promise<Omit<DnsInfo, "email">> {
  const [a, aaaa, mxBruto, txtBruto, ns, cname] = await Promise.all([
    seguro(() => resolver.resolve4(hostname), [] as string[]),
    seguro(() => resolver.resolve6(hostname), [] as string[]),
    seguro(() => resolver.resolveMx(hostname), [] as { exchange: string; priority: number }[]),
    seguro(() => resolver.resolveTxt(hostname), [] as string[][]),
    seguro(() => resolver.resolveNs(hostname), [] as string[]),
    seguro(() => resolver.resolveCname(hostname), [] as string[]),
  ]);

  const mx: MxRecord[] = mxBruto.map((m) => ({ exchange: m.exchange, prioridade: m.priority }));
  const txt = txtBruto.map((partes) => partes.join(""));

  return { a, aaaa, mx, txt, ns, cname };
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd backend && npx vitest run src/scanner/dns.scanner.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 7: Commit**

```bash
git add backend/src/types/scanner.types.ts backend/src/scanner/dns.resolver.ts backend/src/scanner/dns.scanner.ts backend/src/scanner/dns.scanner.test.ts
git commit -m "feat(dns): consulta de registros DNS via TDD"
```

---

### Task 2: email.scanner (TDD)

**Files:**
- Create: `backend/src/scanner/email.scanner.ts`
- Test: `backend/src/scanner/email.scanner.test.ts`

**Interfaces:**
- Consumes: `DnsResolver` (Task 1).
- Produces: `SELECTORS_DKIM_COMUNS: string[]`, `analisarEmail(hostname: string, resolver?: DnsResolver): Promise<EmailSeguranca>`.

- [ ] **Step 1: Escrever o teste que falha** (`email.scanner.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { analisarEmail } from "./email.scanner";
import type { DnsResolver } from "./dns.resolver";

function resolverComTxt(porHost: Record<string, string[][]>): DnsResolver {
  const txt = async (host: string) => {
    if (porHost[host]) return porHost[host];
    throw Object.assign(new Error("ENODATA"), { code: "ENODATA" });
  };
  const vazio = async () => { throw new Error("ENODATA"); };
  return {
    resolve4: vazio as DnsResolver["resolve4"],
    resolve6: vazio as DnsResolver["resolve6"],
    resolveMx: vazio as DnsResolver["resolveMx"],
    resolveTxt: txt,
    resolveNs: vazio as DnsResolver["resolveNs"],
    resolveCname: vazio as DnsResolver["resolveCname"],
  };
}

describe("analisarEmail", () => {
  it("detecta SPF, DMARC com política e DKIM por selector", async () => {
    const r = resolverComTxt({
      "exemplo.com": [["v=spf1 include:_spf.google.com -all"]],
      "_dmarc.exemplo.com": [["v=DMARC1; p=reject; rua=mailto:a@exemplo.com"]],
      "google._domainkey.exemplo.com": [["v=DKIM1; k=rsa; p=ABC"]],
    });
    const e = await analisarEmail("exemplo.com", r);
    expect(e.spf.presente).toBe(true);
    expect(e.spf.registro).toContain("v=spf1");
    expect(e.dmarc.presente).toBe(true);
    expect(e.dmarc.politica).toBe("reject");
    expect(e.dkim.selectoresEncontrados).toContain("google");
  });

  it("ausência total => flags false e listas vazias", async () => {
    const e = await analisarEmail("exemplo.com", resolverComTxt({}));
    expect(e.spf.presente).toBe(false);
    expect(e.dmarc.presente).toBe(false);
    expect(e.dkim.selectoresEncontrados).toEqual([]);
  });

  it("usa o domínio sem www.", async () => {
    const r = resolverComTxt({ "exemplo.com": [["v=spf1 -all"]] });
    const e = await analisarEmail("www.exemplo.com", r);
    expect(e.spf.presente).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/scanner/email.scanner.test.ts`
Expected: FAIL — `Cannot find module './email.scanner'`.

- [ ] **Step 3: Implementar `email.scanner.ts`**

```ts
import type { DnsResolver } from "./dns.resolver";
import { resolverPadrao } from "./dns.resolver";
import type { EmailSeguranca } from "../types/scanner.types";

export const SELECTORS_DKIM_COMUNS = [
  "default", "google", "selector1", "selector2", "dkim", "mail", "k1", "s1", "s2", "smtp",
];

async function txtSeguro(resolver: DnsResolver, host: string): Promise<string[]> {
  try {
    const partes = await resolver.resolveTxt(host);
    return partes.map((p) => p.join(""));
  } catch {
    return [];
  }
}

export async function analisarEmail(
  hostname: string,
  resolver: DnsResolver = resolverPadrao,
): Promise<EmailSeguranca> {
  const dominio = hostname.replace(/^www\./, "");

  const txtDominio = await txtSeguro(resolver, dominio);
  const spfRegistro = txtDominio.find((t) => t.toLowerCase().startsWith("v=spf1")) ?? null;

  const txtDmarc = await txtSeguro(resolver, `_dmarc.${dominio}`);
  const dmarcRegistro = txtDmarc.find((t) => t.toLowerCase().includes("v=dmarc1")) ?? null;
  const politica = dmarcRegistro ? (dmarcRegistro.match(/p=(\w+)/i)?.[1]?.toLowerCase() ?? null) : null;

  const selectoresEncontrados: string[] = [];
  await Promise.all(
    SELECTORS_DKIM_COMUNS.map(async (sel) => {
      const txt = await txtSeguro(resolver, `${sel}._domainkey.${dominio}`);
      if (txt.some((t) => /v=dkim1/i.test(t) || /(^|;)\s*p=/i.test(t))) {
        selectoresEncontrados.push(sel);
      }
    }),
  );

  return {
    spf: { presente: !!spfRegistro, registro: spfRegistro },
    dmarc: { presente: !!dmarcRegistro, politica, registro: dmarcRegistro },
    dkim: { selectoresEncontrados: selectoresEncontrados.sort() },
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx vitest run src/scanner/email.scanner.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/scanner/email.scanner.ts backend/src/scanner/email.scanner.test.ts
git commit -m "feat(email): verificação SPF/DKIM/DMARC via TDD"
```

---

### Task 3: Wiring no scanner + persistência

**Files:**
- Modify: `backend/src/scanner/index.ts`
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/src/controllers/auditoria.controller.ts`
- Modify (fixtures): `backend/src/services/scoring.service.test.ts`, `backend/src/services/conformidade.service.test.ts`, `backend/src/reports/markdown.report.test.ts`, `backend/src/reports/html.report.test.ts`, `backend/src/reports/montarDados.test.ts`
- Modify: `backend/src/reports/montarDados.ts` (incluir `dns` no `resultadoBase`)

**Interfaces:**
- Consumes: `consultarDns`, `analisarEmail`.
- Produces: `ScanResultado.dns` preenchido e persistido; `dns` no payload de auditoria.

- [ ] **Step 1: Definir o DNS vazio reutilizável** — adicionar export em `backend/src/scanner/dns.scanner.ts`

```ts
import type { DnsInfo } from "../types/scanner.types";

export const DNS_VAZIO: DnsInfo = {
  a: [], aaaa: [], mx: [], txt: [], ns: [], cname: [],
  email: { spf: { presente: false, registro: null }, dkim: { selectoresEncontrados: [] }, dmarc: { presente: false, politica: null, registro: null } },
};
```

(Colocar logo após os imports; reusado para defaults e fixtures.)

- [ ] **Step 2: Wire em `backend/src/scanner/index.ts`**

Importar no topo:
```ts
import { consultarDns, DNS_VAZIO } from "./dns.scanner";
import { analisarEmail } from "./email.scanner";
import type { DnsInfo } from "../types/scanner.types";
```
Depois de obter `hostnameFinal`, adicionar:
```ts
let dns: DnsInfo;
try {
  const [base, email] = await Promise.all([consultarDns(hostnameFinal), analisarEmail(hostnameFinal)]);
  dns = { ...base, email };
} catch (e: any) {
  dns = { ...DNS_VAZIO, erro: e?.message || "Falha ao consultar DNS." };
}
```
Incluir `dns,` no objeto `resultado: ScanResultado = { ... }`.

- [ ] **Step 3: Coluna no Prisma** — `backend/prisma/schema.prisma`, no model `Resultado`, após `cors`:

```prisma
  dns             String @default("{\"a\":[],\"aaaa\":[],\"mx\":[],\"txt\":[],\"ns\":[],\"cname\":[],\"email\":{\"spf\":{\"presente\":false,\"registro\":null},\"dkim\":{\"selectoresEncontrados\":[]},\"dmarc\":{\"presente\":false,\"politica\":null,\"registro\":null}}}")
```

- [ ] **Step 4: Controller** — `backend/src/controllers/auditoria.controller.ts`

No `resultado.create({ data: { ... } })`, adicionar: `dns: JSON.stringify(resultado.dns),`.
Em `serializarAuditoria`, no objeto `resultado`, adicionar:
`dns: JSON.parse(auditoria.resultado.dns || JSON.stringify(DNS_VAZIO)),`
e importar `import { DNS_VAZIO } from "../scanner/dns.scanner";`.

- [ ] **Step 5: Atualizar fixtures dos testes** — adicionar `dns: DNS_VAZIO` aos `ScanResultado` de teste.

Em cada um destes arquivos, importar no topo:
`import { DNS_VAZIO } from "../scanner/dns.scanner";` (ajustar caminho: nos testes em `src/reports/` é `"../scanner/dns.scanner"`; em `src/services/` é `"../scanner/dns.scanner"`).
E acrescentar `cors`/`dns` ao objeto base:
- `backend/src/services/scoring.service.test.ts` (`base()`): adicionar linha `dns: DNS_VAZIO,` após `cors:`.
- `backend/src/services/conformidade.service.test.ts` (`base()`): idem.
- `backend/src/reports/markdown.report.test.ts` (`base()`): idem.
- `backend/src/reports/html.report.test.ts` (`dados().resultado`): adicionar `dns: DNS_VAZIO,` após `cors:`.
- `backend/src/reports/montarDados.test.ts` (`resultado`): adicionar `dns: DNS_VAZIO,` após `cors:`.

- [ ] **Step 6: montarDados inclui dns** — `backend/src/reports/montarDados.ts`

Na construção de `resultadoBase`, adicionar `dns: resultado.dns,`. A interface local `ResultadoDesserializado extends ScanResultado` já passa a exigir `dns` (ok).

- [ ] **Step 7: Regenerar Prisma + verificação**

Run: `cd backend && npx prisma generate && npx tsc --noEmit && npm test`
Expected: prisma ok; tsc sem erros; todos os testes passam.

- [ ] **Step 8: Commit**

```bash
git add backend/src backend/prisma/schema.prisma
git commit -m "feat(dns): integra DNS/e-mail ao scan e à persistência"
```

---

### Task 4: Grupo de conformidade "Segurança de E-mail" (TDD)

**Files:**
- Modify: `backend/src/services/conformidade.service.ts`
- Test: `backend/src/services/conformidade.service.test.ts`

**Interfaces:**
- Consumes: `ScanResultado.dns.email`.
- Produces: novo grupo "Segurança de E-mail" em `avaliarConformidade`.

- [ ] **Step 1: Teste falha** — adicionar em `backend/src/services/conformidade.service.test.ts`

Helper para montar e-mail no `base()` já existe via `DNS_VAZIO`. Adicionar testes:

```ts
it("grupo Segurança de E-mail: SPF+DMARC reject+DKIM => CONFORME", () => {
  const r = base();
  r.dns = {
    ...r.dns,
    email: {
      spf: { presente: true, registro: "v=spf1 -all" },
      dkim: { selectoresEncontrados: ["google"] },
      dmarc: { presente: true, politica: "reject", registro: "v=DMARC1; p=reject" },
    },
  };
  const c = avaliarConformidade(r);
  const grupo = c.grupos.find((g) => g.grupo === "Segurança de E-mail")!;
  expect(grupo.itens.every((i) => i.status === "CONFORME")).toBe(true);
});

it("DMARC p=none => email-dmarc-politica PARCIAL; sem DKIM => email-dkim PARCIAL", () => {
  const r = base();
  r.dns = {
    ...r.dns,
    email: {
      spf: { presente: true, registro: "v=spf1 -all" },
      dkim: { selectoresEncontrados: [] },
      dmarc: { presente: true, politica: "none", registro: "v=DMARC1; p=none" },
    },
  };
  const c = avaliarConformidade(r);
  const grupo = c.grupos.find((g) => g.grupo === "Segurança de E-mail")!;
  expect(grupo.itens.find((i) => i.id === "email-dmarc-politica")!.status).toBe("PARCIAL");
  expect(grupo.itens.find((i) => i.id === "email-dkim")!.status).toBe("PARCIAL");
});

it("sem SPF/DMARC => itens NAO_CONFORME", () => {
  const c = avaliarConformidade(base()); // base usa DNS_VAZIO (sem nada)
  const grupo = c.grupos.find((g) => g.grupo === "Segurança de E-mail")!;
  expect(grupo.itens.find((i) => i.id === "email-spf")!.status).toBe("NAO_CONFORME");
  expect(grupo.itens.find((i) => i.id === "email-dmarc")!.status).toBe("NAO_CONFORME");
});
```

Atualizar também o teste "site perfeito => 100%": como `base()` usa `DNS_VAZIO` (e-mail ausente), ele deixaria de ser 100%. Ajustar o `base()` desse arquivo para incluir um e-mail conforme, OU ajustar a expectativa. **Decisão:** no `base()` do `conformidade.service.test.ts`, definir `dns.email` conforme (SPF+DMARC reject+DKIM) para manter o "site perfeito" em 100%. Substituir o `dns: DNS_VAZIO` (adicionado na Task 3) por:

```ts
    dns: {
      ...DNS_VAZIO,
      email: {
        spf: { presente: true, registro: "v=spf1 -all" },
        dkim: { selectoresEncontrados: ["google"] },
        dmarc: { presente: true, politica: "reject", registro: "v=DMARC1; p=reject" },
      },
    },
```

E o teste "sem SPF/DMARC" acima deve então sobrescrever `r.dns.email` para vazio:

```ts
it("sem SPF/DMARC => itens NAO_CONFORME", () => {
  const r = base();
  r.dns = { ...r.dns, email: { spf: { presente: false, registro: null }, dkim: { selectoresEncontrados: [] }, dmarc: { presente: false, politica: null, registro: null } } };
  const c = avaliarConformidade(r);
  const grupo = c.grupos.find((g) => g.grupo === "Segurança de E-mail")!;
  expect(grupo.itens.find((i) => i.id === "email-spf")!.status).toBe("NAO_CONFORME");
  expect(grupo.itens.find((i) => i.id === "email-dmarc")!.status).toBe("NAO_CONFORME");
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/services/conformidade.service.test.ts`
Expected: FAIL — grupo "Segurança de E-mail" inexistente.

- [ ] **Step 3: Implementar** — `backend/src/services/conformidade.service.ts`

Adicionar a função e incluí-la na lista de grupos:

```ts
function avaliarEmail(r: ScanResultado): GrupoConformidade {
  const ref = "A05:2021 – Security Misconfiguration";
  const { spf, dkim, dmarc } = r.dns.email;

  const politicaForte = dmarc.politica === "reject" || dmarc.politica === "quarantine";
  const statusPolitica: StatusConformidade = !dmarc.presente
    ? "NAO_CONFORME"
    : politicaForte
      ? "CONFORME"
      : "PARCIAL";

  const itens: ItemConformidade[] = [
    {
      id: "email-spf",
      titulo: "Registro SPF presente",
      status: spf.presente ? "CONFORME" : "NAO_CONFORME",
      referenciaOwasp: ref,
      explicacao: "Sem SPF, terceiros podem enviar e-mails forjando o seu domínio.",
      recomendacao: "Publique um registro TXT SPF (v=spf1 ...) listando os remetentes autorizados.",
      detalhe: spf.registro || undefined,
    },
    {
      id: "email-dmarc",
      titulo: "Registro DMARC presente",
      status: dmarc.presente ? "CONFORME" : "NAO_CONFORME",
      referenciaOwasp: ref,
      explicacao: "Sem DMARC, não há política de tratamento para e-mails que falham SPF/DKIM.",
      recomendacao: "Publique um registro DMARC em _dmarc.<domínio>.",
      detalhe: dmarc.registro || undefined,
    },
    {
      id: "email-dmarc-politica",
      titulo: "Política DMARC efetiva",
      status: statusPolitica,
      referenciaOwasp: ref,
      explicacao: "Uma política 'none' apenas monitora; não bloqueia spoofing.",
      recomendacao: "Evolua a política DMARC para quarantine e depois reject.",
      detalhe: dmarc.politica ? `p=${dmarc.politica}` : undefined,
    },
    {
      id: "email-dkim",
      titulo: "DKIM detectado",
      status: dkim.selectoresEncontrados.length > 0 ? "CONFORME" : "PARCIAL",
      referenciaOwasp: ref,
      explicacao: "DKIM assina os e-mails, permitindo verificar a integridade e a origem.",
      recomendacao: "Configure DKIM no provedor de e-mail (verificação automática é best-effort por selectors comuns).",
      detalhe: dkim.selectoresEncontrados.length > 0 ? `Selectors: ${dkim.selectoresEncontrados.join(", ")}` : "Nenhum selector comum encontrado.",
    },
  ];
  return montarGrupo("Segurança de E-mail", itens);
}
```

E em `avaliarConformidade`, adicionar `avaliarEmail(resultado)` ao array `grupos` (após `avaliarExposicao`).

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx vitest run src/services/conformidade.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/conformidade.service.ts backend/src/services/conformidade.service.test.ts
git commit -m "feat(conformidade): grupo Segurança de E-mail via TDD"
```

---

### Task 5: Relatório — seção DNS & E-mail (TDD)

**Files:**
- Modify: `backend/src/reports/html.report.ts`
- Modify: `backend/src/reports/markdown.report.ts`
- Test: `backend/src/reports/html.report.test.ts`, `backend/src/reports/markdown.report.test.ts`

**Interfaces:**
- Consumes: `DadosRelatorio.resultado.dns`.

- [ ] **Step 1: Teste falha (html)** — adicionar em `backend/src/reports/html.report.test.ts`

No `dados()`, o `resultado.dns` já foi adicionado na Task 3 (`DNS_VAZIO`). Ajustar para conter algo visível:

```ts
// dentro de resultado, substituir dns: DNS_VAZIO por:
dns: { ...DNS_VAZIO, a: ["1.2.3.4"], mx: [{ exchange: "mx.acme.com", prioridade: 10 }], email: { spf: { presente: true, registro: "v=spf1 -all" }, dkim: { selectoresEncontrados: ["google"] }, dmarc: { presente: true, politica: "reject", registro: "v=DMARC1; p=reject" } } },
```

Teste:

```ts
it("inclui a seção DNS & E-mail com registros e status de e-mail", () => {
  const html = gerarRelatorioHtml(dados());
  expect(html).toContain('id="dns"');
  expect(html).toContain("1.2.3.4");
  expect(html).toContain("mx.acme.com");
  expect(html).toContain("SPF");
});
```

Adicionar `"dns"` à lista de ids do teste de índice clicável.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/reports/html.report.test.ts`
Expected: FAIL — falta `id="dns"`.

- [ ] **Step 3: Implementar seção no HTML** — `backend/src/reports/html.report.ts`

Adicionar item no `<nav>` (após evidências): `<li><a href="#dns">5. DNS &amp; E-mail</a></li>` e renumerar os seguintes (Plano 6, Recomendações 7, Conformidade 8, Assinatura 9). Adicionar a seção após a de evidências:

```ts
  <section id="dns" class="secao">
    <h2>5. DNS &amp; E-mail</h2>
    <table>
      <tr><td>A</td><td>${r.dns.a.map(esc).join(", ") || "—"}</td></tr>
      <tr><td>AAAA</td><td>${r.dns.aaaa.map(esc).join(", ") || "—"}</td></tr>
      <tr><td>MX</td><td>${r.dns.mx.map((m) => esc(`${m.exchange} (${m.prioridade})`)).join(", ") || "—"}</td></tr>
      <tr><td>NS</td><td>${r.dns.ns.map(esc).join(", ") || "—"}</td></tr>
      <tr><td>CNAME</td><td>${r.dns.cname.map(esc).join(", ") || "—"}</td></tr>
      <tr><td>TXT</td><td>${r.dns.txt.map(esc).join("<br/>") || "—"}</td></tr>
    </table>
    <h3>Segurança de E-mail</h3>
    <table>
      <tr><td>SPF</td><td>${r.dns.email.spf.presente ? "Presente" : "Ausente"}</td></tr>
      <tr><td>DMARC</td><td>${r.dns.email.dmarc.presente ? `Presente (p=${esc(r.dns.email.dmarc.politica || "?")})` : "Ausente"}</td></tr>
      <tr><td>DKIM</td><td>${r.dns.email.dkim.selectoresEncontrados.length ? esc(r.dns.email.dkim.selectoresEncontrados.join(", ")) : "Não detectado"}</td></tr>
    </table>
  </section>
```

Renumerar os `<h2>` das seções seguintes (Plano "6.", Recomendações "7.", Conformidade "8.", Assinatura "9.") tanto no `<nav>` quanto nos títulos.

- [ ] **Step 4: Rodar html e ver passar**

Run: `cd backend && npx vitest run src/reports/html.report.test.ts`
Expected: PASS.

- [ ] **Step 5: Markdown — seção DNS** — `backend/src/reports/markdown.report.ts`

Adicionar `const dnsMd = gerarDnsMd(resultado.dns);` junto aos outros e inserir `${dnsMd}` após `${evidencias}`. Função:

```ts
function gerarDnsMd(dns: ScanResultado["dns"]): string {
  const linha = (rotulo: string, valor: string) => `- **${rotulo}:** ${valor || "—"}`;
  const email = dns.email;
  return `## DNS & E-mail

${linha("A", dns.a.join(", "))}
${linha("AAAA", dns.aaaa.join(", "))}
${linha("MX", dns.mx.map((m) => `${m.exchange} (${m.prioridade})`).join(", "))}
${linha("NS", dns.ns.join(", "))}
${linha("CNAME", dns.cname.join(", "))}
${linha("TXT", dns.txt.join(" | "))}

### Segurança de E-mail

- **SPF:** ${email.spf.presente ? "presente" : "ausente"}
- **DMARC:** ${email.dmarc.presente ? `presente (p=${email.dmarc.politica || "?"})` : "ausente"}
- **DKIM:** ${email.dkim.selectoresEncontrados.length ? email.dkim.selectoresEncontrados.join(", ") : "não detectado"}`;
}
```

Teste em `markdown.report.test.ts`:

```ts
it("inclui a seção DNS & E-mail", () => {
  const r = base();
  const md = gerarRelatorioMarkdown("https://exemplo.com", r, calcularScore(r));
  expect(md).toContain("## DNS & E-mail");
  expect(md).toContain("SPF");
});
```

(O `base()` desse arquivo já recebeu `dns: DNS_VAZIO` na Task 3.)

- [ ] **Step 6: Verificação backend**

Run: `cd backend && npx tsc --noEmit && npm test`
Expected: tsc ok; todos os testes passam.

- [ ] **Step 7: Commit**

```bash
git add backend/src/reports
git commit -m "feat(report): seção DNS & E-mail (HTML/MD) via TDD"
```

---

### Task 6: Frontend — registros DNS

**Files:**
- Modify: `frontend/src/types/index.ts`
- Create: `frontend/src/components/RegistrosDns.tsx`
- Modify: `frontend/src/pages/VisualizadorRelatorio.tsx`

**Interfaces:**
- Consumes: `auditoria.resultado.dns`.

- [ ] **Step 1: Tipos no frontend** — `frontend/src/types/index.ts` (após `CorsInfo`)

```ts
export interface MxRecord { exchange: string; prioridade: number }
export interface SpfInfo { presente: boolean; registro: string | null }
export interface DmarcInfo { presente: boolean; politica: string | null; registro: string | null }
export interface DkimInfo { selectoresEncontrados: string[] }
export interface EmailSeguranca { spf: SpfInfo; dkim: DkimInfo; dmarc: DmarcInfo }
export interface DnsInfo {
  a: string[];
  aaaa: string[];
  mx: MxRecord[];
  txt: string[];
  ns: string[];
  cname: string[];
  email: EmailSeguranca;
  erro?: string;
}
```

Em `ResultadoAuditoria`, adicionar `dns: DnsInfo;`.

- [ ] **Step 2: Componente** — `frontend/src/components/RegistrosDns.tsx`

```tsx
import type { DnsInfo } from "../types";
import { Card } from "./Card";

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-16 shrink-0 text-slate-500">{rotulo}</span>
      <span className="break-all text-slate-300">{valor || "—"}</span>
    </div>
  );
}

function StatusEmail({ ok, rotulo, detalhe }: { ok: boolean; rotulo: string; detalhe: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={ok ? "text-ok" : "text-danger"}>{ok ? "✓" : "✕"}</span>
      <span className="text-slate-300">{rotulo}</span>
      <span className="ml-auto text-xs text-slate-500">{detalhe}</span>
    </div>
  );
}

export function RegistrosDns({ dns }: { dns: DnsInfo }) {
  const { email } = dns;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card title="Registros DNS">
        {dns.erro && <p className="mb-2 text-xs text-warn">{dns.erro}</p>}
        <div className="space-y-1.5">
          <Linha rotulo="A" valor={dns.a.join(", ")} />
          <Linha rotulo="AAAA" valor={dns.aaaa.join(", ")} />
          <Linha rotulo="MX" valor={dns.mx.map((m) => `${m.exchange} (${m.prioridade})`).join(", ")} />
          <Linha rotulo="NS" valor={dns.ns.join(", ")} />
          <Linha rotulo="CNAME" valor={dns.cname.join(", ")} />
          <Linha rotulo="TXT" valor={dns.txt.join("  |  ")} />
        </div>
      </Card>
      <Card title="Segurança de E-mail">
        <div className="space-y-2">
          <StatusEmail ok={email.spf.presente} rotulo="SPF" detalhe={email.spf.presente ? "registro publicado" : "ausente"} />
          <StatusEmail ok={email.dmarc.presente} rotulo="DMARC" detalhe={email.dmarc.presente ? `p=${email.dmarc.politica || "?"}` : "ausente"} />
          <StatusEmail ok={email.dkim.selectoresEncontrados.length > 0} rotulo="DKIM" detalhe={email.dkim.selectoresEncontrados.length > 0 ? email.dkim.selectoresEncontrados.join(", ") : "não detectado"} />
        </div>
        <p className="mt-3 text-[11px] text-slate-500">Detecção de DKIM é best-effort (selectors comuns).</p>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Integrar** — `frontend/src/pages/VisualizadorRelatorio.tsx`

Importar: `import { RegistrosDns } from "../components/RegistrosDns";`
Após o `ChecklistConformidade`, adicionar:
```tsx
{r && r.dns && <RegistrosDns dns={r.dns} />}
```

- [ ] **Step 4: Build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: sem erros; build conclui.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(dns): registros DNS e status de e-mail no visualizador"
```

---

### Task 7: Verificação final

- [ ] `cd backend && npm test` → todos verdes.
- [ ] `cd backend && npx tsc --noEmit` → sem erros.
- [ ] `cd frontend && npm run build` → sucesso.
- [ ] Commit final se necessário: `chore(dns): verificação Sprint 4`.

## Self-Review

**1. Spec coverage:**
- Consulta DNS A/AAAA/MX/TXT/NS/CNAME → Task 1. ✓
- SPF/DKIM/DMARC → Task 2. ✓
- Integração na auditoria + persistência → Task 3. ✓
- Validação de configs incorretas + riscos + recomendações → Task 4 (conformidade) + Task 5/6 (exibição). ✓
- Grupo de conformidade "Segurança de E-mail" → Task 4. ✓
- Relatório DNS (HTML/MD) → Task 5. ✓
- Frontend (módulo DNS/E-mail) → Task 6. ✓
- Resolver injetável p/ testes sem rede → Task 1/2. ✓
- YAGNI (DNSSEC/BIMI/MTA-STS/PSL) → sem tarefa. ✓

**2. Placeholder scan:** sem TBD/TODO; todos os steps de código mostram o código.

**3. Type consistency:** `DnsInfo`, `EmailSeguranca`, `MxRecord` (com `prioridade`), `DnsResolver` (com `priority` no retorno bruto do MX, convertido para `prioridade` em `consultarDns`), `DNS_VAZIO`, `consultarDns`/`analisarEmail` consistentes entre tasks. Ids de conformidade (`email-spf`, `email-dmarc`, `email-dmarc-politica`, `email-dkim`) batem entre service e testes. Grupo "Segurança de E-mail" idêntico em service e testes.
