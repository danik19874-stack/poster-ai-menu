import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createTableOrder } from '@/lib/orders/createTableOrder';
import { createIncomingOrder } from '@/lib/poster/client';
import { PosterApiError } from '@/lib/poster/types';
import type { CreateIncomingOrderItem } from '@/lib/poster/types';

async function getRestaurant(supabase: SupabaseClient, restaurantId: string) {
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { restaurantId, tableLabel, items } = (body ?? {}) as Record<string, unknown>;

  if (!isNonEmptyString(restaurantId)) {
    return NextResponse.json(
      { error: 'restaurantId must be a non-empty string' },
      { status: 400 },
    );
  }
  if (!isNonEmptyString(tableLabel)) {
    return NextResponse.json(
      { error: 'tableLabel must be a non-empty string' },
      { status: 400 },
    );
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: 'items must be a non-empty array' },
      { status: 400 },
    );
  }

  try {
    // Constructed per-request (not at module scope) so a missing env var fails this one
    // request cleanly instead of crashing the route on module load for every request.
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const result = await createTableOrder(
      {
        getRestaurant: (id) => getRestaurant(supabase, id),
        createIncomingOrder,
      },
      {
        restaurantId,
        tableLabel,
        items: items as CreateIncomingOrderItem[],
      },
    );

    try {
      await supabase.from('activity_log').insert({ restaurant_id: restaurantId, kind: 'order' });
    } catch (logError) {
      // Analytics logging must never fail an order that already succeeded in Poster.
      console.error('Failed to record activity_log for order:', logError);
    }

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
