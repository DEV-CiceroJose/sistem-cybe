import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { baixarPostman } from "../controllers/postman.controller";

export const postmanRouter = Router();
postmanRouter.get("/", asyncHandler(baixarPostman));
