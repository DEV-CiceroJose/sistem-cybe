import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import {
  criarWebhook,
  listarWebhooks,
  atualizarWebhook,
  excluirWebhook,
  listarEntregas,
} from "../controllers/webhook.controller";

export const webhookRouter = Router();
webhookRouter.post("/", asyncHandler(criarWebhook));
webhookRouter.get("/", asyncHandler(listarWebhooks));
webhookRouter.patch("/:id", asyncHandler(atualizarWebhook));
webhookRouter.delete("/:id", asyncHandler(excluirWebhook));
webhookRouter.get("/:id/entregas", asyncHandler(listarEntregas));
