'use client';

import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type WhoAmIResponse =
  | { ok: true; authenticated: false; user: null }
  | { ok: true; authenticated: true; user: { id: string; email: string | null } };

type AuthState = {
  user: User | null;
  loading: boolean;
  ready: boolean;
};

async function fetchWhoAmI(): Promise<WhoAmIResponse> {
  const res = await fetch('/auth/whoami', { cache: 'no-store' });
  return res.json();
}

export function useAuth() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    ready: false,
  });

  useEffect(() => {
    let mounted = true;

    async function syncFromServer() {
      try {
        const me = await fetchWhoAmI();

        if (!mounted) return;

        if (!me.authenticated) {
          setState({ user: null, loading: false, ready: true });
          return;
        }

        // Opcional: tentar obter o user completo do supabase client (metadados).
        // Se falhar, ao menos mantemos id/email.
        const { data } = await supabase.auth.getUser();

        const u = data.user;
        if (u && u.id === me.user.id) {
          setState({ user: u, loading: false, ready: true });
        } else {
          // fallback mínimo (id/email) para evitar “sumir”
          setState({
            user: { id: me.user.id, email: me.user.email ?? undefined } as any,
            loading: false,
            ready: true,
          });
        }
      } catch {
        if (!mounted) return;
        setState({ user: null, loading: false, ready: true });
      }
    }

    // 1) bootstrap via server (funciona em incógnito / refresh)
    syncFromServer();

    // 2) em mudanças de auth, ressincroniza via server
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      syncFromServer();
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, [supabase]);

  // Não aguardar (pode pendurar). Logout definitivo é /auth/signout.
  const signOut = () => {
    try {
      void supabase.auth.signOut();
    } catch {}
  };

  return {
    user: state.user,
    loading: state.loading,
    ready: state.ready,
    signOut,
  };
}
