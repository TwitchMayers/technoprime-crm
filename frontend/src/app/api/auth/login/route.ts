import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';
const AUTH_COOKIE_MAX_AGE_SEC = 60 * 60 * 12;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    
    const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    }).finally(() => {
      clearTimeout(timeoutId);
    });

    const data = await response.json();
    const nextResponse = NextResponse.json(data, { status: response.status });

    if (response.ok && data?.access_token) {
      nextResponse.cookies.set('token', String(data.access_token), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: AUTH_COOKIE_MAX_AGE_SEC,
      });
      // Non-sensitive marker cookie for client bootstrap.
      // Safari/PWA can quickly decide whether to verify session on resume
      // without relying on stale localStorage tokens.
      nextResponse.cookies.set('tp_session', '1', {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: AUTH_COOKIE_MAX_AGE_SEC,
      });
    }

    return nextResponse;
  } catch (error) {
    console.error('Auth login error:', error);
    if ((error as any)?.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Gateway Timeout' },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
