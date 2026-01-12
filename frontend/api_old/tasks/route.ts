import { NextRequest, NextResponse } from 'next/server';
const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization');
    const res = await fetch(`${BACKEND}/api/tasks`, {
      headers: { 'Authorization': token || '' },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = req.headers.get('authorization');
    const res = await fetch(`${BACKEND}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token || '' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
