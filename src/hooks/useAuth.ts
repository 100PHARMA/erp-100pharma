'use client';

import { useEffect, useMemo, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  ready: boolean; // sessão já foi verificada pelo menos 1 vez
};

export function useAuth() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    ready: false,
  });

  useEffect(() => {
    let mounted = true;

    async function init() {
      // 1) fonte única no browser: sessão via cookies (SSR client)
      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        // Se falhar, considera deslogado, mas "ready"
        setState({ user: null, session: null, loading: false, ready: true });
        return;
      }

      setState({
        user: data.session?.user ?? null,
        session: data.session ?? null,
        loading: false,
        ready: true,
      });
    }

    init();

    // 2) mantém em sincronia com mudanças de auth
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setState((prev) => ({
        ...prev,
        user: session?.user ?? null,
        session: session ?? null,
        loading: false,
        ready: true,
      }));
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, [supabase]);

  // IMPORTANTÍSSIMO:
  // - NÃO aguardar supabase.auth.signOut() (pode pendurar)
  // - logout definitivo é via /auth/signout (server)
  const signOut = () => {
    try {
      void supabase.auth.signOut();
    } catch {
      // ignora
    }
  };

  return {
    user: state.user,
    session: state.session,
    loading: state.loading,
    ready: state.ready,
    signOut,
  };
}
