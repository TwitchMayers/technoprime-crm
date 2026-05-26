'use client';

import { useEffect, useState } from 'react';

function formatRemaining(totalSeconds: number) {
  const value = Math.max(0, Math.floor(Number(totalSeconds || 0)));
  const days = Math.floor(value / 86400);
  const hours = Math.floor((value % 86400) / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const seconds = value % 60;

  if (days > 0) return `${days}д ${hours}ч ${minutes}м`;
  if (hours > 0) return `${hours}ч ${minutes}м`;
  if (minutes > 0) return `${minutes}м ${seconds}с`;
  return `${seconds}с`;
}

export function PromoCountdown({
  initialSeconds,
  prefix = 'До конца:',
  className,
}: {
  initialSeconds?: number | null;
  prefix?: string;
  className?: string;
}) {
  const [remaining, setRemaining] = useState(Math.max(0, Math.floor(Number(initialSeconds || 0))));

  useEffect(() => {
    setRemaining(Math.max(0, Math.floor(Number(initialSeconds || 0))));
  }, [initialSeconds]);

  useEffect(() => {
    if (remaining <= 0) return undefined;
    const timerId = window.setInterval(() => {
      setRemaining((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [remaining]);

  if (remaining <= 0) return null;

  return (
    <span className={className}>
      {prefix} {formatRemaining(remaining)}
    </span>
  );
}
