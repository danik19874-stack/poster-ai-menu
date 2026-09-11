import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = getSupabaseServerClient();

  const { data } = await supabase.from('gemini_api_keys').select('is_active').eq('id', id).single();
  if (data) {
    await supabase.from('gemini_api_keys').update({ is_active: !data.is_active }).eq('id', id);
  }

  return NextResponse.redirect(new URL('/admin', request.url), 303);
}
