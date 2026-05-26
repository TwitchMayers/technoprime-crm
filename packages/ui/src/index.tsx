import * as React from 'react';
import { cn } from '@technoprime/lib';

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-full font-semibold whitespace-nowrap transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80',
        variant === 'primary' && 'bg-gradient-to-r from-cyan-500 via-blue-500 to-sky-600 text-white shadow-lg shadow-cyan-500/30 hover:brightness-110',
        variant === 'secondary' && 'bg-white/10 text-white hover:bg-white/20 border border-white/20',
        variant === 'ghost' && 'text-slate-200 hover:text-white',
        size === 'sm' && 'min-h-9 px-3.5 py-2 text-sm sm:px-4',
        size === 'md' && 'min-h-10 px-4 py-2.5 text-sm sm:px-5 sm:py-3',
        size === 'lg' && 'min-h-11 px-5 py-2.5 text-base sm:px-6 sm:py-3',
        className
      )}
      {...props}
    />
  );
}

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-100',
        className
      )}
      {...props}
    />
  );
}

export function GlassCard({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_25px_70px_-40px_rgba(30,130,255,0.6)]',
        className
      )}
      {...props}
    />
  );
}

export function SectionTitle({
  eyebrow,
  title,
  subtitle,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={cn('space-y-3', className)}>
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-200/80">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-2xl font-semibold leading-tight text-white sm:text-3xl md:text-4xl">{title}</h2>
      {subtitle ? <p className="max-w-2xl text-sm text-slate-300 md:text-base">{subtitle}</p> : null}
    </div>
  );
}
