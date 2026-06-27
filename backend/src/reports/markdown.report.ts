import type { ScanResultado, ScoreFinal, Severidade } from "../types/scanner.types";
import { SEVERIDADE_LABEL } from "../services/vulnerabilidades.catalog";
import { avaliarConformidade } from "../services/conformidade.service";

const EMOJI_CLASSIFICACAO: Record<ScoreFinal["classificacao"], string> = {
  EXCELENTE: "🟢 Excelente",
  BOA: "🟡 Boa",
  ATENCAO: "🟠 Atenção",
  CRITICA: "🔴 Crítica",
};

const EMOJI_SEVERIDADE: Record<Severidade, string> = {
  CRITICA: "🔴",
  ALTA: "🟠",
  MEDIA: "🟡",
  BAIXA: "🔵",
  INFORMATIVA: "⚪",
};

function formatarTempo(minutos: number): string {
  if (minutos <= 0) return "—";
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.round((minutos / 60) * 10) / 10;
  return `${horas}h`;
}

export function gerarRelatorioMarkdown(url: string, resultado: ScanResultado, scoreFinal: ScoreFinal): string {
  const dataHora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const todosProblemas = scoreFinal.categorias.flatMap((c) => c.problemas);
  const todosAprovados = scoreFinal.categorias.flatMap((c) => c.aprovados);

  const linhasCategorias = scoreFinal.categorias
    .map((c) => `| ${c.categoria} | ${c.pontos}/${c.pontosMaximos} |`)
    .join("\n");

  const recomendacoes = gerarRecomendacoes(resultado, todosProblemas);
  const planoDeAcao = gerarPlanoDeAcao(scoreFinal);
  const evidencias = gerarEvidencias(resultado);
  const conformidadeMd = gerarConformidadeMd(avaliarConformidade(resultado));

  return `# Relatório de Análise de Segurança

**URL analisada:** ${url}
**Data e hora:** ${dataHora}
**Score geral:** ${scoreFinal.score}/100 — ${EMOJI_CLASSIFICACAO[scoreFinal.classificacao]}

---

## Resumo Executivo

A análise identificou ${todosProblemas.length} ponto(s) de atenção e confirmou ${todosAprovados.length} boa(s) prática(s) já implementada(s). O score geral foi de **${scoreFinal.score}/100**, classificado como **${EMOJI_CLASSIFICACAO[scoreFinal.classificacao]}**.

## Score por Categoria

| Categoria | Pontuação |
|---|---|
${linhasCategorias}

${planoDeAcao}

## Achados (Problemas Identificados)

${todosProblemas.length > 0 ? todosProblemas.map((p) => `- ⚠️ ${p}`).join("\n") : "- Nenhum problema identificado."}

## Itens Aprovados

${todosAprovados.length > 0 ? todosAprovados.map((a) => `- ✅ ${a}`).join("\n") : "- Nenhum item aprovado."}

## Recomendações de Correção

${recomendacoes.length > 0 ? recomendacoes.map((r) => `- ${r}`).join("\n") : "- Nenhuma recomendação adicional."}

${evidencias}

${conformidadeMd}

## Conclusão

${gerarConclusao(scoreFinal)}

## Assinatura

Relatório emitido pelo Web Security Analyzer em ${dataHora}.
As verificações realizadas são exclusivamente passivas.

---
*Relatório gerado automaticamente pelo Web Security Analyzer. As verificações realizadas são exclusivamente passivas e não envolvem exploração de vulnerabilidades.*
`;
}

function gerarConformidadeMd(c: ReturnType<typeof avaliarConformidade>): string {
  const linhas = c.grupos
    .map(
      (g) =>
        `### ${g.grupo} — ${g.percentual}%\n\n${g.itens
          .map((i) => `- ${i.status === "CONFORME" ? "✅" : i.status === "PARCIAL" ? "🟡" : "❌"} ${i.titulo} (${i.referenciaOwasp})`)
          .join("\n")}`,
    )
    .join("\n\n");
  return `## Conformidade (OWASP Top 10)\n\nConformidade geral: **${c.percentual}%**\n\n${linhas}`;
}

function gerarEvidencias(resultado: ScanResultado): string {
  const { https, cookies, performance } = resultado;
  const httpsLinha = `${https.habilitado ? "habilitado" : "ausente"}${https.versaoTLS ? ` · ${https.versaoTLS}` : ""}${https.emissor ? ` · Emissor: ${https.emissor}` : ""}${https.diasParaExpirar !== undefined ? ` · Expira em ${https.diasParaExpirar} dia(s)` : ""}`;
  const cookiesLinha = cookies.length > 0
    ? cookies.map((c) => `${c.nome} (Secure=${c.secure}, HttpOnly=${c.httpOnly}, SameSite=${c.sameSite || "—"})`).join("; ")
    : "nenhum cookie na resposta inicial.";

  return `## Evidências Técnicas

**HTTPS/TLS:** ${httpsLinha}

**Cookies:** ${cookiesLinha}

**Performance:** tempo de resposta ${performance.tempoRespostaMs} ms · compressão ${performance.compressao || "nenhuma"} · cache ${performance.cache || "nenhum"}.`;
}

