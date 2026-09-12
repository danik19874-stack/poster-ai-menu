import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

const MAX_DESCRIPTION_LENGTH = 300;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: { description?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const description = String(body.description ?? '').trim().slice(0, MAX_DESCRIPTION_LENGTH);

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from('restaurants').update({ description }).eq('id', id);

  if (error) {
    console.error('Failed to save restaurant description:', error);
    return NextResponse.json({ error: 'Failed to save description' }, { status: 500 });
  }

  return NextResponse.json({ description });
}
