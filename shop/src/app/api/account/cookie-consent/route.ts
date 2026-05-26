import { NextResponse } from 'next/server';
import { backendUrl } from '@/lib/backend';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const cookie = request.headers.get('cookie') || '';

  const res = await fetch(`${backendUrl}/shop/account/cookie-consent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie,
    },
    body: JSON.stringify(body || {}),
    cache: 'no-store',
  });

  const data = await res.json().catch(() => ({ success: false }));
  return NextResponse.json(data, { status: res.status });
}
