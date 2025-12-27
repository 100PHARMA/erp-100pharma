import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const pathname = req.nextUrl.pathname;

  // Rotas públicas (não exigem sessão)
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
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Se não está logado, manda para /login com next
  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Role
  const { data: perfil } = await supabase
    .from('perfis')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = String(perfil?.role ?? 'VENDEDOR').toUpperCase();

  // Allowlist do vendedor (ajuste aqui)
  const vendorAllowed = [
    '/portal',
    '/portal/visitas',
    '/vendas',
    '/quilometragem',
    '/metas',
  ];

  const isAllowedForVendor =
    vendorAllowed.some((base) => pathname === base || pathname.startsWith(base + '/'));

  // VENDEDOR: só rotas permitidas
  if (role === 'VENDEDOR' && !isAllowedForVendor) {
    const url = req.nextUrl.clone();
    url.pathname = '/vendas'; // home do vendedor
    url.search = '';
    return NextResponse.redirect(url);
  }

  // ADMIN: tudo liberado
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};


export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
