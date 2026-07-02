import type { Severidade, Vulnerabilidade } from "../types/scanner.types";

/**
 * Catálogo central de achados conhecidos. Cada scanner reporta um problema por
 * `refId`; aqui ficam os metadados de priorização (severidade, CVSS simplificado,
 * impacto, facilidade de correção, tempo estimado e recomendação).
 *
 * Manter os metadados centralizados garante consistência entre o cálculo de
 * score, o relatório e o painel de prioridades do frontend.
 */
export interface CatalogoEntrada {
  refId: string;
  titulo: string;
  descricao: string;
  categoria: string;
  severidade: Severidade;
  cvss: number;               // 0-10 (estimativa simplificada)
  impacto: number;            // 1-5
  facilidadeCorrecao: number; // 1-5 (5 = correção trivial)
  tempoEstimado: string;
  tempoEstimadoMin: number;
  recomendacao: string;
}

export const SEVERIDADE_RANK: Record<Severidade, number> = {
  CRITICA: 5,
  ALTA: 4,
  MEDIA: 3,
  BAIXA: 2,
  INFORMATIVA: 1,
};

export const SEVERIDADE_LABEL: Record<Severidade, string> = {
  CRITICA: "Crítica",
  ALTA: "Alta",
  MEDIA: "Média",
  BAIXA: "Baixa",
  INFORMATIVA: "Informativa",
};

