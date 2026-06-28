import cron from "node-cron";
import { prisma } from "./database/prisma";
import { filtrarVencidos, calcularProximaExecucao, type Frequencia } from "./services/agendamento.service";
import { executarAuditoriaCompleta } from "./services/auditoria.runner";

/** Executa todos os agendamentos ativos que já venceram e reprograma a próxima execução. */
export async function executarAgendamentosVencidos(agora = new Date()): Promise<void> {
  const ativos = await prisma.agendamento.findMany({ where: { ativo: true } });
  const vencidos = filtrarVencidos(ativos, agora);
  for (const ag of vencidos) {
    try {
      await executarAuditoriaCompleta(ag.url);
    } catch (e) {
      console.error(`[scheduler] Falha ao auditar ${ag.url}:`, (e as Error).message);
    }
    await prisma.agendamento.update({
      where: { id: ag.id },
      data: {
        ultimaExecucao: agora,
        proximaExecucao: calcularProximaExecucao(ag.frequencia as Frequencia, agora),
      },
    });
  }
}

/** Inicia o agendador (de hora em hora). */
export function iniciarScheduler(): void {
  cron.schedule("0 * * * *", () => {
    executarAgendamentosVencidos().catch((e) => console.error("[scheduler]", e));
  });
  console.log("[scheduler] Agendador de auditorias iniciado (de hora em hora).");
}
