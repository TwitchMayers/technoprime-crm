import { NextResponse } from 'next/server';
import { backendUrl, shopApiKey } from '@/lib/backend';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const cookie = request.headers.get('cookie') || '';

  const res = await fetch(`${backendUrl}/shop/products/views`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie,
      ...(shopApiKey ? { 'x-shop-key': shopApiKey } : {}),
    },
    body: JSON.stringify(body || {}),
    cache: 'no-store',
  });

  const data = await res.json().catch(() => ({ success: false }));
  return NextResponse.json(data, { status: res.status });
}
