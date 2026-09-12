import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { callGeminiWithFallback, NoAvailableKeyError } from '@/lib/gemini/callWithFallback';
import type { GeminiKey } from '@/lib/gemini/keyPool';
import { callGeminiJson, GeminiApiError } from '@/lib/gemini/client';
import { buildDishAnswer, DISH_ANSWER_SCHEMA } from '@/lib/ai/dishAnswer';
import type { CartLine } from '@/lib/ai/dishAnswer';

const SERVICE_OVERLOADED_MESSAGE =
  'Сейчас сервис перегружен, попробуйте через минуту или уточните у официанта.';

interface IngredientRef {
  name: string;
}

export async function POST(request: NextRequest) {
  let body: {
    restaurantId?: string;
    itemId?: string;
    question?: string;
    cart?: CartLine[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { restaurantId, itemId, question, cart } = body;
  if (!restaurantId || !itemId || !question?.trim()) {
    return NextResponse.json(
      { error: 'restaurantId, itemId and question are required' },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServerClient();

  const [{ data: restaurant }, { data: item }] = await Promise.all([
    supabase.from('restaurants').select('name, description').eq('id', restaurantId).single(),
    supabase
      .from('menu_items')
      .select('name, ingredients, ingredients_known, in_stop_list')
      .eq('id', itemId)
      .eq('restaurant_id', restaurantId)
      .single(),
  ]);

  if (!restaurant || !item) {
    return NextResponse.json({ error: 'Dish or restaurant not found' }, { status: 404 });
  }

  const ingredients = ((item.ingredients as IngredientRef[] | null) ?? []).map((i) => i.name);

  async function callModel(systemInstruction: string, userMessage: string): Promise<unknown> {
    const answer = await callGeminiWithFallback(
      {
        getActiveKeys: () => getActiveGeminiKeys(supabase),
        resetDailyUsage: (keyId) => resetGeminiKeyForNewDay(supabase, keyId),
        incrementUsage: (id, requestsToday) => setGeminiKeyRequestsToday(supabase, id, requestsToday),
        callModel: (key, sys, msg) => callGeminiJson(key.apiKey, key.model, sys, msg, DISH_ANSWER_SCHEMA),
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
    const result = await buildDishAnswer(
      { callModel },
      {
        restaurantName: restaurant.name,
        restaurantDescription: restaurant.description ?? '',
        dishName: item.name,
        ingredientsKnown: item.ingredients_known,
        ingredients,
        inStopList: item.in_stop_list,
      },
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
    .select('id, api_key, model, daily_limit, requests_today, usage_date')
    .eq('is_active', true)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true });

  return (data ?? []).map((k) => ({
    id: k.id,
    apiKey: k.api_key,
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
