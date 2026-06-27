import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import {
  criarAuditoria,
  listarHistorico,
  buscarAuditoria,
  buscarRelatorioMarkdown,
  buscarRelatorioHtml,
  compararComAnterior,
  excluirAuditoria,
} from "../controllers/auditoria.controller";

export const auditoriaRouter = Router();

auditoriaRouter.post("/", asyncHandler(criarAuditoria));
auditoriaRouter.get("/", asyncHandler(listarHistorico));
auditoriaRouter.get("/:id", asyncHandler(buscarAuditoria));
auditoriaRouter.get("/:id/comparacao", asyncHandler(compararComAnterior));
auditoriaRouter.get("/:id/relatorio.html", asyncHandler(buscarRelatorioHtml));
auditoriaRouter.get("/:id/relatorio", asyncHandler(buscarRelatorioMarkdown));
auditoriaRouter.delete("/:id", asyncHandler(excluirAuditoria));
