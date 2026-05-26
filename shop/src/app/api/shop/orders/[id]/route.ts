import { NextResponse } from 'next/server';
import { backendUrl } from '@/lib/backend';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const cookie = request.headers.get('cookie') || '';

  const res = await fetch(`${backendUrl}/shop/orders/my/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: { cookie },
    cache: 'no-store',
  });

  const data = await res.json().catch(() => ({ success: false }));
  return NextResponse.json(data, { status: res.status });
}
