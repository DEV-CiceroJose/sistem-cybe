import { promises as dnsPromises } from "node:dns";

/** Abstração mínima sobre node:dns/promises para permitir injeção em testes. */
export interface DnsResolver {
  resolve4(host: string): Promise<string[]>;
  resolve6(host: string): Promise<string[]>;
  resolveMx(host: string): Promise<{ exchange: string; priority: number }[]>;
  resolveTxt(host: string): Promise<string[][]>;
  resolveNs(host: string): Promise<string[]>;
  resolveCname(host: string): Promise<string[]>;
}

export const resolverPadrao: DnsResolver = {
  resolve4: (h) => dnsPromises.resolve4(h),
  resolve6: (h) => dnsPromises.resolve6(h),
  resolveMx: (h) => dnsPromises.resolveMx(h),
  resolveTxt: (h) => dnsPromises.resolveTxt(h),
  resolveNs: (h) => dnsPromises.resolveNs(h),
  resolveCname: (h) => dnsPromises.resolveCname(h),
};
