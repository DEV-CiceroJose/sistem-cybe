# SDK de Plugins — Web Security Analyzer

A coleta do scanner é feita por **plugins** embutidos. Cada plugin recebe um
`ContextoScan` (montado após o fetch único da página) e devolve sua fatia do
`ScanResultado`. Os plugins são código confiável do próprio projeto — **não há
carregamento de arquivos externos** (decisão de segurança).

## Interface

```ts
interface PluginScanner {
  id: string;        // estável, ex.: "meu-plugin"
  nome: string;
  descricao: string;
  coletar(ctx: ContextoScan): Promise<Partial<ScanResultado>>;
}
```

## ContextoScan

| Campo | Tipo | Descrição |
|---|---|---|
| `urlFinal` | string | URL após redirecionamentos |
| `hostname` | string | host de `urlFinal` |
| `headers` | Headers | cabeçalhos da resposta |
| `html` | string | corpo HTML |
| `tempoRespostaMs` | number | tempo de resposta em ms |
| `setCookieRaw` | string[] | cabeçalhos Set-Cookie crus |
| `robotsTxtExiste` | boolean | robots.txt encontrado |
| `sitemapXmlExiste` | boolean | sitemap.xml encontrado |

## Criando um plugin

1. Crie `backend/src/plugins/meu.plugin.ts`:

```ts
import type { PluginScanner } from "./tipos";

export const meuPlugin: PluginScanner = {
  id: "meu-plugin",
  nome: "Meu Plugin",
  descricao: "Exemplo de coletor.",
  async coletar(ctx) {
    // Retorne apenas a(s) fatia(s) de ScanResultado que este plugin produz.
    // Ex.: ler um cabeçalho e devolver parte de `exposicao`.
    return {};
  },
};
```

2. Registre em `backend/src/plugins/index.ts`, adicionando `meuPlugin` à lista
   dentro de `registrarPluginsEmbutidos`.

3. A fatia retornada é mesclada sobre `RESULTADO_VAZIO` em `executarPlugins`
   (apenas para os plugins ativos). Se o plugin lançar um erro, o scan continua
   e aquela fatia permanece com o valor default.

## Ativar / Desativar

- Pela página **Plugins** (marketplace local) ou via API:
  - `GET /api/v1/plugins` → lista com o estado `ativo`.
  - `PATCH /api/v1/plugins/:id` `{ "ativo": false }` → desativa.
- O estado é persistido em `Configuracao` (`plugin.<id>.ativo`). Plugins inativos
  não rodam; sua fatia fica com o valor default de `ScanResultado`.

## Plugins embutidos

`https`, `headers`, `cookies`, `exposicao`, `tecnologias`, `performance`,
`cors`, `dns` — cada um envolve um scanner do diretório `backend/src/scanner/`.
