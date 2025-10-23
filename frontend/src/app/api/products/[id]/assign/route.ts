const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:4000';
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const r = await fetch(`${BACKEND}/orders/${params.id}/assign`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return new Response(JSON.stringify(data), { status: r.status, headers: { 'Content-Type': 'application/json' } });
}