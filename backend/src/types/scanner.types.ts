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

export interface CorsInfo {
  accessControlAllowOrigin: string | null;
  accessControlAllowCredentials: boolean;
}

export interface MxRecord {
  exchange: string;
  prioridade: number;
}

export interface SpfInfo {
  presente: boolean;
  registro: string | null;
}

export interface DmarcInfo {
  presente: boolean;
  politica: string | null;
  registro: string | null;
}

export interface DkimInfo {
  selectoresEncontrados: string[];
}

export interface EmailSeguranca {
  spf: SpfInfo;
  dkim: DkimInfo;
  dmarc: DmarcInfo;
}

export interface DnsInfo {
  a: string[];
  aaaa: string[];
  mx: MxRecord[];
  txt: string[];
  ns: string[];
  cname: string[];
  email: EmailSeguranca;
  erro?: string;
}

export interface ScanResultado {
  https: HttpsInfo;
  headers: HeadersInfo;
  cookies: CookieInfo[];
  exposicao: ExposicaoInfo;
  tecnologias: TecnologiasInfo;
  performance: PerformanceInfo;
  cors: CorsInfo;
  dns: DnsInfo;
}

export interface ScoreCategoria {
  categoria: string;
  pontos: number;
  pontosMaximos: number;
  problemas: string[];
  aprovados: string[];
}

export type Severidade = "CRITICA" | "ALTA" | "MEDIA" | "BAIXA" | "INFORMATIVA";

/**
 * Um achado individual da auditoria, já enriquecido com metadados de priorização.
 * `impacto` e `facilidadeCorrecao` vão de 1 a 5 (5 = maior impacto / mais fácil de corrigir).
 * `cvss` é um score simplificado de 0 a 10.
 */
export interface Vulnerabilidade {
  id: string;            // id único da instância (para chaves de UI e persistência)
  refId: string;         // id do item no catálogo
  titulo: string;
  descricao: string;
  categoria: string;
  severidade: Severidade;
  cvss: number;          // 0-10
  impacto: number;       // 1-5
  facilidadeCorrecao: number; // 1-5 (maior = mais fácil)
  tempoEstimado: string; // legível: "15 min", "1-2h"
  tempoEstimadoMin: number;   // em minutos, para somatórios e ordenação
  recomendacao: string;
  detalhe?: string;      // detalhe dinâmico (ex.: nome do cookie, dias para expirar)
}

export interface ResumoPrioridades {
  total: number;
  porSeveridade: Record<Severidade, number>;
  tempoTotalEstimadoMin: number;
  corrijaPrimeiro: Vulnerabilidade[];
}

export interface ScoreFinal {
  score: number;
  classificacao: "EXCELENTE" | "BOA" | "ATENCAO" | "CRITICA";
  categorias: ScoreCategoria[];
  vulnerabilidades: Vulnerabilidade[];
  resumoPrioridades: ResumoPrioridades;
}

export type StatusConformidade = "CONFORME" | "PARCIAL" | "NAO_CONFORME";

export interface ItemConformidade {
  id: string;
  titulo: string;
  status: StatusConformidade;
  referenciaOwasp: string;
  explicacao: string;
  recomendacao: string;
  detalhe?: string;
}

export interface GrupoConformidade {
  grupo: string;
  itens: ItemConformidade[];
  conformes: number;
  total: number;
  percentual: number;
}

export interface ConformidadeResultado {
  grupos: GrupoConformidade[];
  conformes: number;
  total: number;
  percentual: number;
}

export interface AuditoriaComparavel {
  id: string;
  score: number;
  conformidadePercentual: number;
  vulnerabilidades: Vulnerabilidade[];
}

export interface AchadoDiff {
  refId: string;
  titulo: string;
  severidade: Severidade;
  detalhe?: string;
}

export interface ComparacaoResultado {
  baseId: string;
  atualId: string;
  scoreAnterior: number;
  scoreAtual: number;
  scoreDelta: number;
  conformidadeAnterior: number;
  conformidadeAtual: number;
  conformidadeDelta: number;
  novos: AchadoDiff[];
  resolvidos: AchadoDiff[];
  mantidos: AchadoDiff[];
}
