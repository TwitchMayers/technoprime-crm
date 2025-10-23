const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:4000';

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const r = await fetch(`${BACKEND}/products/${id}`, { method: 'DELETE' });
  const data = await r.json().catch(()=> ({}));
  return new Response(JSON.stringify(data), { status: r.status, headers: { 'Content-Type': 'application/json' } });
}