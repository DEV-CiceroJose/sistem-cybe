import type { ReactNode } from "react";

interface ModalProps {
  aberto: boolean;
  onFechar: () => void;
  titulo?: string;
  children: ReactNode;
}

export function Modal({ aberto, onFechar, titulo, children }: ModalProps) {
  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onFechar}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-line bg-bg-raised p-6 shadow-glow"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          {titulo && <h2 className="font-display text-sm text-slate-100">{titulo}</h2>}
          <button onClick={onFechar} className="text-slate-500 hover:text-slate-200 transition-colors">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
