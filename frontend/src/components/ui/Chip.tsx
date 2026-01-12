'use client';
import clsx from 'clsx';

export default function Chip({ children, color='ghost' }:{ children: React.ReactNode; color?: 'success'|'warning'|'danger'|'ghost' }) {
  const cls = clsx('badge', {
    'badge-success': color==='success',
    'badge-warning': color==='warning',
    'badge-danger':  color==='danger',
    'bg-white/10 text-white/80': color==='ghost',
  });
  return <span className={cls}>{children}</span>;
}