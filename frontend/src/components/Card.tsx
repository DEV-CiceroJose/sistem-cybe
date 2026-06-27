import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
}

export function Card({ children, className = "", title, action }: CardProps) {
  return (
    <div className={`rounded-lg border border-line bg-bg-panel/70 p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between">
          {title && <h3 className="font-display text-xs uppercase tracking-widest text-slate-400">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
