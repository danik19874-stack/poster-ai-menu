import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createTableOrder } from '@/lib/orders/createTableOrder';
import { createIncomingOrder } from '@/lib/poster/client';
import { PosterApiError } from '@/lib/poster/types';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function getRestaurant(restaurantId: string) {
  const { data, error } = await supabase
    .from('restaurants')
    .select('poster_spot_id, poster_token')
    .eq('id', restaurantId)
    .single();

  if (error || !data) {
    throw new Error(`Restaurant not found: ${restaurantId}`);
  }

  return { posterSpotId: data.poster_spot_id, posterToken: data.poster_token };
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  try {
    const result = await createTableOrder(
      { getRestaurant, createIncomingOrder },
      {
        restaurantId: body.restaurantId,
        tableLabel: body.tableLabel,
        items: body.items,
      },
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof PosterApiError && error.statusCode === 0) {
      return NextResponse.json(
        { error: 'Could not reach Poster right now, please try again' },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 },
    );
  }
}
