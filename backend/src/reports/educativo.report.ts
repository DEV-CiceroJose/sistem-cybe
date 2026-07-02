import { obterConteudoEducativo, type ConteudoEducativo } from "../services/educativo.catalog";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Resolve os refIds distintos (na ordem de chegada) em conteúdos educativos conhecidos. */
function resolverConteudos(refIds: string[]): ConteudoEducativo[] {
  const vistos = new Set<string>();
  const conteudos: ConteudoEducativo[] = [];
  for (const refId of refIds) {
    if (vistos.has(refId)) continue;
    vistos.add(refId);
    const c = obterConteudoEducativo(refId);
    if (c) conteudos.push(c);
  }
  return conteudos;
}

const VAZIO_MD = "_Nenhum achado para detalhar._";
const VAZIO_HTML = "<p class=\"muted\">Nenhum achado para detalhar.</p>";

/** Apêndice "Aprenda mais" em Markdown: explicação simples + referências por achado. */
export function gerarApendiceEducativoMd(refIds: string[]): string {
  const conteudos = resolverConteudos(refIds);
  if (conteudos.length === 0) return VAZIO_MD;

  return conteudos
    .map((c) => {
      const refs = c.referencias.map((r) => `- [${r.titulo}](${r.url})`).join("\n");
      return `### ${c.refId}\n\n${c.explicacaoSimples}\n\n**Referências:**\n\n${refs}`;
    })
    .join("\n\n");
}

/** Apêndice "Aprenda mais" em HTML: explicação simples + referências por achado. */
export function gerarApendiceEducativoHtml(refIds: string[]): string {
  const conteudos = resolverConteudos(refIds);
  if (conteudos.length === 0) return VAZIO_HTML;

  return conteudos
    .map((c) => {
      const refs = c.referencias
        .map((r) => `<li><a href="${esc(r.url)}">${esc(r.titulo)}</a></li>`)
        .join("");
      return `<article class="educativo-item">
      <h3>${esc(c.refId)}</h3>
      <p>${esc(c.explicacaoSimples)}</p>
      <p class="muted"><strong>Referências:</strong></p>
      <ul>${refs}</ul>
    </article>`;
    })
    .join("\n");
}
