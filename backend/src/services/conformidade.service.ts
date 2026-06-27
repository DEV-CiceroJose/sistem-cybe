import type {
  ScanResultado,
  StatusConformidade,
  ItemConformidade,
  GrupoConformidade,
  ConformidadeResultado,
} from "../types/scanner.types";

const PESO: Record<StatusConformidade, number> = {
  CONFORME: 1,
  PARCIAL: 0.5,
  NAO_CONFORME: 0,
};

function montarGrupo(grupo: string, itens: ItemConformidade[]): GrupoConformidade {
  const conformes = itens.reduce((acc, i) => acc + PESO[i.status], 0);
  const total = itens.length;
  const percentual = total ? Math.round((conformes / total) * 100) : 100;
  return { grupo, itens, conformes, total, percentual };
}

function avaliarHttps(r: ScanResultado): GrupoConformidade {
  const ref = "A02:2021 – Cryptographic Failures";
  const itens: ItemConformidade[] = [];

  itens.push({
    id: "https-habilitado",
    titulo: "Conexão HTTPS habilitada",
    status: r.https.habilitado ? "CONFORME" : "NAO_CONFORME",
    referenciaOwasp: ref,
    explicacao: "Sem HTTPS, os dados trafegam em texto puro e podem ser interceptados.",
    recomendacao: "Instale um certificado TLS válido e force HTTPS.",
  });

  itens.push({
    id: "tls-confiavel",
    titulo: "Certificado de cadeia confiável",
    status: r.https.habilitado && r.https.cadeiaConfiavel ? "CONFORME" : "NAO_CONFORME",
    referenciaOwasp: ref,
    explicacao: "Um certificado não confiável gera alertas e quebra a confiança do usuário.",
    recomendacao: "Use um certificado emitido por uma Autoridade Certificadora reconhecida, com a cadeia completa.",
  });

  let statusValidade: StatusConformidade = "CONFORME";
  let detalhe: string | undefined;
  if (!r.https.habilitado) {
    statusValidade = "NAO_CONFORME";
  } else if (r.https.diasParaExpirar !== undefined) {
    if (r.https.diasParaExpirar < 0) {
      statusValidade = "NAO_CONFORME";
      detalhe = "Certificado expirado.";
    } else if (r.https.diasParaExpirar < 15) {
      statusValidade = "PARCIAL";
      detalhe = `Expira em ${r.https.diasParaExpirar} dia(s).`;
    }
  }
  itens.push({
    id: "cert-valido",
    titulo: "Certificado dentro da validade",
    status: statusValidade,
    referenciaOwasp: ref,
    explicacao: "Certificados expirados ou prestes a expirar interrompem o acesso ao site.",
    recomendacao: "Renove o certificado com antecedência e habilite a renovação automática.",
    detalhe,
  });

  return montarGrupo("HTTPS/TLS", itens);
}

function avaliarHeaders(r: ScanResultado): GrupoConformidade {
  const ref = "A05:2021 – Security Misconfiguration";
  const checks: [string, string, boolean, string][] = [
    ["header-csp", "Content-Security-Policy presente", !!r.headers.contentSecurityPolicy, "Mitiga XSS e injeção de conteúdo."],
    ["header-hsts", "Strict-Transport-Security presente", !!r.headers.strictTransportSecurity, "Força conexões HTTPS e evita downgrade."],
    ["header-xfo", "X-Frame-Options presente", !!r.headers.xFrameOptions, "Mitiga clickjacking."],
    ["header-xcto", "X-Content-Type-Options presente", !!r.headers.xContentTypeOptions, "Evita MIME sniffing."],
    ["header-referrer", "Referrer-Policy presente", !!r.headers.referrerPolicy, "Limita o vazamento de URLs internas."],
    ["header-permissions", "Permissions-Policy presente", !!r.headers.permissionsPolicy, "Restringe APIs sensíveis do navegador."],
  ];
  const itens: ItemConformidade[] = checks.map(([id, titulo, ok, explicacao]) => ({
    id,
    titulo,
    status: ok ? "CONFORME" : "NAO_CONFORME",
    referenciaOwasp: ref,
    explicacao,
    recomendacao: `Configure o cabeçalho correspondente a "${titulo}".`,
  }));
  return montarGrupo("Cabeçalhos HTTP", itens);
}

function statusCookies(
  cookies: ScanResultado["cookies"],
  pred: (c: ScanResultado["cookies"][number]) => boolean,
): StatusConformidade {
  if (cookies.length === 0) return "CONFORME";
  const ok = cookies.filter(pred).length;
  if (ok === cookies.length) return "CONFORME";
  if (ok === 0) return "NAO_CONFORME";
  return "PARCIAL";
}

