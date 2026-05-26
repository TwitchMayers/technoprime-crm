import { NextResponse } from 'next/server';
import { backendUrl } from '@/lib/backend';

export async function POST(request: Request) {
  const cookie = request.headers.get('cookie') || '';

  const res = await fetch(`${backendUrl}/shop/account/linked/vk/unlink`, {
    method: 'POST',
    headers: { cookie },
    cache: 'no-store',
  });

  const data = await res.json().catch(() => ({ success: false }));
  return NextResponse.json(data, { status: res.status });
}
