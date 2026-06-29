# Sprint 7A — Núcleo de Plugins (Design / Spec)

**Data:** 2026-06-28
**Autor:** Cícero José (DEV-CiceroJose) + Claude
**Status:** Aguardando revisão do usuário

## Contexto

Primeira metade da Sprint 7 (Arquitetura de Plugins). A 7B trará a API de plugins,
a página "Plugins" (marketplace local) e a documentação/SDK para desenvolvedores.

## Objetivo (7A)

Reestruturar a coleta do scanner como um sistema de plugins: uma interface comum,
um registro central, plugins embutidos auto-registrados (envolvendo os scanners
atuais) e a possibilidade de ativar/desativar plugins — sem alterar o formato de
`ScanResultado` nem o comportamento existente.

## Decisões aprovadas

- Plugins **embutidos auto-registrados** (sem executar código externo de terceiros).
- Ativar/desativar persistido em **`Configuracao`** (`plugin.<id>.ativo`).
- `ScanResultado` mantém o formato atual (todas as 110 verificações continuam válidas).

## Escopo

### No escopo
- `plugins/tipos.ts`: `ContextoScan`, `PluginScanner`.
- `plugins/registro.ts` (TDD): registrar/listar/executar plugins (mescla fatias).
- 8 plugins embutidos (adapters) para: https, headers, cookies, exposicao,
  tecnologias, performance, cors, dns — sem mudar comportamento.
- `plugins/index.ts`: auto-registra os embutidos.
- `services/plugins.service.ts` (TDD): `lerPluginsAtivos(configs, todosIds)`.
- Refator de `scanner/index.ts`: monta `ContextoScan` e delega a coleta ao registro,
  rodando apenas os plugins ativos.

### Fora do escopo (7B / YAGNI)
- API `/plugins`, UI marketplace, SDK/doc para devs (7B).
- Carregamento dinâmico de arquivos externos.
- Plugins "OWASP"/"Compliance" como plugins (continuam serviços derivados;
  na 7B podem ser expostos como plugins read-only de análise).
- Config individual por plugin além de ativo/inativo (entra na 7B se necessário).
- Hooks além da coleta (pré/pós-scan).

## Arquitetura

```
scanner/index.executarScan(rawUrl)
  ├─ SSRF guard + fetch único (buscarComLimite) + robots/sitemap   (parte compartilhada)
  ├─ monta ContextoScan { urlFinal, hostnameFinal, headers, html, tempoRespostaMs,
  │                        setCookieRaw, robotsTxtExiste, sitemapXmlExiste }
  ├─ idsAtivos = lerPluginsAtivos(configs, registro.ids())
  └─ executarPlugins(ctx, idsAtivos) → mescla as fatias → ScanResultado completo

registro: https | headers | cookies | exposicao | tecnologias | performance | cors | dns
cada plugin.coletar(ctx) → Partial<ScanResultado> (sua fatia)
```

## Contratos (interfaces)

```ts
// plugins/tipos.ts
interface ContextoScan {
  urlFinal: string;
  hostname: string;
  headers: Headers;
  html: string;
  tempoRespostaMs: number;
  setCookieRaw: string[];
  robotsTxtExiste: boolean;
  sitemapXmlExiste: boolean;
}

interface PluginScanner {
  id: string;            // "https" | "headers" | ... (estável)
  nome: string;          // rótulo legível
  descricao: string;
  coletar(ctx: ContextoScan): Promise<Partial<ScanResultado>>;
}

// plugins/registro.ts
function registrarPlugin(p: PluginScanner): void;
function listarPlugins(): PluginScanner[];
function idsPlugins(): string[];
function limparRegistro(): void;     // usado em testes
function executarPlugins(ctx: ContextoScan, idsAtivos: Set<string>): Promise<ScanResultado>;
// roda apenas os plugins cujo id ∈ idsAtivos; mescla as fatias sobre um ScanResultado
// base com defaults (RESULTADO_VAZIO). Plugins não executados ficam com o default.

// services/plugins.service.ts
function lerPluginsAtivos(configs: { chave: string; valor: string }[], todosIds: string[]): Set<string>;
// padrão: todos ativos; entra como inativo se houver `plugin.<id>.ativo` == "false".
```

`RESULTADO_VAZIO` (default em `plugins/registro.ts`) fornece valores neutros para
todas as chaves de `ScanResultado` (https desabilitado, headers nulos, listas
vazias, `cors`/`dns` vazios via `DNS_VAZIO`).

