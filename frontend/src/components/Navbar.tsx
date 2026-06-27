interface NavbarProps {
  title: string;
  subtitle?: string;
}

export function Navbar({ title, subtitle }: NavbarProps) {
  return (
    <header className="flex items-center justify-between border-b border-line bg-bg-panel/40 px-6 py-4 backdrop-blur-sm">
      <div>
        <h1 className="font-display text-lg text-slate-100 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-75 pulse-ring" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
        </span>
        <span className="text-xs text-slate-500">Sistema ativo</span>
      </div>
    </header>
  );
}
