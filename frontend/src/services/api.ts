import axios from "axios";
import type { Auditoria, ComparacaoResultado, Agendamento, Alerta, Frequencia } from "../types";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/api",
  timeout: 30000,
});

export async function criarAuditoria(url: string): Promise<Auditoria> {
  const { data } = await api.post("/auditorias", { url });
  return data.dados;
}

export async function listarHistorico(limite = 20, url?: string): Promise<Auditoria[]> {
  const { data } = await api.get("/auditorias", { params: { limite, ...(url ? { url } : {}) } });
  return data.dados;
}

export async function buscarComparacao(id: string): Promise<ComparacaoResultado | null> {
  const { data } = await api.get(`/auditorias/${id}/comparacao`);
  return data.dados;
}

export async function buscarAuditoria(id: string): Promise<Auditoria> {
  const { data } = await api.get(`/auditorias/${id}`);
  return data.dados;
}

export async function buscarRelatorioMarkdown(id: string): Promise<string> {
  const { data } = await api.get(`/auditorias/${id}/relatorio`, { responseType: "text" });
  return data;
}

export async function buscarRelatorioHtml(id: string): Promise<string> {
  const { data } = await api.get(`/auditorias/${id}/relatorio.html`, { responseType: "text" });
  return data;
}

export async function excluirAuditoria(id: string): Promise<void> {
  await api.delete(`/auditorias/${id}`);
}

export async function listarConfiguracoes(): Promise<{ chave: string; valor: string }[]> {
  const { data } = await api.get("/configuracoes");
  return data.dados;
}

export async function salvarConfiguracao(chave: string, valor: string): Promise<void> {
  await api.put("/configuracoes", { chave, valor });
}

export async function listarAgendamentos(): Promise<Agendamento[]> {
  const { data } = await api.get("/agendamentos");
  return data.dados;
}

export async function criarAgendamento(url: string, frequencia: Frequencia): Promise<Agendamento> {
  const { data } = await api.post("/agendamentos", { url, frequencia });
  return data.dados;
}

export async function atualizarAgendamento(
  id: string,
  payload: { ativo?: boolean; frequencia?: Frequencia },
): Promise<Agendamento> {
  const { data } = await api.patch(`/agendamentos/${id}`, payload);
  return data.dados;
}

export async function excluirAgendamento(id: string): Promise<void> {
  await api.delete(`/agendamentos/${id}`);
}

export async function listarAlertas(lido?: boolean): Promise<Alerta[]> {
  const { data } = await api.get("/alertas", { params: lido === undefined ? {} : { lido } });
  return data.dados;
}

export async function marcarAlertaLido(id: string, lido: boolean): Promise<void> {
  await api.patch(`/alertas/${id}`, { lido });
}

export async function marcarAlertasLidos(): Promise<void> {
  await api.post("/alertas/marcar-lidos");
}

export function extrairMensagemErro(erro: unknown): string {
  if (axios.isAxiosError(erro)) {
    return erro.response?.data?.erro || erro.message || "Erro de comunicação com o servidor.";
  }
  return erro instanceof Error ? erro.message : "Erro desconhecido.";
}
