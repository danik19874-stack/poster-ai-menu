import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { callGeminiWithFallback, NoAvailableKeyError } from '@/lib/gemini/callWithFallback';
import type { GeminiKey } from '@/lib/gemini/keyPool';
import { callGeminiJson, GeminiApiError } from '@/lib/gemini/client';
import {
  buildMenuRecommendation,
  MENU_RECOMMENDATION_SCHEMA,
} from '@/lib/ai/menuRecommendation';
import type { CartLine, MenuItemSummary } from '@/lib/ai/menuRecommendation';
import { decrypt } from '@/lib/crypto/secretBox';
import { isRateLimited } from '@/lib/ai/rateLimiter';

const RATE_LIMITED_MESSAGE = 'Слишком много вопросов подряд — подождите немного и попробуйте снова.';

const SERVICE_OVERLOADED_MESSAGE =
  'Сейчас сервис перегружен, попробуйте через минуту или уточните у официанта.';

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
    supabase.from('restaurants').select('name, description').eq('id', restaurantId).single(),
    supabase
      .from('menu_items')
      .select('name, price, category_name, ingredients, ingredients_known')
      .eq('restaurant_id', restaurantId)
      .eq('in_stop_list', false),
  ]);

  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
  }

  if (await isRateLimited({ countRecentActivity: (id, since) => countRecentAiQueries(supabase, id, since) }, restaurantId)) {
    return NextResponse.json({ answer: RATE_LIMITED_MESSAGE }, { status: 429 });
  }

  const menuItems: MenuItemSummary[] = (items ?? []).map((item) => ({
    name: item.name,
    price: item.price,
    categoryName: item.category_name,
    ingredientsKnown: item.ingredients_known,
    ingredients: ((item.ingredients as IngredientRef[] | null) ?? []).map((i) => i.name),
  }));

  async function callModel(systemInstruction: string, userMessage: string): Promise<unknown> {
    const answer = await callGeminiWithFallback(
      {
        getActiveKeys: () => getActiveGeminiKeys(supabase),
        resetDailyUsage: (keyId) => resetGeminiKeyForNewDay(supabase, keyId),
        incrementUsage: (id, requestsToday) => setGeminiKeyRequestsToday(supabase, id, requestsToday),
        callModel: (key, sys, msg) =>
          callGeminiJson(key.apiKey, key.model, sys, msg, MENU_RECOMMENDATION_SCHEMA),
      },
      systemInstruction,
      userMessage,
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
      { restaurantName: restaurant.name, restaurantDescription: restaurant.description ?? '', items: menuItems },
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

async function countRecentAiQueries(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  restaurantId: string,
  sinceIso: string,
): Promise<number> {
  const { count } = await supabase
    .from('activity_log')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .eq('kind', 'ai_query')
    .gte('created_at', sinceIso);

  return count ?? 0;
}

async function getActiveGeminiKeys(
  supabase: ReturnType<typeof getSupabaseServerClient>,
): Promise<GeminiKey[]> {
  const { data } = await supabase
    .from('gemini_api_keys')
    .select('id, api_key, model, daily_limit, requests_today, usage_date')
    .eq('is_active', true)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true });

  return (data ?? []).map((k) => ({
    id: k.id,
    apiKey: decrypt(k.api_key),
    model: k.model,
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
