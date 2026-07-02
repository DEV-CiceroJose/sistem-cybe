import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { obterEducativoApi } from "../controllers/educativo.controller";

export const educativoRouter = Router();
educativoRouter.get("/", asyncHandler(obterEducativoApi));
