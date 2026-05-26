import { proxyBackendJson } from '@/lib/backend-proxy';

export async function GET(request: Request) {
  return proxyBackendJson('/shop/account/instructions', {
    method: 'GET',
    sourceRequest: request,
    cookie: request.headers.get('cookie') || '',
    fallbackBody: {
      items: [],
      total: 0,
    },
  });
}
