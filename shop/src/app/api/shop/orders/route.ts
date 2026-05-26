import { NextResponse } from 'next/server';
import { backendUrl } from '@/lib/backend';

export async function GET(request: Request) {
  const cookie = request.headers.get('cookie') || '';

  const res = await fetch(`${backendUrl}/shop/orders/my`, {
    method: 'GET',
    headers: { cookie },
    cache: 'no-store',
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
