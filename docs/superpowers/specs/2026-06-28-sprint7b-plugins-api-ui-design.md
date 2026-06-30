# Sprint 7B — API de Plugins, Marketplace Local e SDK (Design / Spec)

**Data:** 2026-06-28
**Autor:** Cícero José (DEV-CiceroJose) + Claude
**Status:** Aguardando revisão do usuário

## Contexto

Segunda metade da Sprint 7. A 7A entregou o núcleo (registro + plugins embutidos +
ativar/desativar via `Configuracao`). A 7B expõe isso via API e UI e documenta o SDK.

## Objetivo

Gerenciar os plugins de coleta pela API e por uma página "Plugins" (marketplace
local) com liga/desliga, e documentar como criar um plugin (SDK).

## Decisões aprovadas

- Página `/plugins` dedicada + item na Sidebar.
- Lista mostra apenas os **8 coletores** (OWASP/Compliance permanecem derivados).
- Persistência reaproveita `Configuracao` (`plugin.<id>.ativo`).

## Escopo

### No escopo
- `plugins.service.ts`: `listarPluginsComStatus(plugins, configs)` — TDD.
- `plugin.controller.ts`: `GET /plugins`, `PATCH /plugins/:id`.
- `plugin.routes.ts` + registro protegido + entrada no OpenAPI.
- Frontend: tipo `PluginInfo`, serviços, página `Plugins`, rota e item na Sidebar.
- `docs/plugins.md`: SDK/guia para escrever um plugin.

### Fora do escopo (YAGNI)
- Config individual por plugin além de ativo/inativo.
- Instalar/baixar plugins externos; reordenar; versionar plugins.
- OWASP/Compliance como plugins.

## Arquitetura

```
GET /api/v1/plugins
  registrarPluginsEmbutidos() → listarPlugins() (registro)
  + prisma.configuracao.findMany()
  → listarPluginsComStatus(plugins, configs) → PluginInfo[]

PATCH /api/v1/plugins/:id { ativo }
  valida id ∈ idsPlugins() → upsert Configuracao plugin.<id>.ativo = "true"/"false"

Frontend: /plugins (cards + toggle) ; Sidebar "Plugins"
docs/plugins.md: SDK
```

## Contratos (interfaces)

```ts
// plugins.service.ts (novo, além do lerPluginsAtivos existente)
interface PluginInfo {
  id: string;
  nome: string;
  descricao: string;
  ativo: boolean;
}
function listarPluginsComStatus(
  plugins: { id: string; nome: string; descricao: string }[],
  configs: { chave: string; valor: string }[],
): PluginInfo[];
// ativo = true por padrão; false se houver `plugin.<id>.ativo` == "false".
```

Respostas:
```
GET  /api/v1/plugins        → { sucesso: true, dados: PluginInfo[] }
PATCH /api/v1/plugins/:id   { ativo: boolean } → { sucesso: true, dados: { id, ativo } }
  404 se id não for um plugin registrado.
```

## Endpoints (controller)

- `listarPluginsApi`: `registrarPluginsEmbutidos()`; `configs = findMany()`;
  `dados = listarPluginsComStatus(listarPlugins(), configs)`.
- `atualizarPluginApi`: valida `idsPlugins().includes(req.params.id)` senão 404;
  `prisma.configuracao.upsert({ where: { chave }, update: { valor }, create: { chave, valor } })`
  com `chave = plugin.<id>.ativo`, `valor = String(ativo)`. Retorna `{ id, ativo }`.
- Validação `zod`: body `{ ativo: boolean }`.

## OpenAPI

Adicionar paths `/plugins` (get) e `/plugins/{id}` (patch) ao `docs/openapi.ts`
(seguros, com bearer). Regerar o snapshot Postman (`npm run postman:gen`).

## Frontend

- `types/index.ts`: `PluginInfo { id; nome; descricao; ativo }`.
- `services/api.ts`: `listarPlugins(): Promise<PluginInfo[]>`,
  `atualizarPlugin(id, ativo): Promise<void>`.
- `pages/Plugins.tsx` (rota `/plugins`): Navbar + grid de cards (nome, descrição,
  badge ativo/inativo) e um botão/switch para alternar; recarrega após alternar.
- `components/Sidebar.tsx`: novo item "Plugins" (ícone, mesmo padrão).
- `App.tsx`: rota `/plugins` dentro da área protegida.

## SDK / documentação

`docs/plugins.md`:
- O que é um plugin (`PluginScanner`), o `ContextoScan` (tabela de campos).
- Passos: criar `meu.plugin.ts` exportando um `PluginScanner`; registrar em
  `plugins/index.ts`; a fatia retornada é mesclada no `ScanResultado`.
- Exemplo mínimo de plugin.
- Como desativar via `Configuracao`/página Plugins.
- Aviso: plugins são código embutido confiável (não há carregamento externo).

## Tratamento de erros

- PATCH com id desconhecido → 404 `{ sucesso:false, erro }`.
- Body inválido (`ativo` ausente/não-booleano) → 400.
- Página Plugins: falha de fetch → alerta; toggle com erro mantém estado anterior.

## Estratégia de testes (TDD, Vitest backend)

- `plugins.service.listarPluginsComStatus`:
  - mapeia `id/nome/descricao`; `ativo` true por padrão;
  - `plugin.<id>.ativo=false` → aquele item `ativo:false`; outros true;
  - ignora chaves estranhas.
- Controller/rotas/OpenAPI/UI: cobertos por `tsc`/build + a peça pura.

## Critérios de sucesso

- [ ] `npm test` (backend) verde, cobrindo `listarPluginsComStatus`.
- [ ] `tsc --noEmit` (backend) e `npm run build` (frontend) sem erros.
- [ ] `GET /plugins` lista os 8 com `ativo`; `PATCH /plugins/:id` persiste e reflete no próximo scan.
- [ ] Página `/plugins` mostra os cards e alterna o estado; item na Sidebar.
- [ ] `docs/plugins.md` documenta como criar um plugin.
- [ ] Snapshot Postman regenerado com as rotas de plugins.
- [ ] Sem regressão (118 testes anteriores verdes).

## Plano de corte / ordem sugerida

1. `listarPluginsComStatus` (TDD).
2. `plugin.controller.ts` + `plugin.routes.ts` + registro + OpenAPI + Postman snapshot.
3. Frontend: tipos + serviços + `Plugins.tsx` + rota + Sidebar.
4. `docs/plugins.md` (SDK).
5. Verificação final.
