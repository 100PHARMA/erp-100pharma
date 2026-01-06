import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

function safeNext(nextRaw: string | null): string {
  if (!nextRaw) return '/after-login';
  try {
    const decoded = decodeURIComponent(nextRaw);
    // só permite paths internos
    if (decoded.startsWith('/')) return decoded;
    return '/after-login';
  } catch {
    return '/after-login';
  }
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();

  const contentType = req.headers.get('content-type') || '';
  let email = '';
  let password = '';
  let nextFromBody: string | null = null;

  if (contentType.includes('application/json')) {
    const body = await req.json();
    email = String(body.email ?? '').trim();
    password = String(body.password ?? '');
    nextFromBody = body.next ? String(body.next) : null;
  } else {
    const form = await req.formData();
    email = String(form.get('email') ?? '').trim();
    password = String(form.get('password') ?? '');
    nextFromBody = form.get('next') ? String(form.get('next')) : null;
  }

  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get('next') ?? nextFromBody);

  if (!email || !password) {
    // 303 para voltar ao login com erro
    return NextResponse.redirect(new URL(`/login?e=missing_credentials&next=${encodeURIComponent(next)}`, url.origin), 303);
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.redirect(new URL(`/login?e=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`, url.origin), 303);
  }

  // IMPORTANTE: neste ponto o @supabase/ssr setou cookies sb-* via setAll()
  return NextResponse.redirect(new URL(next, url.origin), 303);
}
