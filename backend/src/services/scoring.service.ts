import type { ScanResultado, ScoreCategoria, ScoreFinal, Vulnerabilidade } from "../types/scanner.types";
import { criarVulnerabilidade } from "./vulnerabilidades.catalog";
import { ordenarVulnerabilidades, resumirPrioridades } from "./priorizacao.service";

const PESOS = {
  https: 30,
  headers: 25,
  cookies: 15,
  exposicao: 15,
  performance: 15,
};

/** Cada avaliação devolve a pontuação da categoria e os achados estruturados. */
interface AvaliacaoCategoria {
  categoria: ScoreCategoria;
  vulnerabilidades: Vulnerabilidade[];
}

function avaliarHttps(r: ScanResultado): AvaliacaoCategoria {
  const max = PESOS.https;
  let pontos = 0;
  const problemas: string[] = [];
  const aprovados: string[] = [];
  const vulnerabilidades: Vulnerabilidade[] = [];
  const { https } = r;

  if (!https.habilitado) {
    problemas.push("O site não utiliza HTTPS.");
    vulnerabilidades.push(criarVulnerabilidade("https-ausente"));
    return {
      categoria: { categoria: "HTTPS", pontos: 0, pontosMaximos: max, problemas, aprovados },
      vulnerabilidades,
    };
  }
  pontos += max * 0.4;
  aprovados.push("Conexão HTTPS habilitada.");

  if (https.cadeiaConfiavel) {
    pontos += max * 0.3;
    aprovados.push("Certificado emitido por uma cadeia de confiança válida.");
  } else {
    problemas.push("O certificado TLS não é confiável ou não pôde ser validado.");
    vulnerabilidades.push(criarVulnerabilidade("tls-nao-confiavel"));
  }

  if (https.diasParaExpirar !== undefined) {
    if (https.diasParaExpirar < 0) {
      problemas.push("O certificado SSL/TLS está expirado.");
      vulnerabilidades.push(
        criarVulnerabilidade("cert-expirado", {
          detalhe: `Expirado há ${Math.abs(https.diasParaExpirar)} dia(s).`,
        }),
      );
    } else if (https.diasParaExpirar < 15) {
      problemas.push(`O certificado SSL/TLS expira em ${https.diasParaExpirar} dia(s).`);
      pontos += max * 0.15;
      vulnerabilidades.push(
        criarVulnerabilidade("cert-expirando", {
          detalhe: `Expira em ${https.diasParaExpirar} dia(s).`,
        }),
      );
    } else {
      pontos += max * 0.3;
      aprovados.push("Certificado SSL/TLS dentro do prazo de validade.");
    }
  }

  return {
    categoria: { categoria: "HTTPS", pontos: Math.round(pontos), pontosMaximos: max, problemas, aprovados },
    vulnerabilidades,
  };
}

function avaliarHeaders(r: ScanResultado): AvaliacaoCategoria {
  const max = PESOS.headers;
  const checks: [keyof ScanResultado["headers"], string, string][] = [
    ["contentSecurityPolicy", "Content-Security-Policy", "header-csp-ausente"],
    ["strictTransportSecurity", "Strict-Transport-Security", "header-hsts-ausente"],
    ["xFrameOptions", "X-Frame-Options", "header-xframe-ausente"],
    ["xContentTypeOptions", "X-Content-Type-Options", "header-xcto-ausente"],
    ["referrerPolicy", "Referrer-Policy", "header-referrer-ausente"],
    ["permissionsPolicy", "Permissions-Policy", "header-permissions-ausente"],
  ];

  const problemas: string[] = [];
  const aprovados: string[] = [];
  const vulnerabilidades: Vulnerabilidade[] = [];
  let presentes = 0;

  for (const [chave, nome, refId] of checks) {
    if (r.headers[chave]) {
      presentes++;
      aprovados.push(`Cabeçalho ${nome} presente.`);
    } else {
      problemas.push(`Cabeçalho ${nome} ausente.`);
      vulnerabilidades.push(criarVulnerabilidade(refId));
    }
  }

  const pontos = Math.round((presentes / checks.length) * max);
  return {
    categoria: { categoria: "Headers", pontos, pontosMaximos: max, problemas, aprovados },
    vulnerabilidades,
  };
}

function avaliarCookies(r: ScanResultado): AvaliacaoCategoria {
  const max = PESOS.cookies;
  const problemas: string[] = [];
  const aprovados: string[] = [];
  const vulnerabilidades: Vulnerabilidade[] = [];

  if (r.cookies.length === 0) {
    return {
      categoria: {
        categoria: "Cookies",
        pontos: max,
        pontosMaximos: max,
        problemas,
        aprovados: ["Nenhum cookie definido na resposta inicial."],
      },
      vulnerabilidades,
    };
  }

  let pontosPorCookie = 0;
  for (const cookie of r.cookies) {
    let local = 0;
    if (cookie.secure) {
      local++;
    } else {
      problemas.push(`Cookie "${cookie.nome}" sem o atributo Secure.`);
      vulnerabilidades.push(criarVulnerabilidade("cookie-sem-secure", { detalhe: `Cookie: ${cookie.nome}` }));
    }
    if (cookie.httpOnly) {
      local++;
    } else {
      problemas.push(`Cookie "${cookie.nome}" sem o atributo HttpOnly.`);
      vulnerabilidades.push(criarVulnerabilidade("cookie-sem-httponly", { detalhe: `Cookie: ${cookie.nome}` }));
    }
    if (cookie.sameSite) {
      local++;
    } else {
      problemas.push(`Cookie "${cookie.nome}" sem o atributo SameSite.`);
      vulnerabilidades.push(criarVulnerabilidade("cookie-sem-samesite", { detalhe: `Cookie: ${cookie.nome}` }));
    }
    pontosPorCookie += local / 3;
  }

  if (problemas.length === 0) aprovados.push("Todos os cookies seguem boas práticas de segurança.");

  const pontos = Math.round((pontosPorCookie / r.cookies.length) * max);
  return {
    categoria: { categoria: "Cookies", pontos, pontosMaximos: max, problemas, aprovados },
    vulnerabilidades,
  };
}

