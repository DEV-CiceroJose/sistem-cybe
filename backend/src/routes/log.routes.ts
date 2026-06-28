import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { listarLogs } from "../controllers/log.controller";

export const logRouter = Router();
logRouter.get("/", asyncHandler(listarLogs));
