import type { Request, Response } from "express";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../database/prisma";
import { executarScan, ScanError } from "../scanner";
import { calcularScore } from "../services/scoring.service";
import { gerarRelatorioMarkdown } from "../reports/markdown.report";
import { gerarRelatorioHtml } from "../reports/html.report";
import { montarDadosRelatorio } from "../reports/montarDados";
import { HttpError } from "../middlewares/error.middleware";

const RELATORIOS_DIR = path.join(process.cwd(), "relatorios");

const criarAuditoriaSchema = z.object({
  url: z.string().min(1, "A URL é obrigatória.").max(2048),
});

function classificacaoParaEnum(c: string) {
  return c as "EXCELENTE" | "BOA" | "ATENCAO" | "CRITICA";
}

export async function criarAuditoria(req: Request, res: Response) {
  const parse = criarAuditoriaSchema.safeParse(req.body);
  if (!parse.success) {
    throw new HttpError(400, parse.error.issues[0]?.message || "Dados inválidos.");
  }

  let { url } = parse.data;
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  const auditoria = await prisma.auditoria.create({
    data: { url, status: "EM_ANDAMENTO" },
  });

  try {
    const { resultado, urlFinal } = await executarScan(url);
    const scoreFinal = calcularScore(resultado);
    const markdown = gerarRelatorioMarkdown(urlFinal, resultado, scoreFinal);

    await fs.mkdir(RELATORIOS_DIR, { recursive: true });
    const nomeArquivo = `relatorio-${auditoria.id}.md`;
    const caminhoArquivo = path.join(RELATORIOS_DIR, nomeArquivo);
    await fs.writeFile(caminhoArquivo, markdown, "utf-8");

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
        },
      }),
      prisma.relatorio.create({
        data: {
          auditoriaId: auditoria.id,
          caminhoArquivo: nomeArquivo,
          conteudoMarkdown: markdown,
        },
      }),
      prisma.auditoria.update({
        where: { id: auditoria.id },
        data: {
          status: "CONCLUIDA",
          score: scoreFinal.score,
          classificacao: classificacaoParaEnum(scoreFinal.classificacao),
          concluidoEm: new Date(),
        },
      }),
    ]);

    const auditoriaFinal = await prisma.auditoria.findUnique({
      where: { id: auditoria.id },
      include: { resultado: true, relatorio: true },
    });

    res.status(201).json({ sucesso: true, dados: serializarAuditoria(auditoriaFinal) });
  } catch (e) {
    const mensagem = e instanceof ScanError ? e.message : "Erro inesperado ao executar a análise.";
    await prisma.auditoria.update({
      where: { id: auditoria.id },
      data: { status: "ERRO", erro: mensagem },
    });
    throw new HttpError(e instanceof ScanError ? 422 : 500, mensagem);
  }
}

export async function listarHistorico(req: Request, res: Response) {
  const limite = Math.min(Number(req.query.limite) || 20, 100);
  const auditorias = await prisma.auditoria.findMany({
    orderBy: { criadoEm: "desc" },
    take: limite,
  });
  res.json({ sucesso: true, dados: auditorias });
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
  };

  const dados = montarDadosRelatorio(auditoria, resultado, configs);
  const html = gerarRelatorioHtml(dados);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
}

export async function excluirAuditoria(req: Request, res: Response) {
  const auditoria = await prisma.auditoria.findUnique({ where: { id: req.params.id } });
  if (!auditoria) throw new HttpError(404, "Auditoria não encontrada.");

  await prisma.auditoria.delete({ where: { id: req.params.id } });
  res.json({ sucesso: true });
}

function serializarAuditoria(auditoria: any) {
  if (!auditoria) return null;
  return {
    ...auditoria,
    resultado: auditoria.resultado
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
        }
      : null,
  };
}
