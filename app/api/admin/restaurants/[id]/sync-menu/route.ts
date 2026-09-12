import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { syncMenu } from '@/lib/menu/sync';
import { getProducts, getProductIngredients } from '@/lib/poster/client';
import { decrypt } from '@/lib/crypto/secretBox';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServerClient();

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('poster_token')
    .eq('id', id)
    .single();

  if (restaurant) {
    try {
      await syncMenu(
        supabase,
        { getProducts, getProductIngredients },
        { restaurantId: id, posterToken: decrypt(restaurant.poster_token) },
      );
    } catch (err) {
      console.error(`Manual menu sync failed for restaurant ${id}:`, err);
    }
  }

  return NextResponse.redirect(new URL('/admin', request.url), 303);
}
