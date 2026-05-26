import { proxyBackendJson } from '@/lib/backend-proxy';

export async function POST(request: Request) {
  const cookie = request.headers.get('cookie') || '';
  return proxyBackendJson('/shop/auth/logout-all', {
    method: 'POST',
    cookie,
    sourceRequest: request,
    fallbackBody: { success: false },
  });
}
