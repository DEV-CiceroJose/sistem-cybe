import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { Card } from "../components/Card";
import { Loader } from "../components/Loader";
import { Alert } from "../components/Alert";
import { ScoreGauge } from "../components/ScoreGauge";
import { CategoriaScoreList } from "../components/CategoriaScoreList";
import { StatusBadge } from "../components/StatusBadge";
import { PlanoDeAcao } from "../components/PlanoDeAcao";
import { ChecklistConformidade } from "../components/ChecklistConformidade";
import { RegistrosDns } from "../components/RegistrosDns";
import { ComparacaoAnterior } from "../components/ComparacaoAnterior";
import { buscarAuditoria, buscarRelatorioMarkdown, buscarRelatorioHtml, buscarComparacao, extrairMensagemErro } from "../services/api";
import type { Auditoria, ComparacaoResultado } from "../types";

function baixarArquivo(nome: string, conteudo: string, tipo: string) {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportarPdf(id: string) {
  const html = await buscarRelatorioHtml(id);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  iframe.srcdoc = html;
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  };
}

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs ${ok ? "border-ok/30 bg-ok/5 text-ok" : "border-danger/30 bg-danger/5 text-danger"}`}>
      <span>{ok ? "✓" : "✕"}</span>{label}
    </span>
  );
}

export function VisualizadorRelatorio() {
  const { id } = useParams<{ id: string }>();
  const [auditoria, setAuditoria] = useState<Auditoria | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarMarkdown, setMostrarMarkdown] = useState(false);
  const [comparacao, setComparacao] = useState<ComparacaoResultado | null>(null);

  useEffect(() => {
    if (!id) return;
    buscarAuditoria(id)
      .then(setAuditoria)
      .catch((e) => setErro(extrairMensagemErro(e)))
      .finally(() => setCarregando(false));
    buscarComparacao(id)
      .then(setComparacao)
      .catch(() => setComparacao(null));
  }, [id]);

  async function handleVerMarkdown() {
    if (!id) return;
    if (!markdown) {
      const conteudo = await buscarRelatorioMarkdown(id);
      setMarkdown(conteudo);
    }
    setMostrarMarkdown((v) => !v);
  }

  if (carregando) return (<><Navbar title="Relatório" /><main className="flex-1 p-6"><Loader texto="Carregando relatório" /></main></>);
  if (erro) return (<><Navbar title="Relatório" /><main className="flex-1 p-6"><Alert tipo="erro">{erro}</Alert></main></>);
  if (!auditoria) return null;

  const r = auditoria.resultado;

  return (
    <>
      <Navbar title="Relatório de Análise" subtitle={auditoria.url} />
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <StatusBadge status={auditoria.status} />
          {auditoria.relatorio && (
            <div className="flex items-center gap-3">
              <button onClick={() => exportarPdf(auditoria.id)} className="text-xs text-accent hover:underline">
                Exportar PDF
              </button>
              <button
                onClick={async () => baixarArquivo(`relatorio-${auditoria.id}.html`, await buscarRelatorioHtml(auditoria.id), "text/html")}
                className="text-xs text-accent hover:underline"
              >
                Exportar HTML
              </button>
              <button
                onClick={async () => baixarArquivo(`relatorio-${auditoria.id}.md`, await buscarRelatorioMarkdown(auditoria.id), "text/markdown")}
                className="text-xs text-accent hover:underline"
              >
                Exportar Markdown
              </button>
              <button onClick={handleVerMarkdown} className="text-xs text-slate-400 hover:text-accent hover:underline">
                {mostrarMarkdown ? "Ocultar prévia" : "Prévia Markdown"}
              </button>
            </div>
          )}
        </div>

        {auditoria.status === "ERRO" && <Alert tipo="erro">{auditoria.erro}</Alert>}

        {mostrarMarkdown && markdown && (
          <Card title="Relatório (Markdown)">
            <pre className="whitespace-pre-wrap text-xs text-slate-300 max-h-96 overflow-y-auto">{markdown}</pre>
          </Card>
        )}

        {r && auditoria.score !== null && auditoria.classificacao && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card className="flex items-center justify-center md:col-span-1">
              <ScoreGauge score={auditoria.score} classificacao={auditoria.classificacao} />
            </Card>
            <Card title="Score por categoria" className="md:col-span-2">
              <CategoriaScoreList categorias={r.scoreDetalhe} />
            </Card>
          </div>
        )}

        {r && r.vulnerabilidades && r.vulnerabilidades.length > 0 && (
          <PlanoDeAcao vulnerabilidades={r.vulnerabilidades} auditoriaId={auditoria.id} />
        )}

        {auditoria.conformidade && <ChecklistConformidade conformidade={auditoria.conformidade} />}

        {r && r.dns && <RegistrosDns dns={r.dns} />}

        {comparacao && <ComparacaoAnterior comparacao={comparacao} />}

        {r && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card title="HTTPS / TLS">
              <div className="space-y-2 text-sm">
                <Pill ok={r.https.habilitado} label={r.https.habilitado ? "HTTPS habilitado" : "HTTPS ausente"} />
                {r.https.versaoTLS && <p className="text-slate-400">Versão TLS: <span className="text-slate-200">{r.https.versaoTLS}</span></p>}
                {r.https.emissor && <p className="text-slate-400">Emissor: <span className="text-slate-200">{r.https.emissor}</span></p>}
                {r.https.diasParaExpirar !== undefined && (
                  <p className="text-slate-400">Expira em: <span className="text-slate-200">{r.https.diasParaExpirar} dia(s)</span></p>
                )}
                {r.https.erro && <Alert tipo="aviso">{r.https.erro}</Alert>}
              </div>
            </Card>

            <Card title="Cabeçalhos HTTP">
              <div className="flex flex-wrap gap-2">
                <Pill ok={!!r.headers.contentSecurityPolicy} label="CSP" />
                <Pill ok={!!r.headers.strictTransportSecurity} label="HSTS" />
                <Pill ok={!!r.headers.xFrameOptions} label="X-Frame-Options" />
                <Pill ok={!!r.headers.xContentTypeOptions} label="X-Content-Type-Options" />
                <Pill ok={!!r.headers.referrerPolicy} label="Referrer-Policy" />
                <Pill ok={!!r.headers.permissionsPolicy} label="Permissions-Policy" />
              </div>
            </Card>

            <Card title="Cookies">
              {r.cookies.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum cookie definido na resposta inicial.</p>
              ) : (
                <div className="space-y-2">
                  {r.cookies.map((c) => (
                    <div key={c.nome} className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-slate-300">{c.nome}</span>
                      <Pill ok={c.secure} label="Secure" />
                      <Pill ok={c.httpOnly} label="HttpOnly" />
                      <Pill ok={!!c.sameSite} label={c.sameSite ? `SameSite=${c.sameSite}` : "SameSite"} />
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Informações Expostas">
              <div className="space-y-1.5 text-sm text-slate-400">
                <p>Server: <span className="text-slate-200">{r.exposicao.server || "não exposto"}</span></p>
                <p>X-Powered-By: <span className="text-slate-200">{r.exposicao.xPoweredBy || "não exposto"}</span></p>
                <p>Comentários HTML: <span className="text-slate-200">{r.exposicao.comentariosHtmlEncontrados}</span></p>
                <p>robots.txt: <span className="text-slate-200">{r.exposicao.robotsTxtExiste ? "encontrado" : "não encontrado"}</span></p>
                <p>sitemap.xml: <span className="text-slate-200">{r.exposicao.sitemapXmlExiste ? "encontrado" : "não encontrado"}</span></p>
              </div>
            </Card>

            <Card title="Tecnologias Detectadas">
              <div className="space-y-1.5 text-sm text-slate-400">
                <p>Frameworks: <span className="text-slate-200">{r.tecnologias.frameworks.join(", ") || "—"}</span></p>
                <p>CMS: <span className="text-slate-200">{r.tecnologias.cms.join(", ") || "—"}</span></p>
                <p>Servidor: <span className="text-slate-200">{r.tecnologias.servidorWeb || "—"}</span></p>
                <p>CDN: <span className="text-slate-200">{r.tecnologias.cdn.join(", ") || "—"}</span></p>
                <p>Bibliotecas JS: <span className="text-slate-200">{r.tecnologias.bibliotecasJs.join(", ") || "—"}</span></p>
                <p>Linguagem: <span className="text-slate-200">{r.tecnologias.linguagem || "—"}</span></p>
              </div>
            </Card>

            <Card title="Performance">
              <div className="space-y-1.5 text-sm text-slate-400">
                <p>Tempo de resposta: <span className="text-slate-200">{r.performance.tempoRespostaMs}ms</span></p>
                <p>Compressão: <span className="text-slate-200">{r.performance.compressao || "nenhuma"}</span></p>
                <p>Cache: <span className="text-slate-200">{r.performance.cache || "nenhum"}</span></p>
                <p>Tamanho da página: <span className="text-slate-200">{(r.performance.tamanhoPaginaBytes / 1024).toFixed(1)} KB</span></p>
                <p>Requisições iniciais: <span className="text-slate-200">{r.performance.quantidadeRequisicoesIniciais}</span></p>
              </div>
            </Card>
          </div>
        )}

        {r && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card title="Problemas encontrados">
              <ul className="space-y-1.5 text-sm">
                {r.scoreDetalhe.flatMap((c) => c.problemas).length === 0 ? (
                  <li className="text-slate-500">Nenhum problema identificado.</li>
                ) : (
                  r.scoreDetalhe.flatMap((c) => c.problemas).map((p, i) => (
                    <li key={i} className="text-slate-300">⚠️ {p}</li>
                  ))
                )}
              </ul>
            </Card>
            <Card title="Boas práticas já implementadas">
              <ul className="space-y-1.5 text-sm">
                {r.scoreDetalhe.flatMap((c) => c.aprovados).map((a, i) => (
                  <li key={i} className="text-slate-300">✅ {a}</li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </main>
    </>
  );
}
