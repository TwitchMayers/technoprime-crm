import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Игнорируем статические файлы и API маршруты (кроме auth)
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/api/auth') || // Auth API публичные
    pathname === '/' // Главная страница
  ) {
    return NextResponse.next();
  }

  // 2. Публичные пути (не требуют аутентификации)
  const publicPaths = ['/login', '/api/auth', '/_next', '/favicon.ico'];
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
  
  if (isPublicPath) {
    return NextResponse.next();
  }

  // 3. Проверяем токен (из cookie или localStorage через заголовок)
  const token = request.cookies.get('token')?.value ||
                request.headers.get('Authorization')?.replace('Bearer ', '');

  console.log(`🛡️ Middleware: ${pathname} - token: ${token ? 'found' : 'not found'}`);

  // 4. Если нет токена и это не публичный путь - редирект на логин
  if (!token) {
    console.log(`🔒 Redirecting ${pathname} to /login (no token)`);
    
    // Создаем URL для редиректа
    const loginUrl = new URL('/login', request.url);
    
    // Добавляем параметр для возврата после логина
    if (pathname !== '/login' && !pathname.startsWith('/api/')) {
      loginUrl.searchParams.set('redirect', pathname);
    }
    
    return NextResponse.redirect(loginUrl);
  }

  // 5. Если есть токен и пользователь на странице логина - редирект на дашборд
  if (token && pathname === '/login') {
    console.log('🎯 User already authenticated, redirecting to /dashboard');
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 6. Все проверки пройдены
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
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};