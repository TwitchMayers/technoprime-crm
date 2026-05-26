import { proxyBackendJson } from '@/lib/backend-proxy';

export async function POST(request: Request) {
  const body = await request.json();
  return proxyBackendJson('/shop/auth/phone/verify', {
    method: 'POST',
    body,
    sourceRequest: request,
    fallbackBody: {
      success: false,
      message: 'Не удалось подтвердить вход по номеру телефона.',
    },
  });
}
