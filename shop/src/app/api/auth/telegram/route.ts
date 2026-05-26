import { NextResponse } from 'next/server';
import { backendUrl } from '@/lib/backend';

export async function POST(request: Request) {
  const body = await request.json();

  const res = await fetch(`${backendUrl}/shop/auth/telegram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const data = await res.json();
  const response = NextResponse.json(data, { status: res.status });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    response.headers.set('set-cookie', setCookie);
  }
  return response;
}
