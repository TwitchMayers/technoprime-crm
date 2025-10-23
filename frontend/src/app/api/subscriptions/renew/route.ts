const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:4000';
export async function POST(req: Request) {
  const body = await req.json();
  const r = await fetch(`${BACKEND}/subscriptions/renew`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await r.json().catch(()=> ({}));
  return new Response(JSON.stringify(data), { status: r.status, headers: { 'Content-Type': 'application/json' } });
}