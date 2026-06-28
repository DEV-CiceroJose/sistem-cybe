import axios from "axios";
import type { Auditoria, ComparacaoResultado, Agendamento, Alerta, Frequencia, Webhook } from "../types";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1",
  timeout: 30000,
});

export const TOKEN_KEY = "wsa:token";

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (erro) => {
    if (axios.isAxiosError(erro) && erro.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      if (location.pathname !== "/login") location.href = "/login";
    }
    return Promise.reject(erro);
  },
);

export async function autenticarApi(usuario: string, senha: string): Promise<string> {
  const { data } = await api.post("/auth/login", { usuario, senha });
  return data.dados.token;
}

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

export async function listarWebhooks(): Promise<Webhook[]> {
  const { data } = await api.get("/webhooks");
  return data.dados;
}

export async function criarWebhook(url: string): Promise<Webhook> {
  const { data } = await api.post("/webhooks", { url });
  return data.dados;
}

export async function atualizarWebhook(id: string, ativo: boolean): Promise<void> {
  await api.patch(`/webhooks/${id}`, { ativo });
}

export async function excluirWebhook(id: string): Promise<void> {
  await api.delete(`/webhooks/${id}`);
}

export function urlPostman(): string {
  return `${api.defaults.baseURL}/postman`;
}

export function extrairMensagemErro(erro: unknown): string {
  if (axios.isAxiosError(erro)) {
    return erro.response?.data?.erro || erro.message || "Erro de comunicação com o servidor.";
  }
  return erro instanceof Error ? erro.message : "Erro desconhecido.";
}
