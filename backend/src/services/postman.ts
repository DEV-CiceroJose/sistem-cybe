interface HeaderPostman {
  key: string;
  value: string;
}
interface ItemPostman {
  name: string;
  request: { method: string; url: string; header?: HeaderPostman[] };
}
interface ColecaoPostman {
  info: { name: string; schema: string };
  item: ItemPostman[];
}

const SCHEMA = "https://schema.getpostman.com/json/collection/v2.1.0/collection.json";

/** Converte um documento OpenAPI numa coleção Postman v2.1. */
export function gerarColecaoPostman(
  openapi: Record<string, any>,
  baseUrl = "http://localhost:3001/api/v1",
): ColecaoPostman {
  const item: ItemPostman[] = [];
  const paths = (openapi.paths || {}) as Record<string, Record<string, any>>;

  for (const [caminho, operacoes] of Object.entries(paths)) {
    for (const [metodo, op] of Object.entries(operacoes)) {
      const publica = Array.isArray(op?.security) && op.security.length === 0;
      const header: HeaderPostman[] = publica ? [] : [{ key: "Authorization", value: "Bearer {{token}}" }];
      item.push({
        name: `${metodo.toUpperCase()} ${caminho}`,
        request: { method: metodo.toUpperCase(), url: `${baseUrl}${caminho}`, header },
      });
    }
  }

  return {
    info: { name: (openapi.info?.title as string) || "API", schema: SCHEMA },
    item,
  };
}
