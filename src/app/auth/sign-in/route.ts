import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function POST(req: NextRequest) {
  const { email, password } = (await req.json()) as {
    email: string;
    password: string;
  };

  // Response que carregará os Set-Cookie
  const res = NextResponse.json({ ok: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  }

  return res;
}
