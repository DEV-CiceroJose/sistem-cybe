export interface PluginInfo {
  id: string;
  nome: string;
  descricao: string;
  ativo: boolean;
}

/** Calcula o conjunto de plugins ativos: todos por padrão; `plugin.<id>.ativo=false` desativa. */
export function lerPluginsAtivos(
  configs: { chave: string; valor: string }[],
  todosIds: string[],
): Set<string> {
  const inativos = new Set<string>();
  for (const { chave, valor } of configs) {
    const m = chave.match(/^plugin\.(.+)\.ativo$/);
    if (m && valor === "false") inativos.add(m[1]);
  }
  return new Set(todosIds.filter((id) => !inativos.has(id)));
}

/** Combina os metadados dos plugins com o estado ativo das configurações. */
export function listarPluginsComStatus(
  plugins: { id: string; nome: string; descricao: string }[],
  configs: { chave: string; valor: string }[],
): PluginInfo[] {
  const ativos = lerPluginsAtivos(configs, plugins.map((p) => p.id));
  return plugins.map((p) => ({ id: p.id, nome: p.nome, descricao: p.descricao, ativo: ativos.has(p.id) }));
}
