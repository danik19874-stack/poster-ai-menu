import { NextResponse } from 'next/server';

export async function GET() {
  const applicationId = process.env.POSTER_APPLICATION_ID;
  const redirectUri = process.env.POSTER_OAUTH_REDIRECT_URI;

  if (!applicationId || !redirectUri) {
    return NextResponse.json(
      {
        error:
          'OAuth is not configured (missing POSTER_APPLICATION_ID or POSTER_OAUTH_REDIRECT_URI)',
      },
      { status: 500 },
    );
  }

  const authorizeUrl = new URL('https://joinposter.com/api/auth');
  authorizeUrl.searchParams.set('application_id', applicationId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('response_type', 'code');

  return NextResponse.redirect(authorizeUrl.toString());
}
