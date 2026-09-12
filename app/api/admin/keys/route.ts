import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { GEMINI_MODEL_CHAIN } from '@/lib/gemini/models';
import { encrypt } from '@/lib/crypto/secretBox';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const label = String(formData.get('label') ?? '').trim();
  const apiKey = String(formData.get('api_key') ?? '').trim();

  if (!label || !apiKey) {
    return NextResponse.redirect(new URL('/admin?error=missing_fields', request.url), 303);
  }

  const supabase = getSupabaseServerClient();
  const encryptedApiKey = encrypt(apiKey);
  // One real Gemini key is metered separately per model on Google's side, so a
  // single "add key" submission becomes one row per model in the fallback chain —
  // see lib/gemini/models.ts. The daily_limit field was removed from the form
  // because each model tier has its own verified, real limit; a single number
  // here could never be right for all of them at once.
  await supabase.from('gemini_api_keys').insert(
    GEMINI_MODEL_CHAIN.map((tier) => ({
      label,
      api_key: encryptedApiKey,
      model: tier.model,
      daily_limit: tier.dailyLimit,
      priority: tier.priority,
    })),
  );

  return NextResponse.redirect(new URL('/admin', request.url), 303);
}
