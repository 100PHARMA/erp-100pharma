import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Nunca expor detalhes sensíveis aqui. Só o essencial para o client.
  if (error || !user) {
    return NextResponse.json(
      { ok: true, authenticated: false, user: null },
      { status: 200 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      authenticated: true,
      user: { id: user.id, email: user.email ?? null },
    },
    { status: 200 }
  );
}
