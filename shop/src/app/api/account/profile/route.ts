import { NextResponse } from 'next/server';
import { backendUrl } from '@/lib/backend';

export async function PATCH(request: Request) {
  const body = await request.json();
  const cookie = request.headers.get('cookie') || '';

  const res = await fetch(`${backendUrl}/shop/account/profile`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      cookie,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const data = await res.json().catch(() => ({ success: false }));
  return NextResponse.json(data, { status: res.status });
}
