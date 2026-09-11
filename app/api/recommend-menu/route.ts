import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { pickAvailableKey, recordKeyUsage } from '@/lib/gemini/keyPool';
import type { GeminiKey } from '@/lib/gemini/keyPool';
import { callGeminiJson, GeminiApiError } from '@/lib/gemini/client';
import {
  buildMenuRecommendation,
  MENU_RECOMMENDATION_SCHEMA,
} from '@/lib/ai/menuRecommendation';
import type { CartLine, MenuItemSummary } from '@/lib/ai/menuRecommendation';

const SERVICE_OVERLOADED_MESSAGE =
  'Сейчас сервис перегружен, попробуйте через минуту или уточните у официанта.';

class NoAvailableKeyError extends Error {}

interface IngredientRef {
  name: string;
}

export async function POST(request: NextRequest) {
  let body: {
    restaurantId?: string;
    question?: string;
    cart?: CartLine[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { restaurantId, question, cart } = body;
  if (!restaurantId || !question?.trim()) {
    return NextResponse.json(
      { error: 'restaurantId and question are required' },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServerClient();

  const [{ data: restaurant }, { data: items }] = await Promise.all([
    supabase.from('restaurants').select('name').eq('id', restaurantId).single(),
    supabase
      .from('menu_items')
      .select('name, price, category_name, ingredients, ingredients_known')
      .eq('restaurant_id', restaurantId)
      .eq('in_stop_list', false),
  ]);

  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
  }

  const menuItems: MenuItemSummary[] = (items ?? []).map((item) => ({
    name: item.name,
    price: item.price,
    categoryName: item.category_name,
    ingredientsKnown: item.ingredients_known,
    ingredients: ((item.ingredients as IngredientRef[] | null) ?? []).map((i) => i.name),
  }));

  async function callModel(systemInstruction: string, userMessage: string): Promise<unknown> {
    const key = await pickAvailableKey({
      getActiveKeys: () => getActiveGeminiKeys(supabase),
      resetDailyUsage: (keyId) => resetGeminiKeyForNewDay(supabase, keyId),
    });

    if (!key) {
      throw new NoAvailableKeyError('All Gemini keys exhausted for today');
    }

    const answer = await callGeminiJson(
      key.apiKey,
      systemInstruction,
      userMessage,
      MENU_RECOMMENDATION_SCHEMA,
    );

    await recordKeyUsage(
      { incrementUsage: (id, requestsToday) => setGeminiKeyRequestsToday(supabase, id, requestsToday) },
      key,
    );

    try {
      await supabase.from('activity_log').insert({ restaurant_id: restaurantId, kind: 'ai_query' });
    } catch (logError) {
      console.error('Failed to record activity_log for ai_query:', logError);
    }

    return answer;
  }

  try {
    const result = await buildMenuRecommendation(
      { callModel },
      { restaurantName: restaurant.name, items: menuItems },
      cart ?? [],
      question,
    );

    return NextResponse.json({ answer: result.answer });
  } catch (err) {
    if (err instanceof NoAvailableKeyError) {
      return NextResponse.json({ answer: SERVICE_OVERLOADED_MESSAGE });
    }
    if (err instanceof GeminiApiError) {
      console.error('Gemini call failed:', err);
      return NextResponse.json({ answer: SERVICE_OVERLOADED_MESSAGE });
    }
    throw err;
  }
}

async function getActiveGeminiKeys(
  supabase: ReturnType<typeof getSupabaseServerClient>,
): Promise<GeminiKey[]> {
  const { data } = await supabase
    .from('gemini_api_keys')
    .select('id, api_key, daily_limit, requests_today, usage_date')
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  return (data ?? []).map((k) => ({
    id: k.id,
    apiKey: k.api_key,
    dailyLimit: k.daily_limit,
    requestsToday: k.requests_today,
    usageDate: k.usage_date,
  }));
}

async function resetGeminiKeyForNewDay(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  keyId: string,
): Promise<void> {
  await supabase
    .from('gemini_api_keys')
    .update({ requests_today: 0, usage_date: new Date().toISOString().slice(0, 10) })
    .eq('id', keyId);
}

async function setGeminiKeyRequestsToday(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  keyId: string,
  requestsToday: number,
): Promise<void> {
  await supabase.from('gemini_api_keys').update({ requests_today: requestsToday }).eq('id', keyId);
}
