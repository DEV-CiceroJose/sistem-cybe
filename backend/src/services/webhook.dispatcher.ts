import { prisma } from "../database/prisma";
import { construirPayloadWebhook, assinarPayload } from "./webhook.service";

async function entregar(
  url: string,
  corpo: string,
  assinatura: string,
): Promise<{ ok: boolean; httpStatus?: number; erro?: string }> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-WSA-Event": "auditoria.concluida",
        "X-WSA-Signature": assinatura,
      },
      body: corpo,
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return { ok: resp.ok, httpStatus: resp.status, erro: resp.ok ? undefined : `HTTP ${resp.status}` };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}

/** Dispara o evento de conclusão para os webhooks ativos (1 retentativa) e registra as entregas. */
export async function dispararWebhooks(auditoriaId: string): Promise<void> {
  const auditoria = await prisma.auditoria.findUnique({ where: { id: auditoriaId } });
  if (!auditoria) return;
  const webhooks = await prisma.webhook.findMany({ where: { ativo: true } });
  if (webhooks.length === 0) return;

  const corpo = JSON.stringify(
    construirPayloadWebhook({
      id: auditoria.id,
      url: auditoria.url,
      score: auditoria.score ?? null,
      classificacao: auditoria.classificacao ?? null,
      concluidoEm: auditoria.concluidoEm ?? null,
    }),
  );

  for (const wh of webhooks) {
    const assinatura = assinarPayload(corpo, wh.secret);
    let r = await entregar(wh.url, corpo, assinatura);
    let tentativas = 1;
    if (!r.ok) {
      r = await entregar(wh.url, corpo, assinatura);
      tentativas = 2;
    }
    await prisma.webhookEntrega.create({
      data: {
        webhookId: wh.id,
        auditoriaId,
        status: r.ok ? "SUCESSO" : "FALHA",
        httpStatus: r.httpStatus,
        tentativas,
        erro: r.erro,
      },
    });
  }
}