const CATALOGO: Record<string, CatalogoEntrada> = {
  // ---- HTTPS / TLS ----
  "https-ausente": {
    refId: "https-ausente",
    titulo: "Site sem HTTPS",
    descricao:
      "O tráfego trafega em texto puro, permitindo interceptação e adulteração dos dados em trânsito.",
    categoria: "HTTPS",
    severidade: "CRITICA",
    cvss: 7.4,
    impacto: 5,
    facilidadeCorrecao: 3,
    tempoEstimado: "2-4h",
    tempoEstimadoMin: 180,
    recomendacao:
      "Instale um certificado TLS válido (ex.: Let's Encrypt) e force o redirecionamento de HTTP para HTTPS.",
  },
  "tls-nao-confiavel": {
    refId: "tls-nao-confiavel",
    titulo: "Certificado TLS não confiável",
    descricao:
      "A cadeia de certificação não pôde ser validada, gerando alertas de segurança no navegador e quebra de confiança.",
    categoria: "HTTPS",
    severidade: "ALTA",
    cvss: 6.5,
    impacto: 4,
    facilidadeCorrecao: 3,
    tempoEstimado: "1-2h",
    tempoEstimadoMin: 90,
    recomendacao:
      "Reinstale o certificado com a cadeia intermediária completa emitida por uma Autoridade Certificadora confiável.",
  },
  "cert-expirado": {
    refId: "cert-expirado",
    titulo: "Certificado SSL/TLS expirado",
    descricao:
      "O certificado já venceu; navegadores bloqueiam o acesso e exibem alertas críticos aos usuários.",
    categoria: "HTTPS",
    severidade: "CRITICA",
    cvss: 7.0,
    impacto: 5,
    facilidadeCorrecao: 4,
    tempoEstimado: "1h",
    tempoEstimadoMin: 60,
    recomendacao:
      "Renove o certificado imediatamente e configure renovação automática para evitar reincidência.",
  },
  "cert-expirando": {
    refId: "cert-expirando",
    titulo: "Certificado SSL/TLS próximo do vencimento",
    descricao:
      "O certificado expira em poucos dias; sem renovação, o site ficará inacessível.",
    categoria: "HTTPS",
    severidade: "MEDIA",
    cvss: 4.0,
    impacto: 3,
    facilidadeCorrecao: 5,
    tempoEstimado: "30 min",
    tempoEstimadoMin: 30,
    recomendacao:
      "Renove o certificado antes do vencimento e habilite a renovação automática.",
  },

  // ---- Cabeçalhos HTTP ----
  "header-csp-ausente": {
    refId: "header-csp-ausente",
    titulo: "Content-Security-Policy ausente",
    descricao:
      "Sem CSP, a aplicação fica mais exposta a Cross-Site Scripting (XSS) e injeção de conteúdo malicioso.",
    categoria: "Headers",
    severidade: "ALTA",
    cvss: 6.1,
    impacto: 4,
    facilidadeCorrecao: 2,
    tempoEstimado: "2-4h",
    tempoEstimadoMin: 180,
    recomendacao:
      "Defina uma política Content-Security-Policy restritiva, começando em modo report-only para ajuste fino.",
  },
  "header-hsts-ausente": {
    refId: "header-hsts-ausente",
    titulo: "Strict-Transport-Security (HSTS) ausente",
    descricao:
      "Sem HSTS, o navegador pode aceitar conexões HTTP, facilitando ataques de downgrade e man-in-the-middle.",
    categoria: "Headers",
    severidade: "MEDIA",
    cvss: 5.0,
    impacto: 3,
    facilidadeCorrecao: 5,
    tempoEstimado: "15 min",
    tempoEstimadoMin: 15,
    recomendacao:
      "Adicione o cabeçalho Strict-Transport-Security com max-age de pelo menos 6 meses (includeSubDomains quando aplicável).",
  },
  "header-xframe-ausente": {
    refId: "header-xframe-ausente",
    titulo: "X-Frame-Options ausente",
    descricao:
      "A página pode ser incorporada em iframes de terceiros, permitindo ataques de clickjacking.",
    categoria: "Headers",
    severidade: "MEDIA",
    cvss: 4.3,
    impacto: 3,
    facilidadeCorrecao: 5,
    tempoEstimado: "15 min",
    tempoEstimadoMin: 15,
    recomendacao:
      "Defina X-Frame-Options: DENY ou SAMEORIGIN (ou a diretiva frame-ancestors no CSP).",
  },
  "header-xcto-ausente": {
    refId: "header-xcto-ausente",
    titulo: "X-Content-Type-Options ausente",
    descricao:
      "Sem nosniff, o navegador pode interpretar recursos com tipo MIME diferente do declarado (MIME sniffing).",
    categoria: "Headers",
    severidade: "BAIXA",
    cvss: 3.1,
    impacto: 2,
    facilidadeCorrecao: 5,
    tempoEstimado: "10 min",
    tempoEstimadoMin: 10,
    recomendacao: "Adicione o cabeçalho X-Content-Type-Options: nosniff.",
  },
  "header-referrer-ausente": {
    refId: "header-referrer-ausente",
    titulo: "Referrer-Policy ausente",
    descricao:
      "Sem política de referenciador, URLs internas podem vazar para sites de terceiros via cabeçalho Referer.",
    categoria: "Headers",
    severidade: "BAIXA",
    cvss: 2.5,
    impacto: 2,
    facilidadeCorrecao: 5,
    tempoEstimado: "10 min",
    tempoEstimadoMin: 10,
    recomendacao:
      "Defina Referrer-Policy (ex.: strict-origin-when-cross-origin) para limitar o vazamento de URLs.",
  },
  "header-permissions-ausente": {
    refId: "header-permissions-ausente",
    titulo: "Permissions-Policy ausente",
    descricao:
      "Sem Permissions-Policy, recursos sensíveis do navegador (câmera, microfone, geolocalização) ficam sem restrição explícita.",
    categoria: "Headers",
    severidade: "BAIXA",
    cvss: 2.5,
    impacto: 2,
    facilidadeCorrecao: 4,
    tempoEstimado: "20 min",
    tempoEstimadoMin: 20,
    recomendacao:
      "Defina Permissions-Policy desabilitando APIs do navegador que a aplicação não utiliza.",
  },

  // ---- Cookies ----
  "cookie-sem-secure": {
    refId: "cookie-sem-secure",
    titulo: "Cookie sem atributo Secure",
    descricao:
      "O cookie pode ser transmitido por HTTP, expondo o valor a interceptação na rede.",
    categoria: "Cookies",
    severidade: "ALTA",
    cvss: 5.5,
    impacto: 4,
    facilidadeCorrecao: 5,
    tempoEstimado: "15 min",
    tempoEstimadoMin: 15,
    recomendacao: "Adicione o atributo Secure a todos os cookies sensíveis.",
  },
  "cookie-sem-httponly": {
    refId: "cookie-sem-httponly",
    titulo: "Cookie sem atributo HttpOnly",
    descricao:
      "O cookie é acessível via JavaScript, ampliando o impacto de um eventual XSS (roubo de sessão).",
    categoria: "Cookies",
    severidade: "MEDIA",
    cvss: 5.0,
    impacto: 3,
    facilidadeCorrecao: 5,
    tempoEstimado: "15 min",
    tempoEstimadoMin: 15,
    recomendacao:
      "Adicione o atributo HttpOnly a cookies que não precisam ser lidos por JavaScript.",
  },
  "cookie-sem-samesite": {
    refId: "cookie-sem-samesite",
    titulo: "Cookie sem atributo SameSite",
    descricao:
      "Sem SameSite, o cookie é enviado em requisições cross-site, facilitando ataques de CSRF.",
    categoria: "Cookies",
    severidade: "MEDIA",
    cvss: 4.3,
    impacto: 3,
    facilidadeCorrecao: 5,
    tempoEstimado: "15 min",
    tempoEstimadoMin: 15,
    recomendacao:
      "Defina SameSite=Lax (ou Strict) nos cookies de sessão para mitigar CSRF.",
  },

  // ---- Informações expostas ----
  "exposicao-server": {
    refId: "exposicao-server",
    titulo: "Cabeçalho Server expõe o servidor",
    descricao:
      "O cabeçalho Server revela o software/versão do servidor, ajudando atacantes a direcionar exploits conhecidos.",
    categoria: "Informações Expostas",
    severidade: "BAIXA",
    cvss: 2.0,
    impacto: 2,
    facilidadeCorrecao: 4,
    tempoEstimado: "20 min",
    tempoEstimadoMin: 20,
    recomendacao: "Remova ou genericize o cabeçalho Server na configuração do servidor/proxy.",
  },
  "exposicao-xpoweredby": {
    refId: "exposicao-xpoweredby",
    titulo: "Cabeçalho X-Powered-By exposto",
    descricao:
      "O cabeçalho X-Powered-By revela a tecnologia do backend, reduzindo o esforço de reconhecimento do atacante.",
    categoria: "Informações Expostas",
    severidade: "BAIXA",
    cvss: 2.0,
    impacto: 2,
    facilidadeCorrecao: 5,
    tempoEstimado: "10 min",
    tempoEstimadoMin: 10,
    recomendacao: "Desative o cabeçalho X-Powered-By na aplicação/servidor.",
  },
  "exposicao-comentarios": {
    refId: "exposicao-comentarios",
    titulo: "Comentários HTML em excesso",
    descricao:
      "Muitos comentários no HTML podem expor caminhos internos, credenciais ou lógica de negócio.",
    categoria: "Informações Expostas",
    severidade: "INFORMATIVA",
    cvss: 1.0,
    impacto: 1,
    facilidadeCorrecao: 3,
    tempoEstimado: "30 min",
    tempoEstimadoMin: 30,
    recomendacao:
      "Remova comentários sensíveis do HTML em produção (idealmente via processo de build/minificação).",
  },

  // ---- Performance (melhorias informativas) ----
  "perf-tempo-elevado": {
    refId: "perf-tempo-elevado",
    titulo: "Tempo de resposta elevado",
    descricao:
      "Respostas lentas degradam a experiência do usuário e podem indicar ausência de cache/otimização.",
    categoria: "Performance",
    severidade: "INFORMATIVA",
    cvss: 0,
    impacto: 1,
    facilidadeCorrecao: 2,
    tempoEstimado: "1-3h",
    tempoEstimadoMin: 120,
    recomendacao:
      "Investigue gargalos no backend, habilite cache e use CDN para reduzir o tempo de resposta.",
  },
  "perf-sem-compressao": {
    refId: "perf-sem-compressao",
    titulo: "Sem compressão de resposta",
    descricao:
      "A ausência de Gzip/Brotli aumenta o tráfego e o tempo de carregamento das páginas.",
    categoria: "Performance",
    severidade: "INFORMATIVA",
    cvss: 0,
    impacto: 1,
    facilidadeCorrecao: 4,
    tempoEstimado: "20 min",
    tempoEstimadoMin: 20,
    recomendacao: "Habilite compressão Gzip ou Brotli no servidor/proxy.",
  },
  "perf-sem-cache": {
    refId: "perf-sem-cache",
    titulo: "Sem política de cache",
    descricao:
      "Sem Cache-Control, recursos estáticos são rebaixados a cada visita, prejudicando a performance.",
    categoria: "Performance",
    severidade: "INFORMATIVA",
    cvss: 0,
    impacto: 1,
    facilidadeCorrecao: 4,
    tempoEstimado: "30 min",
    tempoEstimadoMin: 30,
    recomendacao:
      "Configure Cache-Control adequado para recursos estáticos (com versionamento de assets).",
  },
};

