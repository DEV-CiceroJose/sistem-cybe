import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../database/prisma";
import { ScanError } from "../scanner";
import { gerarRelatorioHtml } from "../reports/html.report";
import { montarDadosRelatorio } from "../reports/montarDados";
import { avaliarConformidade } from "../services/conformidade.service";
import { paginar } from "../utils/paginacao";
import { compararAuditorias } from "../services/comparacao.service";
import { executarAuditoriaCompleta } from "../services/auditoria.runner";
import type { AuditoriaComparavel } from "../types/scanner.types";
import { DNS_VAZIO } from "../scanner/dns.scanner";
import { HttpError } from "../middlewares/error.middleware";

const criarAuditoriaSchema = z.object({
  url: z.string().min(1, "A URL é obrigatória.").max(2048),
});

export async function criarAuditoria(req: Request, res: Response) {
  const parse = criarAuditoriaSchema.safeParse(req.body);
  if (!parse.success) {
    throw new HttpError(400, parse.error.issues[0]?.message || "Dados inválidos.");
  }

  let { url } = parse.data;
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  try {
    const id = await executarAuditoriaCompleta(url);
    const auditoriaFinal = await prisma.auditoria.findUnique({
      where: { id },
      include: { resultado: true, relatorio: true },
    });
    res.status(201).json({ sucesso: true, dados: serializarAuditoria(auditoriaFinal) });
  } catch (e) {
    const mensagem = e instanceof ScanError ? e.message : "Erro inesperado ao executar a análise.";
    throw new HttpError(e instanceof ScanError ? 422 : 500, mensagem);
  }
}

export async function listarHistorico(req: Request, res: Response) {
  const { limite, offset } = paginar(req.query);
  const url = typeof req.query.url === "string" && req.query.url ? req.query.url : undefined;
  const where = url ? { url } : undefined;
  const [dados, total] = await Promise.all([
    prisma.auditoria.findMany({ where, orderBy: { criadoEm: "desc" }, take: limite, skip: offset }),
    prisma.auditoria.count({ where }),
  ]);
  res.json({ sucesso: true, dados, paginacao: { total, limite, offset } });
}

export async function buscarAuditoria(req: Request, res: Response) {
  const auditoria = await prisma.auditoria.findUnique({
    where: { id: req.params.id },
    include: { resultado: true, relatorio: true },
  });

  if (!auditoria) throw new HttpError(404, "Auditoria não encontrada.");
  res.json({ sucesso: true, dados: serializarAuditoria(auditoria) });
}

export async function buscarRelatorioMarkdown(req: Request, res: Response) {
  const relatorio = await prisma.relatorio.findUnique({ where: { auditoriaId: req.params.id } });
  if (!relatorio) throw new HttpError(404, "Relatório não encontrado.");

  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.send(relatorio.conteudoMarkdown);
}

export async function buscarRelatorioHtml(req: Request, res: Response) {
  const auditoria = await prisma.auditoria.findUnique({
    where: { id: req.params.id },
    include: { resultado: true },
  });
  if (!auditoria || !auditoria.resultado) {
    throw new HttpError(404, "Relatório não disponível para esta auditoria.");
  }

  const configs = await prisma.configuracao.findMany();
  const resultado = {
    https: JSON.parse(auditoria.resultado.https),
    headers: JSON.parse(auditoria.resultado.headers),
    cookies: JSON.parse(auditoria.resultado.cookies),
    exposicao: JSON.parse(auditoria.resultado.exposicao),
    tecnologias: JSON.parse(auditoria.resultado.tecnologias),
    performance: JSON.parse(auditoria.resultado.performance),
    scoreDetalhe: JSON.parse(auditoria.resultado.scoreDetalhe),
    vulnerabilidades: JSON.parse(auditoria.resultado.vulnerabilidades || "[]"),
    cors: JSON.parse(auditoria.resultado.cors || '{"accessControlAllowOrigin":null,"accessControlAllowCredentials":false}'),
    dns: JSON.parse(auditoria.resultado.dns || JSON.stringify(DNS_VAZIO)),
  };

  const dados = montarDadosRelatorio(auditoria, resultado, configs);
  const html = gerarRelatorioHtml(dados);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
}

function paraComparavel(auditoria: any): AuditoriaComparavel {
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

export async function compararComAnterior(req: Request, res: Response) {
  const atual = await prisma.auditoria.findUnique({
    where: { id: req.params.id },
    include: { resultado: true },
  });
  if (!atual || !atual.resultado) throw new HttpError(404, "Auditoria não encontrada ou sem resultado.");

  const anterior = await prisma.auditoria.findFirst({
    where: { url: atual.url, status: "CONCLUIDA", criadoEm: { lt: atual.criadoEm }, resultado: { isNot: null } },
    orderBy: { criadoEm: "desc" },
    include: { resultado: true },
  });

  if (!anterior || !anterior.resultado) {
    res.json({ sucesso: true, dados: null });
    return;
  }

  const comparacao = compararAuditorias(paraComparavel(anterior), paraComparavel(atual));
  res.json({ sucesso: true, dados: comparacao });
}

export async function excluirAuditoria(req: Request, res: Response) {
  const auditoria = await prisma.auditoria.findUnique({ where: { id: req.params.id } });
  if (!auditoria) throw new HttpError(404, "Auditoria não encontrada.");

  await prisma.auditoria.delete({ where: { id: req.params.id } });
  res.json({ sucesso: true });
}

function serializarAuditoria(auditoria: any) {
  if (!auditoria) return null;
  const resultado = auditoria.resultado
    ? {
        https: JSON.parse(auditoria.resultado.https),
        headers: JSON.parse(auditoria.resultado.headers),
        cookies: JSON.parse(auditoria.resultado.cookies),
        exposicao: JSON.parse(auditoria.resultado.exposicao),
        tecnologias: JSON.parse(auditoria.resultado.tecnologias),
        performance: JSON.parse(auditoria.resultado.performance),
        scoreDetalhe: JSON.parse(auditoria.resultado.scoreDetalhe),
        vulnerabilidades: JSON.parse(auditoria.resultado.vulnerabilidades || "[]"),
        cors: JSON.parse(auditoria.resultado.cors || '{"accessControlAllowOrigin":null,"accessControlAllowCredentials":false}'),
        dns: JSON.parse(auditoria.resultado.dns || JSON.stringify(DNS_VAZIO)),
      }
    : null;
  return {
    ...auditoria,
    resultado,
    conformidade: resultado ? avaliarConformidade(resultado) : null,
  };
}
