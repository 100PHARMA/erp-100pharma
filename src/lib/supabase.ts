// src/lib/supabase.ts
//
// Este arquivo EXISTE só para manter compatibilidade com imports antigos (`import { supabase } from './supabase'`).
// A partir de agora, no BROWSER usamos @supabase/ssr com cookies (igual ao middleware).
// No SERVER (sem contexto de request/cookies), exportamos um client "anônimo" (sem sessão).
//
// Ideal (futuro): parar de usar este arquivo e usar:
// - src/lib/supabase/browser.ts no client
// - src/lib/supabase/server.ts no server (com request cookies)

import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️ ERRO: Variáveis de ambiente do Supabase não configuradas!');
  console.error('Configure: NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

function getAllCookies(): Array<{ name: string; value: string }> {
  if (typeof document === 'undefined') return [];
  const raw = document.cookie || '';
  if (!raw) return [];
  return raw.split(';').map((part) => {
    const [n, ...rest] = part.trim().split('=');
    return { name: decodeURIComponent(n), value: decodeURIComponent(rest.join('=') || '') };
  });
}

function setCookie({
  name,
  value,
  options,
}: {
  name: string;
  value: string;
  options?: {
    path?: string;
    domain?: string;
    maxAge?: number;
    expires?: Date | string;
    secure?: boolean;
    sameSite?: 'lax' | 'strict' | 'none';
  };
}) {
  if (typeof document === 'undefined') return;

  const opts = options ?? {};
  const parts: string[] = [];
  parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
  parts.push(`Path=${opts.path ?? '/'}`);

  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  if (typeof opts.maxAge === 'number') parts.push(`Max-Age=${opts.maxAge}`);

  if (opts.expires) {
    const exp = typeof opts.expires === 'string' ? new Date(opts.expires) : opts.expires;
    parts.push(`Expires=${exp.toUTCString()}`);
  }

  if (opts.secure) parts.push('Secure');
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);

  document.cookie = parts.join('; ');
}

// Export único: no browser = SSR cookies; no server = anon (sem sessão)
export const supabase =
  typeof window !== 'undefined'
    ? createBrowserClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return getAllCookies();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(setCookie);
          },
        },
      })
    : createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        db: { schema: 'public' },
      });
