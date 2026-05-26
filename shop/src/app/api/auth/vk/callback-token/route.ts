import { NextResponse } from 'next/server';
import { backendUrl } from '@/lib/backend';

function resolveStatus(data: any, httpStatus: number) {
  if (httpStatus === 401 || httpStatus === 403) return 'vk_need_auth';
  if (httpStatus === 409) return 'vk_link_conflict';

  const status = String(data?.status || '').toUpperCase();
  if (status === 'LOGGED_IN') return 'vk_logged_in';
  if (status === 'LINKED') return 'vk_linked';
  if (status === 'ALREADY_LINKED') return 'vk_already_linked';
  if (status === 'LINK_REQUIRED') return 'vk_link_required';

  return 'vk_error';
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null) as {
    accessToken?: string;
    state?: string;
  } | null;

  const accessToken = String(payload?.accessToken || '').trim();
  const state = String(payload?.state || '').trim();
  if (!accessToken || !state) {
    return NextResponse.json({ vkStatus: 'vk_error' }, { status: 400 });
  }

  const cookie = request.headers.get('cookie') || '';

  const res = await fetch(`${backendUrl}/shop/auth/vk/callback-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie,
    },
    body: JSON.stringify({ accessToken, state }),
    cache: 'no-store',
  }).catch(() => null);

  if (!res) {
    return NextResponse.json({ vkStatus: 'vk_error' }, { status: 500 });
  }

  const data = await res.json().catch(() => null);
  const vkStatus = resolveStatus(data, res.status);
  const response = NextResponse.json({ vkStatus }, { status: 200 });

  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    response.headers.set('set-cookie', setCookie);
  }

  return response;
}
