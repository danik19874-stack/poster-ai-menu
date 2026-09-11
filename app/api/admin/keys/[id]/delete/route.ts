import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = getSupabaseServerClient();

  await supabase.from('gemini_api_keys').delete().eq('id', id);

  return NextResponse.redirect(new URL('/admin', request.url), 303);
}
