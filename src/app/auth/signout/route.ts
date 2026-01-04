import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

function createSupabaseServer(req: NextRequest, res: NextResponse) {
  return createServerClient(
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
}

// GET: logout + redirect (modo mais robusto para UI)
export async function GET(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';

  const res = NextResponse.redirect(url, { status: 302 });

  const supabase = createSupabaseServer(req, res);

  // Isso DEVE expirar os cookies no response (Set-Cookie)
  await supabase.auth.signOut();

  return res;
}

// POST: compatibilidade caso alguém use fetch
export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });

  const supabase = createSupabaseServer(req, res);

  await supabase.auth.signOut();

  return res;
}
