import { createHmac } from "node:crypto";

export interface PayloadWebhook {
  evento: "auditoria.concluida";
  auditoriaId: string;
  url: string;
  score: number | null;
  classificacao: string | null;
  concluidoEm: string | null;
}

/** Monta o corpo do webhook a partir dos dados básicos da auditoria. */
export function construirPayloadWebhook(a: {
  id: string;
  url: string;
  score: number | null;
  classificacao: string | null;
  concluidoEm: Date | null;
}): PayloadWebhook {
  return {
    evento: "auditoria.concluida",
    auditoriaId: a.id,
    url: a.url,
    score: a.score,
    classificacao: a.classificacao,
    concluidoEm: a.concluidoEm ? a.concluidoEm.toISOString() : null,
  };
}

/** Assina o corpo do webhook com HMAC-SHA256 (hex), para o header X-WSA-Signature. */
export function assinarPayload(corpo: string, secret: string): string {
  return createHmac("sha256", secret).update(corpo).digest("hex");
}
