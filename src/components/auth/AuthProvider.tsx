'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type AuthContextType = {
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // IMPORTANTe: client estável (não recriar a cada render)
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        // 1) rápido: pega sessão do storage/cookies
        const { data: sess } = await supabase.auth.getSession();
        if (!mounted) return;

        const sessionUser = sess.session?.user ?? null;
        setUser(sessionUser);
        setLoading(false);

        // 2) opcional (robustez): confirma user no servidor
        // (se isso der erro em anônimo/3rd party cookies, não quebra o app)
        if (sessionUser) {
          const { data } = await supabase.auth.getUser();
          if (!mounted) return;
          setUser(data.user ?? sessionUser);
        }
      } catch {
        if (!mounted) return;
        setUser(null);
        setLoading(false);
      }
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
