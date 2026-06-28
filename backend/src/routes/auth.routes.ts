import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { login } from "../controllers/auth.controller";

export const authRouter = Router();
authRouter.post("/login", asyncHandler(login));
