// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const pathname = req.nextUrl.pathname;

  // Rotas públicas (NÃO exigir sessão)
  const isPublic =
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname === '/auth/callback' ||
    pathname.startsWith('/auth/callback/') ||
    pathname === '/reset-password' ||
    pathname.startsWith('/reset-password/') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname === '/favicon.ico';

  if (isPublic) return res;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Se não está logado, manda para /login
  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Busca role do usuário
  const { data: perfil } = await supabase
    .from('perfis')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = (perfil?.role ?? 'VENDEDOR').toUpperCase();

  // Portal do vendedor
  const isPortal = pathname === '/portal' || pathname.startsWith('/portal/');

  // Tudo que NÃO for portal (e não for público) é considerado "app"
  const isAppArea = !isPortal;

  // VENDEDOR: só portal
  if (role === 'VENDEDOR' && isAppArea) {
    const url = req.nextUrl.clone();
    url.pathname = '/portal';
    return NextResponse.redirect(url);
  }

  // ADMIN: pode tudo
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};


export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
