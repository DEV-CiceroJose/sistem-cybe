import { consultarDns, DNS_VAZIO } from "../scanner/dns.scanner";
import { analisarEmail } from "../scanner/email.scanner";
import type { DnsInfo } from "../types/scanner.types";
import type { PluginScanner } from "./tipos";

export const dnsPlugin: PluginScanner = {
  id: "dns",
  nome: "DNS & E-mail",
  descricao: "Consulta registros DNS e a segurança de e-mail (SPF/DKIM/DMARC).",
  async coletar(ctx) {
    let dns: DnsInfo;
    try {
      const [base, email] = await Promise.all([consultarDns(ctx.hostname), analisarEmail(ctx.hostname)]);
      dns = { ...base, email };
    } catch (e: any) {
      dns = { ...DNS_VAZIO, erro: e?.message || "Falha ao consultar DNS." };
    }
    return { dns };
  },
};
