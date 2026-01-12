'use client';
import { ReactNode } from 'react';
import clsx from 'clsx';

export default function GlassCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('glass p-3', className)}>{children}</div>;
}