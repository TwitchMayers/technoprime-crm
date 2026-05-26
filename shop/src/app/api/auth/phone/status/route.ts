import { proxyBackendJson } from '@/lib/backend-proxy';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const phone = String(url.searchParams.get('phone') || '').trim();
  const cookie = request.headers.get('cookie') || '';
  const path = phone ? `/shop/auth/phone/status?phone=${encodeURIComponent(phone)}` : '/shop/auth/phone/status';
  return proxyBackendJson(path, {
    method: 'GET',
    cookie,
    sourceRequest: request,
    fallbackBody: {
      success: false,
      verified: false,
    },
  });
}
