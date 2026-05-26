import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';
const API_PROXY_DEBUG =
  process.env.NODE_ENV !== 'production' && process.env.DEBUG_API_PROXY === 'true';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function clearAuthCookies(response: NextResponse) {
  response.cookies.set('token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  response.cookies.set('tp_session', '', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

function readTokenFromCookieHeader(cookieHeader: string) {
  if (!cookieHeader) return '';
  const part = cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith('token='));
  if (!part) return '';
  const raw = part.slice('token='.length);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function getErrorProperty(error: unknown, key: 'name' | 'message') {
  if (error && typeof error === 'object' && key in error) {
    const value = (error as Record<typeof key, unknown>)[key];
    return typeof value === 'string' ? value : '';
  }
  return '';
}

// Next route params are resolved before proxying.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, params, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, params, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, params, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, params, 'DELETE');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, params, 'PATCH');
}

async function handleRequest(
  request: NextRequest,
  params: Promise<{ path: string[] }>,
  method: string
) {
  try {
    const resolvedParams = await params;
    const path = resolvedParams.path.join('/');
    
    const token = request.headers.get('Authorization') || '';
    const cookie = request.headers.get('cookie') || '';
    const tokenFromCookie = readTokenFromCookieHeader(cookie);
    
    // Avoid duplicating `/api` when BACKEND_URL already includes it.
    const baseUrl = BACKEND_URL.endsWith('/') ? BACKEND_URL.slice(0, -1) : BACKEND_URL;
    const apiPath = baseUrl.endsWith('/api') ? `${baseUrl}/${path}` : `${baseUrl}/api/${path}`;
    
    const url = new URL(apiPath);
    
    // Копируем query параметры
    request.nextUrl.searchParams.forEach((value, key) => {
      url.searchParams.append(key, value);
    });

    const headers: Record<string, string> = {};

    if (token) {
      headers['Authorization'] = token;
    } else if (tokenFromCookie) {
      headers['Authorization'] = `Bearer ${tokenFromCookie}`;
    }
    if (cookie) {
      headers['Cookie'] = cookie;
    }

    const init: RequestInit = {
      method,
      headers,
      cache: 'no-store',
    };

    const timeoutMs =
      method === 'GET'
        ? path.startsWith('auth/me')
          ? 8000
          : path.startsWith('analytics/')
            ? 15000
            : 20000
        : 45000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    init.signal = controller.signal;

    if (
      method === 'POST' ||
      method === 'PUT' ||
      method === 'PATCH' ||
      method === 'DELETE'
    ) {
      const reqContentType = request.headers.get('content-type') || '';
      try {
        if (reqContentType.includes('application/json')) {
          const body = await request.json();
          init.body = JSON.stringify(body);
          headers['Content-Type'] = 'application/json';
        } else {
          const buffer = await request.arrayBuffer();
          if (buffer.byteLength > 0) {
            init.body = Buffer.from(buffer);
            if (reqContentType) {
              headers['Content-Type'] = reqContentType;
            }
          }
        }
      } catch {
        // Если нет тела, оставляем пустым
      }
    }

    if (API_PROXY_DEBUG) {
      console.log(`Proxy ${method}: ${url.toString()}`);
    }

    const response = await fetch(url.toString(), init).finally(() => {
      clearTimeout(timeoutId);
    });
    const shouldClearTokenCookie =
      path.startsWith('auth/me') && (response.status === 401 || response.status === 403);
    const contentType = response.headers.get('content-type') || '';
    const raw = await response.text();

    if (!raw) {
      const nextResponse = new NextResponse(null, {
        status: response.status,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      });
      if (shouldClearTokenCookie) {
        clearAuthCookies(nextResponse);
      }
      return nextResponse;
    }

    if (contentType.includes('application/json')) {
      try {
        const data = JSON.parse(raw);
        const nextResponse = NextResponse.json(data, {
          status: response.status,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          },
        });
        if (shouldClearTokenCookie) {
          clearAuthCookies(nextResponse);
        }
        return nextResponse;
      } catch {
        const payload = IS_PRODUCTION
          ? { error: 'Invalid JSON from backend' }
          : { error: 'Invalid JSON from backend', raw };
        const nextResponse = NextResponse.json(
          payload,
          {
            status: 502,
            headers: {
              'Cache-Control': 'no-store, max-age=0',
            },
          },
        );
        if (shouldClearTokenCookie) {
          clearAuthCookies(nextResponse);
        }
        return nextResponse;
      }
    }

    const nextResponse = new NextResponse(raw, {
      status: response.status,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Content-Type': contentType || 'text/plain; charset=utf-8',
      },
    });
    if (shouldClearTokenCookie) {
      clearAuthCookies(nextResponse);
    }
    return nextResponse;
  } catch (error: unknown) {
    console.error('API Proxy error:', error);
    if (getErrorProperty(error, 'name') === 'AbortError') {
      return NextResponse.json(
        { error: 'Gateway Timeout' },
        { status: 504 }
      );
    }
    const errorMessage = IS_PRODUCTION
      ? 'Internal server error'
      : getErrorProperty(error, 'message') || 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
