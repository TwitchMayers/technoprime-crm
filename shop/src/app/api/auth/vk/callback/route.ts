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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = String(url.searchParams.get('code') || '').trim();
  const state = String(url.searchParams.get('state') || '').trim();

  if (!code || !state) {
    // In implicit flow VK returns token in URL hash, not in query string.
    return NextResponse.redirect(new URL('/auth/vk/callback', url.origin));
  }

  const cookie = request.headers.get('cookie') || '';

  const res = await fetch(`${backendUrl}/shop/auth/vk/callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie,
    },
    body: JSON.stringify({ code, state }),
    cache: 'no-store',
  }).catch(() => null);

  if (!res) {
    return NextResponse.redirect(new URL('/account?vk_status=vk_error', url.origin));
  }

  const data = await res.json().catch(() => null);
  const status = resolveStatus(data, res.status);

  const redirectUrl = new URL(`/account?vk_status=${encodeURIComponent(status)}`, url.origin);
  const response = NextResponse.redirect(redirectUrl);

  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    response.headers.set('set-cookie', setCookie);
  }

  return response;
}