function avaliarCookies(r: ScanResultado): GrupoConformidade {
  const ref = "A05:2021 – Security Misconfiguration";
  const itens: ItemConformidade[] = [
    {
      id: "cookie-secure",
      titulo: "Cookies com atributo Secure",
      status: statusCookies(r.cookies, (c) => c.secure),
      referenciaOwasp: ref,
      explicacao: "Sem Secure, o cookie pode ser enviado por HTTP e interceptado.",
      recomendacao: "Adicione Secure a todos os cookies.",
    },
    {
      id: "cookie-httponly",
      titulo: "Cookies com atributo HttpOnly",
      status: statusCookies(r.cookies, (c) => c.httpOnly),
      referenciaOwasp: ref,
      explicacao: "Sem HttpOnly, o cookie é acessível via JavaScript (risco em XSS).",
      recomendacao: "Adicione HttpOnly aos cookies que não precisam de acesso por JS.",
    },
    {
      id: "cookie-samesite",
      titulo: "Cookies com atributo SameSite",
      status: statusCookies(r.cookies, (c) => !!c.sameSite),
      referenciaOwasp: ref,
      explicacao: "Sem SameSite, o cookie é enviado cross-site (risco de CSRF).",
      recomendacao: "Defina SameSite=Lax ou Strict nos cookies de sessão.",
    },
  ];
  return montarGrupo("Cookies", itens);
}

function avaliarCors(r: ScanResultado): GrupoConformidade {
  const ref = "A05:2021 – Security Misconfiguration";
  const { accessControlAllowOrigin: acao, accessControlAllowCredentials: cred } = r.cors;

  const wildcardComCredenciais = acao === "*" && cred;
  let restritivo: StatusConformidade = "CONFORME";
  if (acao === "*") restritivo = "PARCIAL";

  const itens: ItemConformidade[] = [
    {
      id: "cors-sem-wildcard-credenciais",
      titulo: "CORS não combina wildcard com credenciais",
      status: wildcardComCredenciais ? "NAO_CONFORME" : "CONFORME",
      referenciaOwasp: ref,
      explicacao: "Access-Control-Allow-Origin: * com Allow-Credentials: true expõe dados autenticados a qualquer origem.",
      recomendacao: "Nunca use '*' junto de credenciais; especifique origens confiáveis.",
      detalhe: acao ? `Allow-Origin: ${acao}; Credentials: ${cred}` : undefined,
    },
    {
      id: "cors-restritivo",
      titulo: "Política de CORS restritiva",
      status: restritivo,
      referenciaOwasp: ref,
      explicacao: "Allow-Origin: '*' libera o recurso para qualquer origem.",
      recomendacao: "Defina origens específicas em Access-Control-Allow-Origin.",
      detalhe: acao ? `Allow-Origin: ${acao}` : "Sem cabeçalhos CORS.",
    },
  ];
  return montarGrupo("CORS", itens);
}

function avaliarExposicao(r: ScanResultado): GrupoConformidade {
  const ref = "A05:2021 – Security Misconfiguration";
  const itens: ItemConformidade[] = [
    {
      id: "exp-server",
      titulo: "Cabeçalho Server não expõe o software",
      status: r.exposicao.server ? "NAO_CONFORME" : "CONFORME",
      referenciaOwasp: ref,
      explicacao: "O cabeçalho Server pode revelar software/versão e facilitar ataques direcionados.",
      recomendacao: "Remova ou genericize o cabeçalho Server.",
      detalhe: r.exposicao.server || undefined,
    },
    {
      id: "exp-xpoweredby",
      titulo: "Sem cabeçalho X-Powered-By",
      status: r.exposicao.xPoweredBy ? "NAO_CONFORME" : "CONFORME",
      referenciaOwasp: ref,
      explicacao: "X-Powered-By revela a tecnologia do backend.",
      recomendacao: "Desative o cabeçalho X-Powered-By.",
      detalhe: r.exposicao.xPoweredBy || undefined,
    },
    {
      id: "exp-comentarios",
      titulo: "Comentários HTML sob controle",
      status: r.exposicao.comentariosHtmlEncontrados > 5 ? "PARCIAL" : "CONFORME",
      referenciaOwasp: ref,
      explicacao: "Muitos comentários HTML podem expor detalhes internos.",
      recomendacao: "Remova comentários sensíveis do HTML em produção.",
      detalhe: `${r.exposicao.comentariosHtmlEncontrados} comentário(s).`,
    },
  ];
  return montarGrupo("Exposição de Informação", itens);
}

/** Avalia a conformidade do site com o OWASP Top 10 (controles auto-avaliáveis). */
export function avaliarConformidade(resultado: ScanResultado): ConformidadeResultado {
  const grupos = [
    avaliarHttps(resultado),
    avaliarHeaders(resultado),
    avaliarCookies(resultado),
    avaliarCors(resultado),
    avaliarExposicao(resultado),
  ];
  const conformes = grupos.reduce((acc, g) => acc + g.conformes, 0);
  const total = grupos.reduce((acc, g) => acc + g.total, 0);
  const percentual = total ? Math.round((conformes / total) * 100) : 100;
  return { grupos, conformes, total, percentual };
}
