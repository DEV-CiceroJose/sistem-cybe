import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../database/prisma";
import { executarScan, ScanError } from "../scanner";
import { calcularScore } from "./scoring.service";
import { gerarRelatorioMarkdown } from "../reports/markdown.report";
import { avaliarConformidade } from "./conformidade.service";
import { compararAuditorias } from "./comparacao.service";
import { gerarAlertas } from "./alertas.service";
import { dispararWebhooks } from "./webhook.dispatcher";
import { lerPluginsAtivos } from "./plugins.service";
import { registrarPluginsEmbutidos } from "../plugins";
import { idsPlugins } from "../plugins/registro";
import { DNS_VAZIO } from "../scanner/dns.scanner";
import type { AuditoriaComparavel } from "../types/scanner.types";

const RELATORIOS_DIR = path.join(process.cwd(), "relatorios");

function comparavelDe(auditoria: any): AuditoriaComparavel {
  const resultado = {
    https: JSON.parse(auditoria.resultado.https),
    headers: JSON.parse(auditoria.resultado.headers),
    cookies: JSON.parse(auditoria.resultado.cookies),
    exposicao: JSON.parse(auditoria.resultado.exposicao),
    tecnologias: JSON.parse(auditoria.resultado.tecnologias),
    performance: JSON.parse(auditoria.resultado.performance),
    cors: JSON.parse(auditoria.resultado.cors || '{"accessControlAllowOrigin":null,"accessControlAllowCredentials":false}'),
    dns: JSON.parse(auditoria.resultado.dns || JSON.stringify(DNS_VAZIO)),
  };
  return {
    id: auditoria.id,
    score: auditoria.score ?? 0,
    conformidadePercentual: avaliarConformidade(resultado as any).percentual,
    vulnerabilidades: JSON.parse(auditoria.resultado.vulnerabilidades || "[]"),
  };
}

async function gerarAlertasDaAuditoria(auditoriaId: string, url: string): Promise<void> {
  const atual = await prisma.auditoria.findUnique({ where: { id: auditoriaId }, include: { resultado: true } });
  if (!atual || !atual.resultado) return;
  const anterior = await prisma.auditoria.findFirst({
    where: { url, status: "CONCLUIDA", criadoEm: { lt: atual.criadoEm }, resultado: { isNot: null } },
    orderBy: { criadoEm: "desc" },
    include: { resultado: true },
  });
  if (!anterior || !anterior.resultado) return;

  const comparacao = compararAuditorias(comparavelDe(anterior), comparavelDe(atual));
  const alertas = gerarAlertas(comparacao);
  if (alertas.length === 0) return;
  await prisma.alerta.createMany({
    data: alertas.map((a) => ({ url, tipo: a.tipo, mensagem: a.mensagem, auditoriaId })),
  });
}

/** Executa o scan completo de uma URL, persiste e gera alertas. Retorna o id da auditoria. */
export async function executarAuditoriaCompleta(url: string): Promise<string> {
  const auditoria = await prisma.auditoria.create({ data: { url, status: "EM_ANDAMENTO" } });

  try {
    registrarPluginsEmbutidos();
    const configs = await prisma.configuracao.findMany();
    const idsAtivos = lerPluginsAtivos(configs, idsPlugins());
    const { resultado, urlFinal } = await executarScan(url, idsAtivos);
    const scoreFinal = calcularScore(resultado);
    const markdown = gerarRelatorioMarkdown(urlFinal, resultado, scoreFinal);

    await fs.mkdir(RELATORIOS_DIR, { recursive: true });
    const nomeArquivo = `relatorio-${auditoria.id}.md`;
    await fs.writeFile(path.join(RELATORIOS_DIR, nomeArquivo), markdown, "utf-8");

    await prisma.$transaction([
      prisma.resultado.create({
        data: {
          auditoriaId: auditoria.id,
          https: JSON.stringify(resultado.https),
          headers: JSON.stringify(resultado.headers),
          cookies: JSON.stringify(resultado.cookies),
          exposicao: JSON.stringify(resultado.exposicao),
          tecnologias: JSON.stringify(resultado.tecnologias),
          performance: JSON.stringify(resultado.performance),
          scoreDetalhe: JSON.stringify(scoreFinal.categorias),
          vulnerabilidades: JSON.stringify(scoreFinal.vulnerabilidades),
          cors: JSON.stringify(resultado.cors),
          dns: JSON.stringify(resultado.dns),
        },
      }),
      prisma.relatorio.create({
        data: { auditoriaId: auditoria.id, caminhoArquivo: nomeArquivo, conteudoMarkdown: markdown },
      }),
      prisma.auditoria.update({
        where: { id: auditoria.id },
        data: {
          status: "CONCLUIDA",
          score: scoreFinal.score,
          classificacao: scoreFinal.classificacao,
          concluidoEm: new Date(),
        },
      }),
    ]);

    await gerarAlertasDaAuditoria(auditoria.id, url);
    dispararWebhooks(auditoria.id).catch((e) => console.error("[webhooks]", (e as Error).message));
    return auditoria.id;
  } catch (e) {
    const mensagem = e instanceof ScanError ? e.message : "Erro inesperado ao executar a análise.";
    await prisma.auditoria.update({ where: { id: auditoria.id }, data: { status: "ERRO", erro: mensagem } });
    throw e;
  }
}
