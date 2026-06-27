import type {
  ScanResultado,
  ScoreCategoria,
  Vulnerabilidade,
  ResumoPrioridades,
} from "../types/scanner.types";

export interface MarcaRelatorio {
  empresa: string;
  site: string;
  auditor: string;
  contato: string;
  logoUrl: string;
}

export interface DadosRelatorio {
  url: string;
  criadoEm: string;
  concluidoEm: string | null;
  score: number;
  classificacao: "EXCELENTE" | "BOA" | "ATENCAO" | "CRITICA";
  resultado: ScanResultado;
  categorias: ScoreCategoria[];
  vulnerabilidades: Vulnerabilidade[];
  resumoPrioridades: ResumoPrioridades;
  marca: MarcaRelatorio;
}
