import type { DadosRelatorio } from "./relatorio.types";
import type { ScanResultado, ScoreCategoria, Vulnerabilidade } from "../types/scanner.types";
import { lerMarca } from "./branding.service";
import { resumirPrioridades } from "../services/priorizacao.service";

interface AuditoriaBasica {
  url: string;
  criadoEm: Date;
  concluidoEm: Date | null;
  score: number | null;
  classificacao: "EXCELENTE" | "BOA" | "ATENCAO" | "CRITICA" | null;
}

interface ResultadoDesserializado extends ScanResultado {
  scoreDetalhe: ScoreCategoria[];
  vulnerabilidades: Vulnerabilidade[];
}

/**
 * Combina os dados persistidos da auditoria com a marca configurada,
 * produzindo o objeto que alimenta os geradores de relatório.
 */
export function montarDadosRelatorio(
  auditoria: AuditoriaBasica,
  resultado: ResultadoDesserializado,
  configs: { chave: string; valor: string }[],
): DadosRelatorio {
  const vulnerabilidades = resultado.vulnerabilidades ?? [];
  return {
    url: auditoria.url,
    criadoEm: auditoria.criadoEm.toISOString(),
    concluidoEm: auditoria.concluidoEm ? auditoria.concluidoEm.toISOString() : null,
    score: auditoria.score ?? 0,
    classificacao: auditoria.classificacao ?? "CRITICA",
    resultado: {
      https: resultado.https,
      headers: resultado.headers,
      cookies: resultado.cookies,
      exposicao: resultado.exposicao,
      tecnologias: resultado.tecnologias,
      performance: resultado.performance,
      cors: resultado.cors,
    },
    categorias: resultado.scoreDetalhe ?? [],
    vulnerabilidades,
    resumoPrioridades: resumirPrioridades(vulnerabilidades),
    marca: lerMarca(configs),
  };
}
