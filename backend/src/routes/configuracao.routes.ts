import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { listarConfiguracoes, atualizarConfiguracao } from "../controllers/configuracao.controller";

export const configuracaoRouter = Router();

configuracaoRouter.get("/", asyncHandler(listarConfiguracoes));
configuracaoRouter.put("/", asyncHandler(atualizarConfiguracao));
