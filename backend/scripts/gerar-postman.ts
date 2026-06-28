import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { gerarColecaoPostman } from "../src/services/postman";
import { openapiDocumento } from "../src/docs/openapi";

const colecao = gerarColecaoPostman(openapiDocumento as Record<string, unknown>);
const destino = path.join(process.cwd(), "..", "docs", "postman", "colecao.json");
mkdirSync(path.dirname(destino), { recursive: true });
writeFileSync(destino, JSON.stringify(colecao, null, 2), "utf-8");
console.log(`Coleção Postman gerada em ${destino}`);
