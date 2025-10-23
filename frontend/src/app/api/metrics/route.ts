const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:4000';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const period = url.searchParams.get('period') || 'today';
    const r = await fetch(`${BACKEND}/employees/me/metrics?period=${period}`);
    if (!r.ok) throw new Error(`metrics ${r.status}`);
    const data = await r.json();
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch {
    const zero = { period: 'today', closedCount: 0, revenue: 0, profit: 0, activeCount: 0, queueCount: 0 };
    return new Response(JSON.stringify(zero), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
}