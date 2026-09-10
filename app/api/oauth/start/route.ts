import { NextResponse } from 'next/server';
import { requireEnv } from '@/lib/poster/oauth';

export async function GET() {
  let applicationId: string;
  let redirectUri: string;
  try {
    applicationId = requireEnv('POSTER_APPLICATION_ID');
    redirectUri = requireEnv('POSTER_OAUTH_REDIRECT_URI');
  } catch (error) {
    console.error('OAuth start failed:', error);
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
