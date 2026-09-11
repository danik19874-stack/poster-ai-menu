import { NextRequest, NextResponse } from 'next/server';
import { checkPassword, createSessionToken } from '@/lib/admin/session';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const password = String(formData.get('password') ?? '');

  if (!checkPassword(password)) {
    return NextResponse.redirect(new URL('/admin/login?error=1', request.url), 303);
  }

  const response = NextResponse.redirect(new URL('/admin', request.url), 303);
  response.cookies.set('admin_session', createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
  return response;
}
