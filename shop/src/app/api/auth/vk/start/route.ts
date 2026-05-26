import { NextResponse } from 'next/server';
import { backendUrl } from '@/lib/backend';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('mode') === 'link' ? 'link' : 'login';
  const wantsJson = url.searchParams.get('format') === 'json';
  const forwardedHost = String(request.headers.get('x-forwarded-host') || '').split(',')[0].trim();
  const forwardedProto = String(request.headers.get('x-forwarded-proto') || '').split(',')[0].trim();
  const effectiveHost = (forwardedHost || url.hostname).toLowerCase();
  const effectiveOrigin = forwardedHost
    ? `${forwardedProto || 'https'}://${forwardedHost}`
    : url.origin;
  const configuredPublicUrl = String(
    process.env.SHOP_PUBLIC_URL || process.env.NEXT_PUBLIC_SHOP_PUBLIC_URL || '',
  ).trim();
  const isLocalhost = effectiveHost === 'localhost' || effectiveHost === '127.0.0.1';
  const baseUrl = isLocalhost
    ? (configuredPublicUrl ? configuredPublicUrl.replace(/\/+$/, '') : effectiveOrigin)
    : effectiveOrigin;
  const callbackUrl = `${baseUrl}/api/auth/vk/callback`;

  const startUrl = new URL(`${backendUrl}/shop/auth/vk/start`);
  startUrl.searchParams.set('mode', mode);
  startUrl.searchParams.set('redirectUri', callbackUrl);

  const res = await fetch(startUrl.toString(), {
    method: 'GET',
    cache: 'no-store',
  }).catch(() => null);

  if (!res?.ok) {
    if (wantsJson) {
      return NextResponse.json({ success: false, message: 'vk_start_failed' }, { status: 500 });
    }
    return NextResponse.redirect(new URL('/account?vk_status=vk_error', url.origin));
  }

  const data = await res.json().catch(() => null) as { authUrl?: string } | null;
  const authUrl = String(data?.authUrl || '').trim();
  if (!authUrl) {
    if (wantsJson) {
      return NextResponse.json({ success: false, message: 'vk_auth_url_missing' }, { status: 500 });
    }
    return NextResponse.redirect(new URL('/account?vk_status=vk_error', url.origin));
  }

  if (wantsJson) {
    const parsed = new URL(authUrl);
    const state = String(parsed.searchParams.get('state') || '').trim();
    const appId = String(parsed.searchParams.get('client_id') || '').trim();
    if (!state || !appId) {
      return NextResponse.json({ success: false, message: 'vk_state_missing' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      mode,
      state,
      appId,
      callbackUrl,
    });
  }

  return NextResponse.redirect(authUrl);
}
