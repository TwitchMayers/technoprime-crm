import { NextResponse } from 'next/server';
import { backendUrl } from '@/lib/backend';

export async function POST(request: Request) {
  const body = await request.json();
  const cookie = request.headers.get('cookie') || '';

  const res = await fetch(`${backendUrl}/shop/orders/lead`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const data = await res.json().catch(() => ({ success: false }));
  const response = NextResponse.json(data, { status: res.status });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    response.headers.set('set-cookie', setCookie);
  }
  return response;
}
