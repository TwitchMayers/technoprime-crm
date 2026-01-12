import { NextRequest, NextResponse } from 'next/server';
const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization');
    const searchParams = req.nextUrl.searchParams;
    const qs = new URLSearchParams(searchParams).toString();
    const res = await fetch(`${BACKEND}/api/analytics/overview?${qs}`, {
      headers: { 'Authorization': token || '' },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
