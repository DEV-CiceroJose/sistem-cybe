interface ProgressBarProps {
  progresso: number;
  label?: string;
}

export function ProgressBar({ progresso, label }: ProgressBarProps) {
  const valor = Math.min(100, Math.max(0, progresso));
  return (
    <div>
      {label && <p className="mb-1.5 text-xs text-slate-400">{label}</p>}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-raised">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent-dim to-accent transition-all duration-300"
          style={{ width: `${valor}%` }}
        />
      </div>
    </div>
  );
}
