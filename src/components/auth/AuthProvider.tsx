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
  // Client estável (não recriar a cada render)
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        // 1) rápido: pega sessão do storage/cookies
        const { data: sess, error: sessErr } = await supabase.auth.getSession();
        if (!mounted) return;

        if (sessErr) {
          setUser(null);
          setLoading(false);
          return;
        }

        const sessionUser = sess.session?.user ?? null;
        setUser(sessionUser);
        setLoading(false);

        // 2) robustez: confirma user (se falhar, mantém o sessionUser)
        if (sessionUser) {
          const { data: u, error: uErr } = await supabase.auth.getUser();
          if (!mounted) return;
          if (!uErr) setUser(u.user ?? sessionUser);
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
