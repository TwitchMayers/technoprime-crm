const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:4000';

// В Next 16 params — это Promise, нужно await
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const r = await fetch(`${BACKEND}/notifications/${id}/read`, { method: 'PATCH' });
  const data = await r.json().catch(() => ({}));
  return new Response(JSON.stringify(data), {
    status: r.status,
    headers: { 'Content-Type': 'application/json' },
  });
}