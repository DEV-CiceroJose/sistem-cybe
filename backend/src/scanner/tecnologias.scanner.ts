import type { TecnologiasInfo } from "../types/scanner.types";

interface Assinatura {
  nome: string;
  categoria: "framework" | "cms" | "cdn" | "js";
  testar: (html: string, headers: Headers) => boolean;
}

const ASSINATURAS: Assinatura[] = [
  { nome: "React", categoria: "framework", testar: (html) => /data-reactroot|react-dom|__REACT_DEVTOOLS/i.test(html) },
  { nome: "Next.js", categoria: "framework", testar: (html) => /__NEXT_DATA__|_next\/static/i.test(html) },
  { nome: "Vue.js", categoria: "framework", testar: (html) => /data-v-app|__vue__|vue\.js/i.test(html) },
  { nome: "Angular", categoria: "framework", testar: (html) => /ng-version|ng-app/i.test(html) },
  { nome: "WordPress", categoria: "cms", testar: (html) => /wp-content|wp-includes|wordpress/i.test(html) },
  { nome: "Joomla", categoria: "cms", testar: (html) => /joomla/i.test(html) },
  { nome: "Drupal", categoria: "cms", testar: (html) => /drupal/i.test(html) },
  { nome: "Shopify", categoria: "cms", testar: (html) => /cdn\.shopify\.com|shopify/i.test(html) },
  { nome: "Cloudflare", categoria: "cdn", testar: (_h, headers) => /cloudflare/i.test(headers.get("server") || "") || headers.has("cf-ray") },
  { nome: "Akamai", categoria: "cdn", testar: (_h, headers) => /akamai/i.test(headers.get("server") || "") || headers.has("x-akamai-transformed") },
  { nome: "Amazon CloudFront", categoria: "cdn", testar: (_h, headers) => /cloudfront/i.test(headers.get("via") || "") || headers.has("x-amz-cf-id") },
  { nome: "jQuery", categoria: "js", testar: (html) => /jquery/i.test(html) },
  { nome: "Bootstrap", categoria: "js", testar: (html) => /bootstrap/i.test(html) },
  { nome: "Tailwind CSS", categoria: "js", testar: (html) => /tailwind/i.test(html) },
];

export function detectarTecnologias(html: string, headers: Headers): TecnologiasInfo {
  const frameworks: string[] = [];
  const cms: string[] = [];
  const cdn: string[] = [];
  const bibliotecasJs: string[] = [];

  for (const assinatura of ASSINATURAS) {
    if (assinatura.testar(html, headers)) {
      if (assinatura.categoria === "framework") frameworks.push(assinatura.nome);
      if (assinatura.categoria === "cms") cms.push(assinatura.nome);
      if (assinatura.categoria === "cdn") cdn.push(assinatura.nome);
      if (assinatura.categoria === "js") bibliotecasJs.push(assinatura.nome);
    }
  }

  const servidorWeb = headers.get("server");

  let linguagem: string | null = null;
  const poweredBy = headers.get("x-powered-by") || "";
  if (/php/i.test(poweredBy)) linguagem = "PHP";
  else if (/asp\.net/i.test(poweredBy)) linguagem = "ASP.NET";
  else if (/express/i.test(poweredBy)) linguagem = "Node.js (Express)";

  return { frameworks, cms, servidorWeb, cdn, bibliotecasJs, linguagem };
}