export const REFIDS_CONHECIDOS = Object.keys(CATALOGO);

let contadorInstancia = 0;

/**
 * Cria uma instância de Vulnerabilidade a partir do catálogo, permitindo
 * sobrescrever campos dinâmicos (ex.: severidade do certificado ou detalhe do cookie).
 */
export function criarVulnerabilidade(
  refId: string,
  overrides: Partial<Pick<Vulnerabilidade, "severidade" | "cvss" | "detalhe" | "descricao">> = {},
): Vulnerabilidade {
  const base = CATALOGO[refId];
  if (!base) {
    throw new Error(`Vulnerabilidade desconhecida no catálogo: ${refId}`);
  }
  contadorInstancia += 1;
  return {
    id: `${refId}-${contadorInstancia}`,
    refId: base.refId,
    titulo: base.titulo,
    descricao: overrides.descricao ?? base.descricao,
    categoria: base.categoria,
    severidade: overrides.severidade ?? base.severidade,
    cvss: overrides.cvss ?? base.cvss,
    impacto: base.impacto,
    facilidadeCorrecao: base.facilidadeCorrecao,
    tempoEstimado: base.tempoEstimado,
    tempoEstimadoMin: base.tempoEstimadoMin,
    recomendacao: base.recomendacao,
    detalhe: overrides.detalhe,
  };
}
