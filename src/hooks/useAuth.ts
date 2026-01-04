'use client';

import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

// Import do context de forma segura (não pode lançar erro em build/prerender)
import { useAuthContext, type AuthRole } from '@/components/auth/AuthProvider';

type Return = {
  user: User | null;
  role: AuthRole;
  loading: boolean;
  ready: boolean;
  signOut: () => void;
};

export function useAuth(): Return {
  // Tenta usar provider; se não existir, cai para fallback
  let ctx: any = null;
  try {
    ctx = useAuthContext();
  } catch {
    ctx = null;
  }

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [fallbackUser, setFallbackUser] = useState<User | null>(null);
  const [fallbackReady, setFallbackReady] = useState(false);

  useEffect(() => {
    if (ctx) return; // se tem provider, não usa fallback

    let cancelled = false;

    async function load() {
      const { data } = await supabase.auth.getUser();
      if (!cancelled) {
        setFallbackUser(data.user ?? null);
        setFallbackReady(true);
      }
    }

    load();

    const { data: sub } = supabase.auth.onAuthStateChange(async () => {
      const { data } = await supabase.auth.getUser();
      if (!cancelled) {
        setFallbackUser(data.user ?? null);
        setFallbackReady(true);
      }
    });

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
    };
  }, [ctx, supabase]);

  const signOut = () => {
    window.location.href = '/auth/signout';
  };

  if (ctx) {
    return {
      user: ctx.user,
      role: ctx.role,
      loading: !ctx.ready,
      ready: ctx.ready,
      signOut,
    };
  }

  return {
    user: fallbackUser,
    role: 'UNKNOWN',
    loading: !fallbackReady,
    ready: fallbackReady,
    signOut,
  };
}
