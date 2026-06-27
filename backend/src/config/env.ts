import dotenv from "dotenv";
dotenv.config();

export const env = {
  port: Number(process.env.PORT || 3001),
  nodeEnv: process.env.NODE_ENV || "development",
  scanTimeoutMs: Number(process.env.SCAN_TIMEOUT_MS || 8000),
  maxResponseBytes: Number(process.env.MAX_RESPONSE_BYTES || 5 * 1024 * 1024),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
};
