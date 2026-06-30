import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { listarPluginsApi, atualizarPluginApi } from "../controllers/plugin.controller";

export const pluginRouter = Router();
pluginRouter.get("/", asyncHandler(listarPluginsApi));
pluginRouter.patch("/:id", asyncHandler(atualizarPluginApi));
