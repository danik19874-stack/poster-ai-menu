import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const label = String(formData.get('label') ?? '').trim();
  const apiKey = String(formData.get('api_key') ?? '').trim();
  const dailyLimitRaw = Number(formData.get('daily_limit'));
  const dailyLimit = Number.isFinite(dailyLimitRaw) && dailyLimitRaw > 0 ? dailyLimitRaw : 1500;

  if (!label || !apiKey) {
    return NextResponse.redirect(new URL('/admin?error=missing_fields', request.url), 303);
  }

  const supabase = getSupabaseServerClient();
  await supabase.from('gemini_api_keys').insert({ label, api_key: apiKey, daily_limit: dailyLimit });

  return NextResponse.redirect(new URL('/admin', request.url), 303);
}
