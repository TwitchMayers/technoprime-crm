import { NextResponse } from 'next/server';
import { backendUrl } from '@/lib/backend';

export async function POST(request: Request) {
  const cookie = request.headers.get('cookie') || '';
  const body = await request.json().catch(() => ({}));

  const res = await fetch(`${backendUrl}/shop/orders/link`, {
    method: 'POST',
    headers: {
      cookie,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const data = await res.json().catch(() => ({ success: false }));
  return NextResponse.json(data, { status: res.status });
}
