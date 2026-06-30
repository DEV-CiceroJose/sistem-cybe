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
