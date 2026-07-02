import { useEffect, useMemo, useState } from "react";
import type { ConteudoEducativo, Severidade, Vulnerabilidade } from "../types";
import { Card } from "./Card";
import { ProgressBar } from "./ProgressBar";
import { SeverityBadge } from "./SeverityBadge";
import { buscarEducativo } from "../services/api";
import { useModoEducativo, type ModoEducativo } from "../hooks/useModoEducativo";
import {
  SEVERIDADE_ESTILO,
  SEVERIDADE_LABEL,
  SEVERIDADE_ORDEM,
  formatarTempo,
  ordenarVulnerabilidades,
} from "../utils/severidade";

interface PlanoDeAcaoProps {
  vulnerabilidades: Vulnerabilidade[];
  auditoriaId: string;
}

/** Persistência simples (localStorage) dos achados marcados como corrigidos. */
function usarCorrigidos(auditoriaId: string) {
  const chave = `wsa:corrigidos:${auditoriaId}`;
  const [corrigidos, setCorrigidos] = useState<Set<string>>(() => {
    try {
      const bruto = localStorage.getItem(chave);
      return new Set<string>(bruto ? JSON.parse(bruto) : []);
    } catch {
      return new Set<string>();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(chave, JSON.stringify([...corrigidos]));
    } catch {
      /* ignora falhas de storage */
    }
  }, [chave, corrigidos]);

  function alternar(id: string) {
    setCorrigidos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  return { corrigidos, alternar };
}

/** Carrega o conteúdo educativo (por refId) uma vez; degrada em silêncio se falhar. */
function usarEducativo() {
  const [conteudos, setConteudos] = useState<Record<string, ConteudoEducativo>>({});
  useEffect(() => {
    let ativo = true;
    buscarEducativo()
      .then((e) => {
        if (ativo) setConteudos(e.conteudos);
      })
      .catch(() => {
        /* seção educativa não renderiza */
      });
    return () => {
      ativo = false;
    };
  }, []);
  return conteudos;
}

function nivel3(valor: number): 0 | 1 | 2 {
  if (valor <= 2) return 0;
  if (valor === 3) return 1;
  return 2;
}

const ESTRELAS_FACILIDADE = (n: number) => "●".repeat(n) + "○".repeat(5 - n);

function MatrizImpactoFacilidade({ vulns }: { vulns: Vulnerabilidade[] }) {
  // grade[impacto][facilidade] => quantidade, com índices 0=baixo,1=médio,2=alto
  const grade = useMemo(() => {
    const g = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    for (const v of vulns) g[nivel3(v.impacto)][nivel3(v.facilidadeCorrecao)] += 1;
    return g;
  }, [vulns]);

  const linhasImpacto = [2, 1, 0]; // alto no topo
  const colunasFacil = [0, 1, 2]; // difícil -> fácil
  const rotuloNivel = ["Baixo", "Médio", "Alto"];

  return (
    <div className="text-xs">
      <div className="mb-2 text-center text-[11px] uppercase tracking-widest text-slate-500">
        Facilidade de correção →
      </div>
      <div className="flex items-stretch gap-2">
        <div className="flex items-center">
          <span className="rotate-180 text-[11px] uppercase tracking-widest text-slate-500 [writing-mode:vertical-rl]">
            Impacto →
          </span>
        </div>
        <div className="flex-1">
          <div className="grid grid-cols-[auto_repeat(3,1fr)] gap-1">
            <div />
            {colunasFacil.map((c) => (
              <div key={c} className="pb-1 text-center text-[10px] text-slate-500">
                {rotuloNivel[c]}
              </div>
            ))}
            {linhasImpacto.map((imp) => (
              <FragmentoLinha key={imp} imp={imp} colunas={colunasFacil} grade={grade} rotulo={rotuloNivel[imp]} />
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            <span className="text-accent">▣</span> Quick wins: alto impacto + correção fácil — priorize estes.
          </p>
        </div>
      </div>
    </div>
  );
}

function FragmentoLinha({
  imp,
  colunas,
  grade,
  rotulo,
}: {
  imp: number;
  colunas: number[];
  grade: number[][];
  rotulo: string;
}) {
  return (
    <>
      <div className="flex items-center justify-end pr-1 text-[10px] text-slate-500">{rotulo}</div>
      {colunas.map((fac) => {
        const qtd = grade[imp][fac];
        const quickWin = imp === 2 && fac === 2;
        const base = quickWin
          ? "border-accent/50 bg-accent/10 text-accent"
          : qtd > 0
            ? "border-line bg-bg-raised text-slate-200"
            : "border-line/50 bg-bg-raised/30 text-slate-600";
        return (
          <div
            key={fac}
            className={`flex aspect-square min-h-[2.25rem] items-center justify-center rounded-md border font-display text-sm ${base}`}
            title={`Impacto ${rotulo.toLowerCase()} · facilidade ${["baixa", "média", "alta"][fac]}: ${qtd} achado(s)`}
          >
            {qtd > 0 ? qtd : ""}
          </div>
        );
      })}
    </>
  );
}

function BlocoEducativo({ conteudo, modo }: { conteudo: ConteudoEducativo; modo: ModoEducativo }) {
  const explicacao = modo === "avancado" ? conteudo.explicacaoTecnica : conteudo.explicacaoSimples;
  return (
    <div className="mt-2 space-y-2 rounded-md border border-accent/20 bg-accent/5 p-2.5 text-xs">
      <p className="text-slate-300">{explicacao}</p>
      <div>
        <p className="text-[11px] uppercase tracking-wide text-slate-500">Exemplo de ataque</p>
        <p className="mt-0.5 text-slate-400">{conteudo.exemploAtaque}</p>
      </div>
      {conteudo.referencias.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Aprenda mais</p>
          <ul className="mt-0.5 space-y-0.5">
            {conteudo.referencias.map((ref) => (
              <li key={ref.url}>
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-accent hover:underline"
                >
                  {ref.titulo}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function VulnLinha({
  v,
  corrigido,
  onAlternar,
  conteudo,
  modo,
}: {
  v: Vulnerabilidade;
  corrigido: boolean;
  onAlternar: (id: string) => void;
  conteudo?: ConteudoEducativo;
  modo: ModoEducativo;
}) {
  const [aberto, setAberto] = useState(false);
  const [educativoAberto, setEducativoAberto] = useState(false);
  const estilo = SEVERIDADE_ESTILO[v.severidade];

  return (
    <div className={`rounded-lg border border-line ${corrigido ? "bg-bg-raised/30 opacity-60" : "bg-bg-panel/40"}`}>
      <div className="flex items-start gap-3 p-3">
        <input
          type="checkbox"
          checked={corrigido}
          onChange={() => onAlternar(v.id)}
          className="mt-1 h-4 w-4 cursor-pointer accent-accent"
          aria-label={`Marcar "${v.titulo}" como corrigido`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-sm text-slate-200 ${corrigido ? "line-through" : ""}`}>{v.titulo}</span>
            <SeverityBadge severidade={v.severidade} />
            <span className="text-[11px] text-slate-500">{v.categoria}</span>
          </div>
          {v.detalhe && <p className="mt-0.5 text-xs text-slate-500">{v.detalhe}</p>}
          <div className="mt-1 flex flex-wrap gap-3">
            <button
              onClick={() => setAberto((a) => !a)}
              className="text-[11px] text-accent hover:underline"
            >
              {aberto ? "Ocultar detalhes" : "Ver detalhes e correção"}
            </button>
            {conteudo && (
              <button
                onClick={() => setEducativoAberto((a) => !a)}
                className="text-[11px] text-accent hover:underline"
              >
                {educativoAberto ? "Ocultar modo educativo" : "📚 Modo educativo"}
              </button>
            )}
          </div>
          {conteudo && educativoAberto && <BlocoEducativo conteudo={conteudo} modo={modo} />}
          {aberto && (
            <div className="mt-2 space-y-1.5 border-t border-line/60 pt-2 text-xs text-slate-400">
              <p>{v.descricao}</p>
              <p>
                <span className="text-slate-500">Recomendação:</span>{" "}
                <span className="text-slate-300">{v.recomendacao}</span>
              </p>
              <p className="text-slate-500">
                Impacto {v.impacto}/5 · Facilidade {ESTRELAS_FACILIDADE(v.facilidadeCorrecao)} · Esforço {v.tempoEstimado}
              </p>
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`font-display text-sm ${estilo.texto}`}>CVSS {v.cvss.toFixed(1)}</span>
          <span className="text-[11px] text-slate-500">{v.tempoEstimado}</span>
        </div>
      </div>
    </div>
  );
}

export function PlanoDeAcao({ vulnerabilidades, auditoriaId }: PlanoDeAcaoProps) {
  const { corrigidos, alternar } = usarCorrigidos(auditoriaId);
  const [filtro, setFiltro] = useState<Severidade | "TODAS">("TODAS");
  const [ocultarCorrigidos, setOcultarCorrigidos] = useState(false);
  const conteudosEducativos = usarEducativo();
  const { modo, setModo } = useModoEducativo();

  const ordenadas = useMemo(() => ordenarVulnerabilidades(vulnerabilidades), [vulnerabilidades]);

  const contagem = useMemo(() => {
    const c: Record<Severidade, number> = { CRITICA: 0, ALTA: 0, MEDIA: 0, BAIXA: 0, INFORMATIVA: 0 };
    let tempo = 0;
    for (const v of ordenadas) {
      c[v.severidade] += 1;
      tempo += v.tempoEstimadoMin;
    }
    return { c, tempo };
  }, [ordenadas]);

  const total = ordenadas.length;
  const totalCorrigidos = ordenadas.filter((v) => corrigidos.has(v.id)).length;
  const progresso = total === 0 ? 100 : Math.round((totalCorrigidos / total) * 100);

  const corrijaPrimeiro = ordenadas.filter((v) => !corrigidos.has(v.id)).slice(0, 3);

  const visiveis = ordenadas.filter((v) => {
    if (filtro !== "TODAS" && v.severidade !== filtro) return false;
    if (ocultarCorrigidos && corrigidos.has(v.id)) return false;
    return true;
  });

  if (total === 0) {
    return (
      <Card title="Plano de Ação">
        <p className="py-4 text-center text-sm text-slate-400">
          🎉 Nenhuma vulnerabilidade identificada. Nada a priorizar.
        </p>
      </Card>
    );
  }

  const severidadesPresentes = SEVERIDADE_ORDEM.filter((s) => contagem.c[s] > 0);

  return (
    <div className="space-y-4">
      {/* Dashboard de prioridades */}
      <Card title="Dashboard de Prioridades">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {SEVERIDADE_ORDEM.map((s) => (
            <div key={s} className={`rounded-lg border p-3 ${SEVERIDADE_ESTILO[s].badge}`}>
              <p className="font-display text-2xl">{contagem.c[s]}</p>
              <p className="text-[11px] opacity-80">{SEVERIDADE_LABEL[s]}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <ProgressBar
              progresso={progresso}
              label={`Progresso de correção — ${totalCorrigidos} de ${total} corrigido(s)`}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-line bg-bg-raised/40 px-3 py-2 text-sm">
            <span className="text-slate-400">Esforço total estimado</span>
            <span className="font-display text-slate-100">{formatarTempo(contagem.tempo)}</span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Corrija primeiro */}
        <Card title="🔧 Corrija primeiro">
          {corrijaPrimeiro.length === 0 ? (
            <p className="py-4 text-center text-sm text-ok">Tudo corrigido por aqui. ✅</p>
          ) : (
            <div className="space-y-2">
              {corrijaPrimeiro.map((v, i) => (
                <div key={v.id} className="flex items-start gap-3 rounded-lg border border-line bg-bg-raised/40 p-3">
                  <span className="font-display text-lg text-slate-600">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-slate-200">{v.titulo}</span>
                      <SeverityBadge severidade={v.severidade} />
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{v.recomendacao}</p>
                    <p className="mt-1 text-[11px] text-slate-500">CVSS {v.cvss.toFixed(1)} · ≈ {v.tempoEstimado}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Matriz impacto x facilidade */}
        <Card title="Matriz Impacto × Facilidade">
          <MatrizImpactoFacilidade vulns={ordenadas} />
        </Card>
      </div>

      {/* Lista priorizada com filtros */}
      <Card
        title="Lista Priorizada"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <SeletorModo modo={modo} onModo={setModo} />
            <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <input
                type="checkbox"
                checked={ocultarCorrigidos}
                onChange={(e) => setOcultarCorrigidos(e.target.checked)}
                className="h-3.5 w-3.5 accent-accent"
              />
              Ocultar corrigidos
            </label>
          </div>
        }
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <FiltroBotao ativo={filtro === "TODAS"} onClick={() => setFiltro("TODAS")}>
            Todas ({total})
          </FiltroBotao>
          {severidadesPresentes.map((s) => (
            <FiltroBotao key={s} ativo={filtro === s} onClick={() => setFiltro(s)}>
              {SEVERIDADE_LABEL[s]} ({contagem.c[s]})
            </FiltroBotao>
          ))}
        </div>
        <div className="space-y-2">
          {visiveis.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">Nenhum achado neste filtro.</p>
          ) : (
            visiveis.map((v) => (
              <VulnLinha
                key={v.id}
                v={v}
                corrigido={corrigidos.has(v.id)}
                onAlternar={alternar}
                conteudo={conteudosEducativos[v.refId]}
                modo={modo}
              />
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

function SeletorModo({ modo, onModo }: { modo: ModoEducativo; onModo: (m: ModoEducativo) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-line bg-bg-raised/40 p-0.5 text-[11px]">
      {(["iniciante", "avancado"] as const).map((m) => (
        <button
          key={m}
          onClick={() => onModo(m)}
          className={`rounded-full px-2.5 py-0.5 transition-colors ${
            modo === m ? "bg-accent/15 text-accent" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {m === "iniciante" ? "Iniciante" : "Avançado"}
        </button>
      ))}
    </div>
  );
}

function FiltroBotao({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
        ativo
          ? "border-accent/40 bg-accent/10 text-accent"
          : "border-line bg-bg-raised/40 text-slate-400 hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}
