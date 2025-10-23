const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:4000';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const r = await fetch(`${BACKEND}/orders/${params.id}/comments`);
  const data = await r.json().catch(() => ([]));
  return new Response(JSON.stringify(data), { status: r.status, headers: { 'Content-Type': 'application/json' } });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const r = await fetch(`${BACKEND}/orders/${params.id}/comments`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return new Response(JSON.stringify(data), { status: r.status, headers: { 'Content-Type': 'application/json' } });
}