import type { DnsInfo } from "../types";
import { Card } from "./Card";

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-16 shrink-0 text-slate-500">{rotulo}</span>
      <span className="break-all text-slate-300">{valor || "—"}</span>
    </div>
  );
}

function StatusEmail({ ok, rotulo, detalhe }: { ok: boolean; rotulo: string; detalhe: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={ok ? "text-ok" : "text-danger"}>{ok ? "✓" : "✕"}</span>
      <span className="text-slate-300">{rotulo}</span>
      <span className="ml-auto text-xs text-slate-500">{detalhe}</span>
    </div>
  );
}

export function RegistrosDns({ dns }: { dns: DnsInfo }) {
  const { email } = dns;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card title="Registros DNS">
        {dns.erro && <p className="mb-2 text-xs text-warn">{dns.erro}</p>}
        <div className="space-y-1.5">
          <Linha rotulo="A" valor={dns.a.join(", ")} />
          <Linha rotulo="AAAA" valor={dns.aaaa.join(", ")} />
          <Linha rotulo="MX" valor={dns.mx.map((m) => `${m.exchange} (${m.prioridade})`).join(", ")} />
          <Linha rotulo="NS" valor={dns.ns.join(", ")} />
          <Linha rotulo="CNAME" valor={dns.cname.join(", ")} />
          <Linha rotulo="TXT" valor={dns.txt.join("  |  ")} />
        </div>
      </Card>
      <Card title="Segurança de E-mail">
        <div className="space-y-2">
          <StatusEmail ok={email.spf.presente} rotulo="SPF" detalhe={email.spf.presente ? "registro publicado" : "ausente"} />
          <StatusEmail
            ok={email.dmarc.presente}
            rotulo="DMARC"
            detalhe={email.dmarc.presente ? `p=${email.dmarc.politica || "?"}` : "ausente"}
          />
          <StatusEmail
            ok={email.dkim.selectoresEncontrados.length > 0}
            rotulo="DKIM"
            detalhe={email.dkim.selectoresEncontrados.length > 0 ? email.dkim.selectoresEncontrados.join(", ") : "não detectado"}
          />
        </div>
        <p className="mt-3 text-[11px] text-slate-500">Detecção de DKIM é best-effort (selectors comuns).</p>
      </Card>
    </div>
  );
}
