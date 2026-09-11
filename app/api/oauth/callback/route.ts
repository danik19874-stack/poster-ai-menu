import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { completeOAuthConnection } from '@/lib/oauth/completeOAuthConnection';
import { exchangeOAuthCode, getSpots } from '@/lib/poster/oauth';
import { PosterApiError } from '@/lib/poster/types';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const account = request.nextUrl.searchParams.get('account');

  if (!code || !account) {
    return NextResponse.json(
      { error: 'Missing code or account query parameter' },
      { status: 400 },
    );
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: 'Server is misconfigured (missing Supabase credentials)' },
      { status: 500 },
    );
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  async function upsertRestaurant(restaurant: {
    posterAccountNumber: string;
    posterSpotId: number;
    posterToken: string;
    name: string;
  }) {
    const { data, error } = await supabase
      .from('restaurants')
      .upsert(
        {
          poster_account_number: restaurant.posterAccountNumber,
          poster_spot_id: restaurant.posterSpotId,
          poster_token: restaurant.posterToken,
          name: restaurant.name,
        },
        { onConflict: 'poster_account_number' },
      )
      .select('id')
      .single();
    if (error || !data) {
      // Don't leak raw Postgres/Supabase error details (e.g. constraint names) to the
      // caller — this route is reachable via an unauthenticated GET. Log the real error
      // server-side and throw a generic message instead.
      console.error('Failed to save restaurant after OAuth:', error);
      throw new Error('Failed to save restaurant after OAuth');
    }
    return { id: data.id as string };
  }

  try {
    const result = await completeOAuthConnection(
      { exchangeOAuthCode, getSpots, upsertRestaurant },
      { account, code },
    );
    const connectedUrl = new URL('/connected', request.url);
    connectedUrl.searchParams.set('restaurant', result.restaurantId);
    connectedUrl.searchParams.set('name', result.restaurantName);
    return NextResponse.redirect(connectedUrl);
  } catch (error) {
    if (error instanceof PosterApiError && error.statusCode === 0) {
      console.error('OAuth callback: could not reach Poster:', error);
      return NextResponse.json(
        { error: 'Could not reach Poster right now, please try again' },
        { status: 502 },
      );
    }
    console.error('OAuth callback failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 },
    );
  }
}