function gerarPlanoDeAcao(scoreFinal: ScoreFinal): string {
  const { vulnerabilidades, resumoPrioridades } = scoreFinal;

  if (vulnerabilidades.length === 0) {
    return `## Plano de Ação Priorizado\n\nNenhuma vulnerabilidade identificada — nada a priorizar. 🎉`;
  }

  const ordemSeveridade: Severidade[] = ["CRITICA", "ALTA", "MEDIA", "BAIXA", "INFORMATIVA"];
  const linhasResumo = ordemSeveridade
    .filter((s) => resumoPrioridades.porSeveridade[s] > 0)
    .map((s) => `| ${EMOJI_SEVERIDADE[s]} ${SEVERIDADE_LABEL[s]} | ${resumoPrioridades.porSeveridade[s]} |`)
    .join("\n");

  const corrijaPrimeiro = resumoPrioridades.corrijaPrimeiro
    .map((v, i) => `${i + 1}. ${EMOJI_SEVERIDADE[v.severidade]} **${v.titulo}** — ${v.recomendacao} _(≈ ${v.tempoEstimado})_`)
    .join("\n");

  const tabela = vulnerabilidades
    .map(
      (v) =>
        `| ${EMOJI_SEVERIDADE[v.severidade]} ${SEVERIDADE_LABEL[v.severidade]} | ${v.titulo}${v.detalhe ? ` (${v.detalhe})` : ""} | ${v.categoria} | ${v.cvss.toFixed(1)} | ${v.tempoEstimado} |`,
    )
    .join("\n");

  return `## Plano de Ação Priorizado

**Total de achados:** ${resumoPrioridades.total} · **Esforço estimado total:** ${formatarTempo(resumoPrioridades.tempoTotalEstimadoMin)}

| Severidade | Quantidade |
|---|---|
${linhasResumo}

### 🔧 Corrija primeiro

${corrijaPrimeiro}

### Lista priorizada completa

| Severidade | Achado | Categoria | CVSS | Esforço |
|---|---|---|---|---|
${tabela}`;
}

function gerarRecomendacoes(resultado: ScanResultado, problemas: string[]): string[] {
  const recs: string[] = [];

  if (!resultado.https.habilitado) recs.push("Configure um certificado SSL/TLS válido e force o redirecionamento de HTTP para HTTPS.");
  if (resultado.https.diasParaExpirar !== undefined && resultado.https.diasParaExpirar < 30) {
    recs.push("Renove o certificado SSL/TLS antes da expiração para evitar interrupções e alertas de segurança no navegador.");
  }
  if (!resultado.headers.contentSecurityPolicy) recs.push("Implemente um cabeçalho Content-Security-Policy para mitigar ataques de XSS e injeção de conteúdo.");
  if (!resultado.headers.strictTransportSecurity) recs.push("Adicione o cabeçalho Strict-Transport-Security (HSTS) para forçar conexões HTTPS.");
  if (!resultado.headers.xFrameOptions) recs.push("Configure X-Frame-Options para mitigar ataques de clickjacking.");
  if (!resultado.headers.xContentTypeOptions) recs.push("Adicione X-Content-Type-Options: nosniff para evitar MIME sniffing.");
  if (resultado.exposicao.server) recs.push("Remova ou genéricize o cabeçalho Server para reduzir a superfície de informação exposta a atacantes.");
  if (resultado.exposicao.xPoweredBy) recs.push("Desative o cabeçalho X-Powered-By para não revelar a tecnologia do backend.");
  if (!resultado.performance.compressao) recs.push("Habilite compressão Gzip ou Brotli para reduzir o tamanho das respostas e melhorar a performance.");
  if (resultado.cookies.some((c) => !c.secure || !c.httpOnly || !c.sameSite)) {
    recs.push("Revise os atributos Secure, HttpOnly e SameSite de todos os cookies emitidos pela aplicação.");
  }

  return recs;
}

function gerarConclusao(scoreFinal: ScoreFinal): string {
  switch (scoreFinal.classificacao) {
    case "EXCELENTE":
      return "O site demonstra um excelente nível de maturidade em segurança, com a maioria das boas práticas essenciais implementadas.";
    case "BOA":
      return "O site apresenta um bom nível de segurança, mas alguns ajustes pontuais podem elevar ainda mais sua proteção.";
    case "ATENCAO":
      return "O site apresenta lacunas de segurança que merecem atenção. Recomenda-se priorizar as correções listadas acima.";
    default:
      return "O site apresenta falhas críticas de segurança que devem ser corrigidas com urgência para reduzir riscos de exposição.";
  }
}
