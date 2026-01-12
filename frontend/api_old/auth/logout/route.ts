import { NextRequest, NextResponse } from 'next/server';
const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization');
    const res = await fetch(`${BACKEND}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': token || '' },
    });
    return NextResponse.json({}, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
