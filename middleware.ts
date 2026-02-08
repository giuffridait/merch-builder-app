import { NextRequest, NextResponse } from 'next/server';

const USER = process.env.BASIC_AUTH_USER;
const PASS = process.env.BASIC_AUTH_PASS;

function unauthorized() {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Protected"'
    }
  });
}

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const publicPaths = [
    '/api/catalog/search',
    '/api/offer',
    '/api/commit',
    '/api/order'
  ];
  if (publicPaths.some(path => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  if (!USER || !PASS) return NextResponse.next();

  const auth = req.headers.get('authorization');
  if (!auth || !auth.startsWith('Basic ')) {
    return unauthorized();
  }

  const base64 = auth.split(' ')[1] || '';
  const decoded = atob(base64);
  const [user, pass] = decoded.split(':');

  if (user !== USER || pass !== PASS) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/catalog/search',
    '/api/offer',
    '/api/commit',
    '/api/order/:path*',
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'
  ]
};
