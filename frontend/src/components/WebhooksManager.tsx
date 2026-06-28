import { useEffect, useState } from "react";
import type { Webhook } from "../types";
import { Card } from "./Card";
import { listarWebhooks, criarWebhook, atualizarWebhook, excluirWebhook, urlPostman } from "../services/api";

export function WebhooksManager() {
  const [lista, setLista] = useState<Webhook[]>([]);
  const [url, setUrl] = useState("");

  async function carregar() {
    setLista(await listarWebhooks());
  }
  useEffect(() => {
    carregar().catch(() => {});
  }, []);

  async function adicionar() {
    if (!url.trim()) return;
    await criarWebhook(url.trim());
    setUrl("");
    await carregar();
  }

  return (
    <Card
      className="max-w-md"
      title="Webhooks"
      action={
        <a href={urlPostman()} className="text-xs text-accent hover:underline">
          Baixar coleção Postman
        </a>
      }
    >
      <p className="mb-4 text-xs text-slate-500">
        Receba um POST assinado (HMAC) quando uma auditoria concluir.
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://meu-endpoint.com/webhook"
          className="flex-1 rounded-md border border-line bg-bg-raised px-3 py-1.5 text-sm text-slate-200 outline-none placeholder:text-slate-600"
        />
        <button onClick={adicionar} className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-bg hover:opacity-90">
          Adicionar
        </button>
      </div>
      {lista.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum webhook.</p>
      ) : (
        <div className="space-y-2">
          {lista.map((w) => (
            <div key={w.id} className="rounded-lg border border-line bg-bg-raised/40 p-2.5 text-sm">
              <p className="break-all text-slate-200">{w.url}</p>
              <p className="mt-1 break-all text-[11px] text-slate-500">secret: {w.secret}</p>
              <div className="mt-2 flex items-center gap-3">
                <button
                  onClick={async () => {
                    await atualizarWebhook(w.id, !w.ativo);
                    await carregar();
                  }}
                  className={`text-xs ${w.ativo ? "text-ok" : "text-slate-500"} hover:underline`}
                >
                  {w.ativo ? "ativo" : "inativo"}
                </button>
                <button
                  onClick={async () => {
                    await excluirWebhook(w.id);
                    await carregar();
                  }}
                  className="text-xs text-danger hover:underline"
                >
                  excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
