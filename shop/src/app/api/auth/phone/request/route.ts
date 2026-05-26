import { proxyBackendJson } from '@/lib/backend-proxy';

export async function POST(request: Request) {
  const body = await request.json();
  return proxyBackendJson('/shop/auth/phone/request', {
    method: 'POST',
    body,
    sourceRequest: request,
    fallbackBody: {
      success: false,
      message: 'Не удалось запросить вход по номеру телефона.',
    },
  });
}
