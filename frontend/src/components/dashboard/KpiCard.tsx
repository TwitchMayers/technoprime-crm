'use client';

import { LucideIcon } from 'lucide-react';

export default function KpiCard({
  icon: Icon,
  title,
  value,
  subtitle,
  color = 'teal',
}: {
  icon: LucideIcon;
  title: string;
  value: string | number;
  subtitle?: string;
  color?: 'teal' | 'purple' | 'green' | 'orange';
}) {
  const colorMap = {
    teal: 'bg-teal-500/10 text-teal-400',
    purple: 'bg-purple-500/10 text-purple-400',
    green: 'bg-green-500/10 text-green-400',
    orange: 'bg-orange-500/10 text-orange-400',
  };

  return (
    <div className="glass p-4 hover:scale-[1.02] transition-transform">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-slate-400 mt-1">{title}</div>
      {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
    </div>
  );
}