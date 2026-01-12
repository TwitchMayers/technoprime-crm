#!/bin/bash

echo "🎯 ФИНАЛЬНОЕ ВОССТАНОВЛЕНИЕ"
echo "========================="

# 1. Восстанавливаем API
echo ""
echo "📁 1. Восстанавливаем API роуты..."
if [ -d "frontend/api_old" ]; then
  rm -rf frontend/src/app/api 2>/dev/null
  cp -r frontend/api_old frontend/src/app/api
  echo "✅ API восстановлены из api_old"
else
  echo "❌ api_old не найден"
  exit 1
fi

# 2. Создаем универсальный прокси
echo "🔗 2. Создаем универсальный прокси..."
mkdir -p frontend/src/app/api/[...path]
cat > frontend/src/app/api/[...path]/route.ts << 'PROXY'
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(request, params, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(request, params, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(request, params, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(request, params, 'DELETE');
}

async function handleRequest(
  request: NextRequest,
  params: { path: string[] },
  method: string
) {
  try {
    const path = params.path.join('/');
    const token = request.headers.get('Authorization') || '';
    
    console.log('�� API Proxy:', { method, path });
    
    const url = new URL(\`\${BACKEND_URL}/api/\${path}\`);
    const searchParams = request.nextUrl.searchParams.toString();
    if (searchParams) {
      url.search = searchParams;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = token;
    }

    const init: RequestInit = {
      method,
      headers,
    };

    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      const body = await request.json();
      init.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), init);
    const data = await response.json();
    
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('API Proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
PROXY

# 3. Обновляем роут логина
echo "🔐 3. Обновляем роут логина..."
cat > frontend/src/app/api/auth/login/route.ts << 'LOGIN'
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('🔐 Login request for:', body.login);
    
    const response = await fetch(\`\${BACKEND_URL}/api/auth/login\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    console.log('📡 Login response status:', response.status);
    
    const data = await response.json();
    
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Auth login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
LOGIN

# 4. Обновляем окружение
echo "⚙️ 4. Обновляем окружение..."
echo "BACKEND_URL=http://localhost:4000" > frontend/.env.local
echo "NEXT_PUBLIC_API_URL=/api" >> frontend/.env.local

# 5. Отключаем middleware
echo "🛠️ 5. Отключаем middleware..."
cat > frontend/middleware.ts << 'MIDDLEWARE'
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
MIDDLEWARE

echo ""
echo "✅ ВСЁ ГОТОВО!"
echo ""
echo "🚀 ЗАПУСК ПРОЕКТА:"
echo "1. Запустите бэкенд:"
echo "   cd backend && npm run start:dev"
echo ""
echo "2. Запустите фронтенд:"
echo "   cd frontend && npm run dev"
echo ""
echo "3. Откройте в браузере:"
echo "   http://localhost:3000/login"
echo ""
echo "4. Введите:"
echo "   Логин: admin"
echo "   Пароль: admin123"
echo ""
echo "🔍 ДЛЯ ОТЛАДКИ:"
echo "  - Откройте DevTools (F12)"
echo "  - Перейдите на вкладку Network"
echo "  - Посмотрите запрос POST /api/auth/login"
echo "  - Должен быть статус 200 с токеном"
