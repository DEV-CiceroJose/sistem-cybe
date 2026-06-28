import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { router } from "./routes";
import { iniciarScheduler } from "./scheduler";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { sucesso: false, erro: "Muitas requisições. Tente novamente em alguns minutos." },
});
app.use("/api/", limiter);

app.use("/api", router);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`[Web Security Analyzer] Backend rodando na porta ${env.port} (${env.nodeEnv})`);
});

if (env.nodeEnv !== "test") {
  iniciarScheduler();
}
