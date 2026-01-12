import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Публичные пути
  const publicPaths = ['/login', '/api/auth/login'];
  const isPublic = publicPaths.some(path => pathname.startsWith(path));
  
  // Если это публичный путь, пропускаем
  if (isPublic) {
    return NextResponse.next();
  }
  
  // Проверяем токен в cookie или localStorage (через заголовок)
  const token = request.cookies.get('token')?.value || 
                request.headers.get('Authorization')?.replace('Bearer ', '');
  
  // Если нет токена и это не публичный путь - редирект на /login
  if (!token) {
    console.log('🛠️ Middleware: No token found, redirecting to /login');
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
