import { Router } from "express";
import { auditoriaRouter } from "./auditoria.routes";
import { configuracaoRouter } from "./configuracao.routes";

export const router = Router();

router.use("/auditorias", auditoriaRouter);
router.use("/configuracoes", configuracaoRouter);

router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});
