import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { listarAlertas, marcarAlertaLido, marcarAlertasLidos } from "../controllers/alerta.controller";

export const alertaRouter = Router();

alertaRouter.get("/", asyncHandler(listarAlertas));
alertaRouter.post("/marcar-lidos", asyncHandler(marcarAlertasLidos));
alertaRouter.patch("/:id", asyncHandler(marcarAlertaLido));
