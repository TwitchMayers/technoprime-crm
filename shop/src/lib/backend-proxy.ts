import { NextResponse } from 'next/server';
import { backendUrl } from '@/lib/backend';

type ProxyOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  cookie?: string;
  headers?: Record<string, string>;
  sourceRequest?: Request;
  timeoutMs?: number;
  fallbackBody?: unknown;
};

function withBackendPath(path: string) {
  return `${backendUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function proxyBackendJson(path: string, options: ProxyOptions = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? 12000);

  try {
    const headers: Record<string, string> = {
      ...(options.headers || {}),
    };

    const sourceHeaders = options.sourceRequest?.headers;
    if (sourceHeaders) {
      const forwardedFor = sourceHeaders.get('x-forwarded-for') || sourceHeaders.get('x-real-ip');
      const realIp = sourceHeaders.get('x-real-ip');
      const forwardedProto = sourceHeaders.get('x-forwarded-proto');
      const userAgent = sourceHeaders.get('user-agent');

      if (forwardedFor && !headers['x-forwarded-for']) {
        headers['x-forwarded-for'] = forwardedFor;
      }
      if (realIp && !headers['x-real-ip']) {
        headers['x-real-ip'] = realIp;
      }
      if (forwardedProto && !headers['x-forwarded-proto']) {
        headers['x-forwarded-proto'] = forwardedProto;
      }
      if (userAgent && !headers['user-agent']) {
        headers['user-agent'] = userAgent;
      }
    }

    if (options.cookie) {
      headers.cookie = options.cookie;
    }

    let body: string | undefined;
    if (options.body !== undefined) {
      body = JSON.stringify(options.body);
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
    }

    const response = await fetch(withBackendPath(path), {
      method: options.method || 'GET',
      headers,
      body,
      cache: 'no-store',
      signal: controller.signal,
    });

    const raw = await response.text();
    const payload = raw
      ? (() => {
          try {
            return JSON.parse(raw);
          } catch {
            return options.fallbackBody ?? { success: false, message: raw.slice(0, 500) };
          }
        })()
      : (options.fallbackBody ?? { success: response.ok });

    const nextResponse = NextResponse.json(payload, { status: response.status });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      nextResponse.headers.set('set-cookie', setCookie);
    }
    return nextResponse;
  } catch (error: any) {
    const status = error?.name === 'AbortError' ? 504 : 503;
    const message =
      status === 504
        ? 'Сервис авторизации временно отвечает слишком долго. Попробуйте ещё раз.'
        : 'Сервис авторизации временно недоступен. Попробуйте ещё раз.';

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
