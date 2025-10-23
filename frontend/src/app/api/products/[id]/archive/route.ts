const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:4000';
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const r = await fetch(`${BACKEND}/products/${params.id}/archive`, { method: 'PATCH' });
  const data = await r.json().catch(() => ({}));
  return new Response(JSON.stringify(data), { status: r.status, headers: { 'Content-Type': 'application/json' } });
}