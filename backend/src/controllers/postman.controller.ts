import type { Request, Response } from "express";
import { gerarColecaoPostman } from "../services/postman";
import { openapiDocumento } from "../docs/openapi";

export async function baixarPostman(_req: Request, res: Response) {
  const colecao = gerarColecaoPostman(openapiDocumento as Record<string, unknown>);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="websec-analyzer.postman_collection.json"');
  res.send(JSON.stringify(colecao, null, 2));
}
