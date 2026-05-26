import { NextRequest, NextResponse } from 'next/server';

function resolveOrigin(request: NextRequest) {
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const proto = forwardedProto || request.nextUrl.protocol.replace(':', '') || 'https';

  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const hostHeader = request.headers.get('host')?.split(',')[0]?.trim();
  const rawHost = forwardedHost || hostHeader || request.nextUrl.host || '';
  const host = rawHost.toLowerCase();

  const isLocalHost = host === 'localhost'
    || host.startsWith('localhost:')
    || host === '127.0.0.1'
    || host.startsWith('127.0.0.1:')
    || host === '[::1]'
    || host.startsWith('[::1]:');

  const allowedHosts = new Set([
    'crm.technoprimestore.ru',
    'technoprimestore.ru',
    'www.technoprimestore.ru',
  ]);
  const normalizedHost = host.replace(/:\d+$/, '');
  const safeHost = (!rawHost || isLocalHost || !allowedHosts.has(normalizedHost))
    ? 'crm.technoprimestore.ru'
    : rawHost;
  return `${proto}://${safeHost}`;
}

function redirectInsideCrm(request: NextRequest, pathname: string, searchParams?: URLSearchParams) {
  const target = new URL(pathname, resolveOrigin(request));
  if (searchParams) {
    target.search = searchParams.toString();
  }
  return NextResponse.redirect(target);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get('token')?.value ||
                request.headers.get('Authorization')?.replace('Bearer ', '');

  if (pathname === '/') {
    const targetPath = token ? '/profile' : '/login';
    const targetParams = new URLSearchParams();
    if (!token) {
      targetParams.set('redirect', '/profile');
    }
    return redirectInsideCrm(request, targetPath, targetParams);
  }

  // 1. Игнорируем статические файлы и auth API
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/icon') ||
    pathname.startsWith('/apple-icon') ||
    pathname.startsWith('/manifest.webmanifest') ||
    pathname.startsWith('/sw.js') ||
    pathname.startsWith('/api/auth')
  ) {
    return NextResponse.next();
  }

  // 2. Публичные пути всегда должны быть доступны.
  // Не редиректим /login по наличию cookie: валидность токена проверяется на клиенте,
  // иначе протухший cookie снова загонит пользователя в цикл /login -> /dashboard.
  const publicPaths = [
    '/login',
    '/logout',
    '/api/auth',
    '/_next',
    '/favicon.ico',
    '/icon',
    '/apple-icon',
    '/manifest.webmanifest',
    '/sw.js',
  ];
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
  
  if (isPublicPath) {
    return NextResponse.next();
  }

  // 3. Если нет токена и это не публичный путь - редирект на логин
  if (!token) {
    const loginParams = new URLSearchParams();

    if (pathname !== '/login' && !pathname.startsWith('/api/')) {
      loginParams.set('redirect', pathname);
    }
    
    return redirectInsideCrm(request, '/login', loginParams);
  }

  // 4. Все проверки пройдены
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|sw.js|public).*)',
  ],
};
