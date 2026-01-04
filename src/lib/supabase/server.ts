import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const cookieStore = cookies();

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            // NÃO altere options
            cookieStore.set(name, value, options);
          });
        } catch {
          // Em alguns cenários (RSC sem mutation), o Next bloqueia set.
          // Isso é esperado e não quebra o fluxo.
        }
      },
    },
  });
}
