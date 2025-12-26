import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const cookieStore = cookies();

  const supabase = createServerClient(
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
    },
  );

  // ESSENCIAL: troca o code por sessão em cookies
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  // Se falhar, volta para login
  if (error) {
    return NextResponse.redirect(`${origin}/login`);
  }

  // Redireciona para home (ou /portal, se você preferir)
  return NextResponse.redirect(`${origin}/`);
}
