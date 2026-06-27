import type { DadosRelatorio } from "./relatorio.types";
import type { Severidade } from "../types/scanner.types";
import { donutScore, barrasCategorias, barrasSeveridade } from "./charts.svg";
import { SEVERIDADE_LABEL } from "../services/vulnerabilidades.catalog";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rotuloStatus(s: string): string {
  if (s === "CONFORME") return "Conforme";
  if (s === "PARCIAL") return "Parcial";
  return "Não conforme";
}

function dataBr(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function duracao(ini: string, fim: string | null): string {
  if (!fim) return "—";
  const ms = new Date(fim).getTime() - new Date(ini).getTime();
  if (ms < 0) return "—";
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}min ${s % 60}s`;
}

const ORDEM_SEV: Severidade[] = ["CRITICA", "ALTA", "MEDIA", "BAIXA", "INFORMATIVA"];

/** Monta um documento HTML profissional autocontido a partir dos dados da auditoria. */
export function gerarRelatorioHtml(d: DadosRelatorio): string {
  const { marca, resultado: r } = d;

  const logo = marca.logoUrl
    ? `<img class="logo" src="${esc(marca.logoUrl)}" alt="logo" onerror="this.style.display='none'"/>`
    : "";

  const resumoSev = ORDEM_SEV
    .map((s) => `<li><strong>${d.resumoPrioridades.porSeveridade[s]}</strong> ${SEVERIDADE_LABEL[s]}</li>`)
    .join("");

  const cookies = r.cookies.length
    ? r.cookies
        .map(
          (c) =>
            `<tr><td>${esc(c.nome)}</td><td>${c.secure ? "✓" : "✗"}</td><td>${c.httpOnly ? "✓" : "✗"}</td><td>${esc(c.sameSite || "—")}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="4">Nenhum cookie na resposta inicial.</td></tr>`;

  const headersList = [
    ["Content-Security-Policy", r.headers.contentSecurityPolicy],
    ["Strict-Transport-Security", r.headers.strictTransportSecurity],
    ["X-Frame-Options", r.headers.xFrameOptions],
    ["X-Content-Type-Options", r.headers.xContentTypeOptions],
    ["Referrer-Policy", r.headers.referrerPolicy],
    ["Permissions-Policy", r.headers.permissionsPolicy],
  ]
    .map(([nome, val]) => `<tr><td>${esc(nome)}</td><td>${val ? "Presente" : "Ausente"}</td></tr>`)
    .join("");

  const planoLinhas = d.vulnerabilidades.length
    ? d.vulnerabilidades
        .map(
          (v) =>
            `<tr><td>${esc(SEVERIDADE_LABEL[v.severidade])}</td><td>${esc(v.titulo)}${v.detalhe ? ` <span class="muted">(${esc(v.detalhe)})</span>` : ""}</td><td>${esc(v.categoria)}</td><td>${v.cvss.toFixed(1)}</td><td>${esc(v.tempoEstimado)}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="5">Nenhuma vulnerabilidade identificada. 🎉</td></tr>`;

  const recsVistas = new Set<string>();
  const recomendacoes = d.vulnerabilidades
    .filter((v) => (recsVistas.has(v.refId) ? false : (recsVistas.add(v.refId), true)))
    .map((v) => `<li><strong>${esc(v.titulo)}:</strong> ${esc(v.recomendacao)}</li>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Relatório de Análise de Segurança — ${esc(d.url)}</title>
<style>
  :root { --accent:#2A9D85; --line:#E2E8F0; --muted:#64748B; --texto:#0F172A; }
  * { box-sizing: border-box; }
  body { font-family: Inter, system-ui, Arial, sans-serif; color: var(--texto); margin: 0; background:#fff; }
  .pagina { max-width: 820px; margin: 0 auto; padding: 32px; }
  h1,h2,h3 { color: var(--texto); }
  h2 { border-bottom: 2px solid var(--line); padding-bottom: 6px; margin-top: 0; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 6px 0 14px; }
  th,td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); }
  .muted { color: var(--muted); }
  .capa { text-align:center; padding: 80px 0; }
  .logo { max-height: 64px; margin-bottom: 16px; }
  nav ul { list-style: none; padding: 0; line-height: 1.9; }
  nav a { color: var(--accent); text-decoration: none; }
  .secao { margin-top: 28px; }
  .graficos { display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start; }
  @page { margin: 18mm; }
  @media print {
    .pagina { max-width: none; padding: 0; }
    .secao, .capa { break-before: page; }
    nav { break-after: page; }
  }
</style>
</head>
<body>
<div class="pagina">

  <header class="capa">
    ${logo}
    <p class="muted">${esc(marca.empresa)}${marca.site ? ` · ${esc(marca.site)}` : ""}</p>
    <h1>Relatório de Análise de Segurança</h1>
    <p><strong>${esc(d.url)}</strong></p>
    <p class="muted">Gerado em ${dataBr(d.criadoEm)}${marca.auditor ? ` · Auditor: ${esc(marca.auditor)}` : ""}</p>
  </header>

  <nav>
    <h2>Sumário</h2>
    <ul>
      <li><a href="#resumo">1. Resumo Executivo</a></li>
      <li><a href="#graficos">2. Gráficos</a></li>
      <li><a href="#linha-do-tempo">3. Linha do Tempo</a></li>
      <li><a href="#evidencias">4. Evidências Técnicas</a></li>
      <li><a href="#dns">5. DNS &amp; E-mail</a></li>
      <li><a href="#plano-de-acao">6. Plano de Ação</a></li>
      <li><a href="#recomendacoes">7. Recomendações</a></li>
      <li><a href="#conformidade">8. Conformidade (OWASP)</a></li>
      <li><a href="#assinatura">9. Assinatura</a></li>
    </ul>
  </nav>

  <section id="resumo" class="secao">
    <h2>1. Resumo Executivo</h2>
    <p>Score geral: <strong>${d.score}/100</strong> — ${esc(d.classificacao)}.</p>
    <p>Total de achados: <strong>${d.resumoPrioridades.total}</strong>. Esforço estimado: ${d.resumoPrioridades.tempoTotalEstimadoMin} min.</p>
    <ul>${resumoSev}</ul>
  </section>

  <section id="graficos" class="secao">
    <h2>2. Gráficos</h2>
    <div class="graficos">
      <div>${donutScore(d.score, d.classificacao)}</div>
      <div>${barrasCategorias(d.categorias)}</div>
      <div>${barrasSeveridade(d.resumoPrioridades.porSeveridade)}</div>
    </div>
  </section>

  <section id="linha-do-tempo" class="secao">
    <h2>3. Linha do Tempo</h2>
    <table>
      <tr><td>Auditoria iniciada</td><td>${dataBr(d.criadoEm)}</td></tr>
      <tr><td>Auditoria concluída</td><td>${dataBr(d.concluidoEm)}</td></tr>
      <tr><td>Duração</td><td>${duracao(d.criadoEm, d.concluidoEm)}</td></tr>
    </table>
  </section>

  <section id="evidencias" class="secao">
    <h2>4. Evidências Técnicas</h2>
    <h3>HTTPS / TLS</h3>
    <table>
      <tr><td>Habilitado</td><td>${r.https.habilitado ? "Sim" : "Não"}</td></tr>
      <tr><td>Versão TLS</td><td>${esc(r.https.versaoTLS || "—")}</td></tr>
      <tr><td>Emissor</td><td>${esc(r.https.emissor || "—")}</td></tr>
      <tr><td>Dias para expirar</td><td>${r.https.diasParaExpirar ?? "—"}</td></tr>
    </table>
    <h3>Cabeçalhos HTTP</h3>
    <table><thead><tr><th>Cabeçalho</th><th>Estado</th></tr></thead><tbody>${headersList}</tbody></table>
    <h3>Cookies</h3>
    <table><thead><tr><th>Nome</th><th>Secure</th><th>HttpOnly</th><th>SameSite</th></tr></thead><tbody>${cookies}</tbody></table>
    <h3>Performance</h3>
    <table>
      <tr><td>Tempo de resposta</td><td>${r.performance.tempoRespostaMs} ms</td></tr>
      <tr><td>Compressão</td><td>${esc(r.performance.compressao || "—")}</td></tr>
      <tr><td>Cache</td><td>${esc(r.performance.cache || "—")}</td></tr>
    </table>
  </section>

  <section id="dns" class="secao">
    <h2>5. DNS &amp; E-mail</h2>
    <table>
      <tr><td>A</td><td>${r.dns.a.map(esc).join(", ") || "—"}</td></tr>
      <tr><td>AAAA</td><td>${r.dns.aaaa.map(esc).join(", ") || "—"}</td></tr>
      <tr><td>MX</td><td>${r.dns.mx.map((m) => esc(`${m.exchange} (${m.prioridade})`)).join(", ") || "—"}</td></tr>
      <tr><td>NS</td><td>${r.dns.ns.map(esc).join(", ") || "—"}</td></tr>
      <tr><td>CNAME</td><td>${r.dns.cname.map(esc).join(", ") || "—"}</td></tr>
      <tr><td>TXT</td><td>${r.dns.txt.map(esc).join("<br/>") || "—"}</td></tr>
    </table>
    <h3>Segurança de E-mail</h3>
    <table>
      <tr><td>SPF</td><td>${r.dns.email.spf.presente ? "Presente" : "Ausente"}</td></tr>
      <tr><td>DMARC</td><td>${r.dns.email.dmarc.presente ? `Presente (p=${esc(r.dns.email.dmarc.politica || "?")})` : "Ausente"}</td></tr>
      <tr><td>DKIM</td><td>${r.dns.email.dkim.selectoresEncontrados.length ? esc(r.dns.email.dkim.selectoresEncontrados.join(", ")) : "Não detectado"}</td></tr>
    </table>
  </section>

  <section id="plano-de-acao" class="secao">
    <h2>6. Plano de Ação</h2>
    <table><thead><tr><th>Severidade</th><th>Achado</th><th>Categoria</th><th>CVSS</th><th>Esforço</th></tr></thead>
    <tbody>${planoLinhas}</tbody></table>
  </section>

  <section id="recomendacoes" class="secao">
    <h2>7. Recomendações</h2>
    <ul>${recomendacoes || "<li>Nenhuma recomendação adicional.</li>"}</ul>
  </section>

  <section id="conformidade" class="secao">
    <h2>8. Conformidade (OWASP Top 10)</h2>
    <p>Conformidade geral: <strong>${d.conformidade.percentual}%</strong></p>
    ${d.conformidade.grupos
      .map(
        (g) => `<h3>${esc(g.grupo)} — ${g.percentual}%</h3>
    <table><thead><tr><th>Item</th><th>Status</th><th>Referência</th></tr></thead><tbody>
    ${g.itens
      .map(
        (i) => `<tr><td>${esc(i.titulo)}${i.detalhe ? ` <span class="muted">(${esc(i.detalhe)})</span>` : ""}</td><td>${esc(rotuloStatus(i.status))}</td><td>${esc(i.referenciaOwasp)}</td></tr>`,
      )
      .join("")}
    </tbody></table>`,
      )
      .join("")}
  </section>

  <section id="assinatura" class="secao">
    <h2>9. Assinatura</h2>
    <p>Relatório emitido por <strong>${esc(marca.empresa)}</strong>${marca.site ? ` (${esc(marca.site)})` : ""}.</p>
    <p>Auditor responsável: <strong>${esc(marca.auditor || "—")}</strong>${marca.contato ? ` · ${esc(marca.contato)}` : ""}.</p>
    <p class="muted">Data de emissão: ${dataBr(d.concluidoEm || d.criadoEm)}</p>
    <p class="muted">Verificações exclusivamente passivas; nenhuma exploração de vulnerabilidades foi realizada.</p>
  </section>

</div>
</body>
</html>`;
}
