// src/lib/supabase/browser.ts
import { createBrowserClient } from '@supabase/ssr';

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

type CookieToSet = {
  name: string;
  value: string;
  options?: {
    path?: string;
    domain?: string;
    maxAge?: number;
    expires?: Date | string;
    secure?: boolean;
    httpOnly?: boolean; // ignore no browser
    sameSite?: 'lax' | 'strict' | 'none';
  };
};

// Parse simples de document.cookie -> [{name,value}]
function getAllCookies(): Array<{ name: string; value: string }> {
  if (typeof document === 'undefined') return [];
  const raw = document.cookie || '';
  if (!raw) return [];

  return raw.split(';').map((part) => {
    const [n, ...rest] = part.trim().split('=');
    return { name: decodeURIComponent(n), value: decodeURIComponent(rest.join('=') || '') };
  });
}

function setCookie({ name, value, options }: CookieToSet) {
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

  // Em produção com HTTPS, isso deve estar true.
  // Se você estiver em localhost http, o browser ignora Secure.
  if (opts.secure) parts.push('Secure');

  // httpOnly não pode ser setado no browser (apenas server), então ignoramos.

  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);

  document.cookie = parts.join('; ');
}

export function createSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // IMPORTANTÍSSIMO:
  // - Força o browser client a ler/escrever sessão via cookies,
  //   alinhado com o middleware/server (SSR).
  browserClient = createBrowserClient(url, anon, {
    cookies: {
      getAll() {
        return getAllCookies();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(setCookie);
      },
    },
  });

  return browserClient;
}
