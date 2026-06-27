import type { ReactNode } from "react";

type Tipo = "erro" | "sucesso" | "aviso" | "info";

const estilos: Record<Tipo, string> = {
  erro: "border-danger/40 bg-danger/10 text-danger",
  sucesso: "border-ok/40 bg-ok/10 text-ok",
  aviso: "border-warn/40 bg-warn/10 text-warn",
  info: "border-accent/40 bg-accent/10 text-accent",
};

export function Alert({ tipo = "info", children }: { tipo?: Tipo; children: ReactNode }) {
  return (
    <div className={`rounded-md border px-4 py-3 text-sm ${estilos[tipo]}`}>
      {children}
    </div>
  );
}