## Plugins embutidos (adapters, sem mudança de comportamento)

| id | coletar(ctx) usa | fatia |
|---|---|---|
| `https` | `inspecionarHttps(ctx.hostname)` | `{ https }` |
| `headers` | `extrairHeaders(ctx.headers)` | `{ headers }` |
| `cookies` | `extrairCookies(ctx.setCookieRaw)` | `{ cookies }` |
| `exposicao` | `detectarExposicao(ctx.headers, ctx.html)` + robots/sitemap do ctx | `{ exposicao }` |
| `tecnologias` | `detectarTecnologias(ctx.html, ctx.headers)` | `{ tecnologias }` |
| `performance` | `medirPerformance(ctx.headers, ctx.html, ctx.tempoRespostaMs)` | `{ performance }` |
| `cors` | `extrairCors(ctx.headers)` | `{ cors }` |
| `dns` | `consultarDns(ctx.hostname)` + `analisarEmail(ctx.hostname)` (try/catch → DNS_VAZIO+erro) | `{ dns }` |

## Refator do `scanner/index.ts`

- Mantém `buscarComLimite`, o SSRF guard e o cálculo de `urlFinal`/`hostnameFinal`/`setCookieRaw`.
- Mantém `verificarArquivo` para robots/sitemap (parte do contexto compartilhado;
  o plugin `exposicao` lê esses flags do `ContextoScan`).
- Em vez de chamar cada scanner manualmente, monta o `ContextoScan` e chama
  `executarPlugins(ctx, idsAtivos)`. `idsAtivos` vem de `lerPluginsAtivos` (lendo
  `prisma.configuracao`); como o executarScan hoje não acessa o banco, a leitura
  de configs fica no chamador (auditoria.runner) e é repassada — para não acoplar
  o scanner ao Prisma. **Decisão:** `executarScan(rawUrl, idsAtivos?)` recebe um
  `Set<string>` opcional; default = todos os ids registrados. O `auditoria.runner`
  passa o conjunto ativo (lido das configs).

## Persistência (ativar/desativar)

- Reusa `Configuracao`: chave `plugin.<id>.ativo`, valor `"true"`/`"false"`.
- Sem registro → ativo (padrão). Só desativa com valor exatamente `"false"`.

## Tratamento de erros

- Um plugin que lança é capturado pelo `executarPlugins`: registra o erro no
  console e mantém a fatia default daquele plugin (não derruba o scan inteiro).
  (O plugin `dns` já trata internamente; este é o salvaguarda geral.)
- `executarScan` mantém o comportamento atual de `ScanError` para falhas de
  rede/SSRF/timeout.

## Estratégia de testes (TDD, Vitest backend)

- `plugins/registro`:
  - `registrarPlugin`/`listarPlugins`/`idsPlugins` refletem o registrado.
  - `executarPlugins` roda só os ativos e mescla as fatias; ids inativos ficam no default.
  - plugin que lança → fatia default + não quebra os demais.
- `plugins.service.lerPluginsAtivos`:
  - sem configs → todos ativos; `plugin.x.ativo=false` remove `x`; valores
    diferentes de `"false"` mantêm ativo.
- Adapters + refator do `scanner/index` cobertos pelas 110 verificações existentes
  (comportamento idêntico) + `tsc`. (O `scanner/index` em si não é testado por
  unidade por usar rede.)

## Critérios de sucesso

- [ ] `npm test` (backend) verde, incluindo `registro` e `plugins.service`.
- [ ] `tsc --noEmit` (backend) e `npm run build` (frontend) sem erros.
- [ ] `ScanResultado` inalterado; auditoria real continua produzindo o mesmo formato.
- [ ] Desativar um plugin via `plugin.<id>.ativo=false` faz aquela fatia vir no default.
- [ ] Sem regressão (todas as verificações das Sprints 1–6 verdes).

## Plano de corte / ordem sugerida

1. `plugins/tipos.ts` + `plugins/registro.ts` (TDD: registro + executarPlugins + RESULTADO_VAZIO).
2. `services/plugins.service.ts` (TDD: lerPluginsAtivos).
3. 8 plugins adapters + `plugins/index.ts` (auto-registro).
4. Refator `scanner/index.ts` (ContextoScan + executarPlugins) + `executarScan(rawUrl, idsAtivos?)`.
5. `auditoria.runner` lê configs e passa `idsAtivos` ao `executarScan`.
6. Verificação final.
