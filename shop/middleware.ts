import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const shopApiBase = String(process.env.SHOP_API_BASE || '').replace(/\/$/, '');
const shopApiKey = String(process.env.SHOP_API_KEY || '').trim();

export async function middleware(request: NextRequest) {
  const { pathname, origin } = request.nextUrl;
  const match = pathname.match(/^\/product\/([^/]+)$/);
  const productKey = match?.[1];

  if (!productKey || !/^\d+$/.test(productKey) || !shopApiBase) {
    return NextResponse.next();
  }

  try {
    const response = await fetch(
      `${shopApiBase}/shop/products/slug/${encodeURIComponent(productKey)}`,
      {
        headers: shopApiKey ? { 'x-shop-key': shopApiKey } : undefined,
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      return NextResponse.next();
    }

    const product = (await response.json()) as { slug?: string | null };
    const slug = String(product?.slug || '').trim();
    if (!slug || slug === productKey) {
      return NextResponse.next();
    }

    return new NextResponse(null, {
      status: 301,
      headers: {
        Location: new URL(`/product/${slug}`, origin).toString(),
      },
    });
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/product/:path*'],
};
