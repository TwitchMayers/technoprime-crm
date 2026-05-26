'use client';

import { ReactNode } from 'react';

export default function MobilePageHeader({
  title,
  subtitle,
  action,
  sticky = true,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  sticky?: boolean;
}) {
  const rootClass = sticky ? 'md:hidden sticky top-0 z-30' : 'md:hidden';

  return (
    <div className={rootClass}>
      <div className="rounded-2xl border border-slate-700/70 bg-slate-950/88 px-2.5 py-1.5 shadow-[0_14px_32px_rgba(2,6,23,0.32)] backdrop-blur-xl">
        <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-2">
          <div className="h-10 w-10" aria-hidden="true" />
          <div className="min-w-0 text-center">
            <div className="truncate text-[13px] font-semibold text-white">{title}</div>
            {subtitle ? (
              <div className="mt-0.5 line-clamp-1 text-[10px] leading-4 text-slate-400">
                {subtitle}
              </div>
            ) : null}
          </div>
          <div className="flex h-10 items-center justify-end">
            {action ?? <div className="h-10 w-10" aria-hidden="true" />}
          </div>
        </div>
      </div>
    </div>
  );
}
