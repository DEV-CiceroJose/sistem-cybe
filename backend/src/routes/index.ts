import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { openapiDocumento } from "../docs/openapi";
import { auditoriaRouter } from "./auditoria.routes";
import { configuracaoRouter } from "./configuracao.routes";
import { agendamentoRouter } from "./agendamento.routes";
import { alertaRouter } from "./alerta.routes";
import { authRouter } from "./auth.routes";
import { logRouter } from "./log.routes";
import { postmanRouter } from "./postman.routes";
import { webhookRouter } from "./webhook.routes";
import { autenticar } from "../middlewares/auth.middleware";

export const router = Router();

// Rotas públicas
router.use("/auth", authRouter);
router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});
router.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiDocumento as Record<string, unknown>));
router.use("/postman", postmanRouter);

// Rotas protegidas por JWT
router.use("/auditorias", autenticar, auditoriaRouter);
router.use("/configuracoes", autenticar, configuracaoRouter);
router.use("/agendamentos", autenticar, agendamentoRouter);
router.use("/alertas", autenticar, alertaRouter);
router.use("/logs", autenticar, logRouter);
router.use("/webhooks", autenticar, webhookRouter);
