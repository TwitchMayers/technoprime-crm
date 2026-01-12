import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

// ✅ ФИКС: Исправляем params как Promise
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

// ✅ ФИКС: Исправляем handleRequest
async function handleRequest(
  request: NextRequest,
  params: Promise<{ path: string[] }>,
  method: string
) {
  try {
    // ✅ ОБЯЗАТЕЛЬНО: await перед params
    const resolvedParams = await params;
    const path = resolvedParams.path.join('/');
    
    const token = request.headers.get('Authorization') || '';
    
    // ✅ КРИТИЧЕСКИЙ ФИКС: Убираем дублирование /api
    // Если BACKEND_URL уже содержит /api в конце, не добавляем его снова
    const baseUrl = BACKEND_URL.endsWith('/') ? BACKEND_URL.slice(0, -1) : BACKEND_URL;
    const apiPath = baseUrl.endsWith('/api') ? `${baseUrl}/${path}` : `${baseUrl}/api/${path}`;
    
    const url = new URL(apiPath);
    
    // Копируем query параметры
    request.nextUrl.searchParams.forEach((value, key) => {
      url.searchParams.append(key, value);
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = token;
    }

    const init: RequestInit = {
      method,
      headers,
      cache: 'no-store',
    };

    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      try {
        const body = await request.json();
        init.body = JSON.stringify(body);
      } catch {
        // Если нет тела, оставляем пустым
      }
    }

    console.log(`🔄 Proxy ${method}: ${url.toString()}`);

    const response = await fetch(url.toString(), init);
    const data = await response.json();
    
    return NextResponse.json(data, { 
      status: response.status,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    });
  } catch (error: any) {
    console.error('API Proxy error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}