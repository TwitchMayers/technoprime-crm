const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:4000';
export async function GET() {
  const r = await fetch(`${BACKEND}/orders/queue`);
  const data = await r.json().catch(() => ([]));
  return new Response(JSON.stringify(data), { status: r.status, headers: { 'Content-Type': 'application/json' } });
}