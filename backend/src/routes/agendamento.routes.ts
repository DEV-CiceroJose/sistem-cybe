import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import {
  criarAgendamento,
  listarAgendamentos,
  atualizarAgendamento,
  excluirAgendamento,
} from "../controllers/agendamento.controller";

export const agendamentoRouter = Router();

agendamentoRouter.post("/", asyncHandler(criarAgendamento));
agendamentoRouter.get("/", asyncHandler(listarAgendamentos));
agendamentoRouter.patch("/:id", asyncHandler(atualizarAgendamento));
agendamentoRouter.delete("/:id", asyncHandler(excluirAgendamento));
