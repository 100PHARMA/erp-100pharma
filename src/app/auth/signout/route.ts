import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

function createSupabaseServer() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

// GET: logout + redirect (mais robusto para UI)
// Use assim: window.location.assign('/auth/signout')
export async function GET(request: Request) {
  const { origin } = new URL(request.url);

  const supabase = createSupabaseServer();
  await supabase.auth.signOut();

  // Redireciona para login após limpar cookies
  return NextResponse.redirect(`${origin}/login`, { status: 302 });
}

// POST: mantém compatibilidade (caso use fetch)
export async function POST() {
  const supabase = createSupabaseServer();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
