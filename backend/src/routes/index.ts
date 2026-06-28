import { Router } from "express";
import { auditoriaRouter } from "./auditoria.routes";
import { configuracaoRouter } from "./configuracao.routes";
import { agendamentoRouter } from "./agendamento.routes";
import { alertaRouter } from "./alerta.routes";

export const router = Router();

router.use("/auditorias", auditoriaRouter);
router.use("/configuracoes", configuracaoRouter);
router.use("/agendamentos", agendamentoRouter);
router.use("/alertas", alertaRouter);

router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});
