import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

function sanitizeCookieOptions(options: any) {
  if (!options) return options;

  // Remover Domain (muito frequentemente é a causa do cookie ser rejeitado)
  const { domain, ...rest } = options;

  // Garantir consistência para browser-client (document.cookie)
  return {
    ...rest,
    httpOnly: false,
  };
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const pathname = req.nextUrl.pathname;

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
            res.cookies.set(name, value, sanitizeCookieOptions(options));
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  const { data: perfil } = await supabase
    .from('perfis')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = String(perfil?.role ?? 'VENDEDOR').toUpperCase();

  const vendorAllowedBases = ['/portal'];
  const isAllowedForVendor = vendorAllowedBases.some(
    (base) => pathname === base || pathname.startsWith(base + '/')
  );

  if (role === 'VENDEDOR' && !isAllowedForVendor) {
    const url = req.nextUrl.clone();
    url.pathname = '/portal';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