function avaliarExposicao(r: ScanResultado): AvaliacaoCategoria {
  const max = PESOS.exposicao;
  const problemas: string[] = [];
  const aprovados: string[] = [];
  const vulnerabilidades: Vulnerabilidade[] = [];
  let pontos = max;

  if (r.exposicao.server) {
    problemas.push(`Cabeçalho "Server" expõe informação do servidor: ${r.exposicao.server}.`);
    vulnerabilidades.push(criarVulnerabilidade("exposicao-server", { detalhe: r.exposicao.server }));
    pontos -= max * 0.25;
  } else {
    aprovados.push("Cabeçalho Server não expõe detalhes do servidor.");
  }

  if (r.exposicao.xPoweredBy) {
    problemas.push(`Cabeçalho "X-Powered-By" expõe a tecnologia utilizada: ${r.exposicao.xPoweredBy}.`);
    vulnerabilidades.push(criarVulnerabilidade("exposicao-xpoweredby", { detalhe: r.exposicao.xPoweredBy }));
    pontos -= max * 0.25;
  } else {
    aprovados.push("Cabeçalho X-Powered-By não está presente.");
  }

  if (r.exposicao.comentariosHtmlEncontrados > 5) {
    problemas.push(`Foram encontrados ${r.exposicao.comentariosHtmlEncontrados} comentários HTML, que podem expor detalhes internos.`);
    vulnerabilidades.push(
      criarVulnerabilidade("exposicao-comentarios", {
        detalhe: `${r.exposicao.comentariosHtmlEncontrados} comentários encontrados.`,
      }),
    );
    pontos -= max * 0.25;
  } else {
    aprovados.push("Poucos ou nenhum comentário HTML sensível encontrado.");
  }

  pontos = Math.max(0, Math.round(pontos));
  return {
    categoria: { categoria: "Informações Expostas", pontos, pontosMaximos: max, problemas, aprovados },
    vulnerabilidades,
  };
}

function avaliarPerformance(r: ScanResultado): AvaliacaoCategoria {
  const max = PESOS.performance;
  const problemas: string[] = [];
  const aprovados: string[] = [];
  const vulnerabilidades: Vulnerabilidade[] = [];
  let pontos = 0;

  if (r.performance.tempoRespostaMs < 800) {
    pontos += max * 0.4;
    aprovados.push("Tempo de resposta rápido.");
  } else if (r.performance.tempoRespostaMs < 2000) {
    pontos += max * 0.2;
    aprovados.push("Tempo de resposta aceitável.");
  } else {
    problemas.push(`Tempo de resposta elevado (${r.performance.tempoRespostaMs}ms).`);
    vulnerabilidades.push(
      criarVulnerabilidade("perf-tempo-elevado", { detalhe: `${r.performance.tempoRespostaMs}ms` }),
    );
  }

  if (r.performance.compressao) {
    pontos += max * 0.3;
    aprovados.push(`Compressão habilitada (${r.performance.compressao}).`);
  } else {
    problemas.push("Nenhuma compressão (Gzip/Brotli) detectada.");
    vulnerabilidades.push(criarVulnerabilidade("perf-sem-compressao"));
  }

  if (r.performance.cache) {
    pontos += max * 0.3;
    aprovados.push("Política de cache configurada.");
  } else {
    problemas.push("Nenhuma política de cache (Cache-Control) detectada.");
    vulnerabilidades.push(criarVulnerabilidade("perf-sem-cache"));
  }

  return {
    categoria: { categoria: "Performance", pontos: Math.round(pontos), pontosMaximos: max, problemas, aprovados },
    vulnerabilidades,
  };
}

function classificar(score: number): ScoreFinal["classificacao"] {
  if (score >= 90) return "EXCELENTE";
  if (score >= 70) return "BOA";
  if (score >= 40) return "ATENCAO";
  return "CRITICA";
}

export function calcularScore(resultado: ScanResultado): ScoreFinal {
  const avaliacoes = [
    avaliarHttps(resultado),
    avaliarHeaders(resultado),
    avaliarCookies(resultado),
    avaliarExposicao(resultado),
    avaliarPerformance(resultado),
  ];

  const categorias = avaliacoes.map((a) => a.categoria);
  const vulnerabilidades = ordenarVulnerabilidades(avaliacoes.flatMap((a) => a.vulnerabilidades));

  const totalPontos = categorias.reduce((acc, c) => acc + c.pontos, 0);
  const totalMaximo = categorias.reduce((acc, c) => acc + c.pontosMaximos, 0);
  const score = Math.round((totalPontos / totalMaximo) * 100);

  return {
    score,
    classificacao: classificar(score),
    categorias,
    vulnerabilidades,
    resumoPrioridades: resumirPrioridades(vulnerabilidades),
  };
}
