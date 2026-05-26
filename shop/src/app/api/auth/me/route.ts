import { proxyBackendJson } from '@/lib/backend-proxy';

export async function GET(request: Request) {
  const cookie = request.headers.get('cookie') || '';
  return proxyBackendJson('/shop/auth/me', {
    method: 'GET',
    cookie,
    sourceRequest: request,
    fallbackBody: { user: null },
  });
}
