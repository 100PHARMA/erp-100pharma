import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

function isPublicPath(pathname: string) {
  return (
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname === '/auth/callback' ||
    pathname.startsWith('/auth/callback/') ||
    pathname === '/reset-password' ||
    pathname.startsWith('/reset-password/') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname === '/favicon.ico'
  );
}

function isPortalPath(pathname: string) {
  return pathname === '/portal' || pathname.startsWith('/portal/');
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const pathname = req.nextUrl.pathname;

  // Rotas públicas não exigem sessão
  if (isPublicPath(pathname)) return res;

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Se não está logado, manda para /login com next (inclui querystring)
  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // Role (fonte única)
  const { data: perfil, error: perfilError } = await supabase
    .from('perfis')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  // Segurança: se não conseguir ler perfil/role, trata como vendedor (mais restritivo)
  const role = String(perfil?.role ?? 'VENDEDOR').toUpperCase();

  // VENDEDOR: apenas portal
  if (role === 'VENDEDOR' && !isPortalPath(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = '/portal';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // ADMIN: tudo liberado (inclusive /portal)
  // Se houver erro ao ler perfil, ainda assim já caímos no padrão restritivo acima
  void perfilError; // evita lint "unused" caso exista regra
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
