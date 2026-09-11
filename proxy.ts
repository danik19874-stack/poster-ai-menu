import { NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { verifySessionToken } from '@/lib/admin/session';
import { shouldSkipIntl } from '@/lib/routing/shouldSkipIntl';
import { routing } from '@/i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (shouldSkipIntl(pathname)) {
    if (pathname === '/admin/login' || pathname === '/api/admin/login') {
      return NextResponse.next();
    }

    const token = request.cookies.get('admin_session')?.value;
    if (!verifySessionToken(token)) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    return NextResponse.next();
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/((?!api|_next|_vercel|.*\\..*).*)'],
};
