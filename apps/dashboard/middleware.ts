import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match /dashboard/* routes only.
     * Excludes _next/static, _next/image, favicon, and api routes automatically
     * because they don't start with /dashboard.
     */
    '/dashboard/:path*',
  ],
};
