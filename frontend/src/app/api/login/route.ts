const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:4000';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const r = await fetch(`${BACKEND}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    }).catch((e) => {
      // залогируем на сервере Next причину
      console.error('Proxy fetch error:', e);
      throw e;
    });

    clearTimeout(timer);

    const data = await r.json().catch(() => ({}));
    return new Response(JSON.stringify(data), {
      status: r.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('Proxy /api/login failed:', e?.message || e);
    return new Response(JSON.stringify({ message: e?.message || 'Proxy error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}