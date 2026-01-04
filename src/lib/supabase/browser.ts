import { createBrowserClient } from '@supabase/ssr';

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

type CookieToSet = {
  name: string;
  value: string;
  options?: {
    path?: string;
    domain?: string; // vamos IGNORAR
    maxAge?: number;
    expires?: Date | string;
    secure?: boolean;
    httpOnly?: boolean; // ignore no browser
    sameSite?: 'lax' | 'strict' | 'none';
  };
};

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

  // Path sempre
  parts.push(`Path=${opts.path ?? '/'}`);

  // CRÍTICO: NÃO setar Domain — deixa o browser assumir o host atual
  // if (opts.domain) parts.push(`Domain=${opts.domain}`);

  if (typeof opts.maxAge === 'number') parts.push(`Max-Age=${opts.maxAge}`);

  if (opts.expires) {
    const exp = typeof opts.expires === 'string' ? new Date(opts.expires) : opts.expires;
    parts.push(`Expires=${exp.toUTCString()}`);
  }

  // Default Secure em HTTPS (evita cookies “fracos”)
  const isHttps =
    typeof window !== 'undefined' && window.location && window.location.protocol === 'https:';
  if (opts.secure ?? isHttps) parts.push('Secure');

  // Default SameSite=Lax (compatível e seguro)
  parts.push(`SameSite=${opts.sameSite ?? 'lax'}`);

  document.cookie = parts.join('; ');
}

export function createSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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
