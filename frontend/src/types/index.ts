export type StatusAuditoria = "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA" | "ERRO";
export type Classificacao = "EXCELENTE" | "BOA" | "ATENCAO" | "CRITICA";

export interface HttpsInfo {
  habilitado: boolean;
  versaoTLS?: string;
  emissor?: string;
  validoDe?: string;
  validoAte?: string;
  diasParaExpirar?: number;
  cadeiaConfiavel?: boolean;
  erro?: string;
}

export interface HeadersInfo {
  contentSecurityPolicy: string | null;
  strictTransportSecurity: string | null;
  xFrameOptions: string | null;
  xContentTypeOptions: string | null;
  referrerPolicy: string | null;
  permissionsPolicy: string | null;
}

export interface CookieInfo {
  nome: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string | null;
}

export interface ExposicaoInfo {
  server: string | null;
  xPoweredBy: string | null;
  comentariosHtmlEncontrados: number;
  robotsTxtExiste: boolean;
  sitemapXmlExiste: boolean;
}

export interface TecnologiasInfo {
  frameworks: string[];
  cms: string[];
  servidorWeb: string | null;
  cdn: string[];
  bibliotecasJs: string[];
  linguagem: string | null;
}

export interface PerformanceInfo {
  tempoRespostaMs: number;
  compressao: string | null;
  cache: string | null;
  tamanhoPaginaBytes: number;
  quantidadeRequisicoesIniciais: number;
}

export interface ScoreCategoria {
  categoria: string;
  pontos: number;
  pontosMaximos: number;
  problemas: string[];
  aprovados: string[];
}

export type Severidade = "CRITICA" | "ALTA" | "MEDIA" | "BAIXA" | "INFORMATIVA";

export interface Vulnerabilidade {
  id: string;
  refId: string;
  titulo: string;
  descricao: string;
  categoria: string;
  severidade: Severidade;
  cvss: number;
  impacto: number;            // 1-5
  facilidadeCorrecao: number; // 1-5 (maior = mais fácil)
  tempoEstimado: string;
  tempoEstimadoMin: number;
  recomendacao: string;
  detalhe?: string;
}

export interface ResultadoAuditoria {
  https: HttpsInfo;
  headers: HeadersInfo;
  cookies: CookieInfo[];
  exposicao: ExposicaoInfo;
  tecnologias: TecnologiasInfo;
  performance: PerformanceInfo;
  scoreDetalhe: ScoreCategoria[];
  vulnerabilidades: Vulnerabilidade[];
}

export interface Relatorio {
  id: string;
  caminhoArquivo: string;
  conteudoMarkdown: string;
  criadoEm: string;
}

export interface Auditoria {
  id: string;
  url: string;
  status: StatusAuditoria;
  score: number | null;
  classificacao: Classificacao | null;
  erro: string | null;
  criadoEm: string;
  concluidoEm: string | null;
  resultado?: ResultadoAuditoria | null;
  relatorio?: Relatorio | null;
}
