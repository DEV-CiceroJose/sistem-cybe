export function Loader({ texto = "Analisando" }: { texto?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10">
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 rounded-full border-2 border-line" />
        <div className="absolute inset-0 rounded-full border-2 border-t-accent border-transparent animate-spin" />
      </div>
      <p className="text-sm text-slate-400 font-display tracking-wide">{texto}...</p>
    </div>
  );
}
