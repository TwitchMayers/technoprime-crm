const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:4000';

export async function GET() {
  try {
    const r = await fetch(`${BACKEND}/employees/me`);
    if (!r.ok) throw new Error(`me ${r.status}`);
    const data = await r.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    // Fallback — чтобы UI не “падал” на dev
    const fallback = { id: 1, name: 'Admin', firstName: 'Admin', role: 'ADMIN', position: 'OWNER' };
    return new Response(JSON.stringify(fallback), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}