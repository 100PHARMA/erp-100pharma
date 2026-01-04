'use client';

import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export type AuthRole = 'ADMIN' | 'VENDEDOR' | 'UNKNOWN';

type AuthContextValue = {
  user: User | null;
  role: AuthRole;
  ready: boolean;
  setAuth: (next: { user: User | null; role: AuthRole }) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type Props = {
  initialUser: { id: string; email?: string | null } | null;
  initialRole: AuthRole;
  children: React.ReactNode;
};

export default function AuthProvider({ initialUser, initialRole, children }: Props) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  // Estado inicial vem do SERVER (crítico para refresh/incógnito)
  const [user, setUser] = useState<User | null>(
    initialUser ? ({ id: initialUser.id, email: initialUser.email ?? undefined } as any) : null
  );
  const [role, setRole] = useState<AuthRole>(initialRole);
  const [ready, setReady] = useState(true); // já nasce pronto, porque veio do server

  // Mantém sincronizado em runtime (login/logout sem refresh)
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async () => {
      // best-effort: tenta obter user real do supabase
      const { data } = await supabase.auth.getUser();
      setUser(data.user ?? null);
      // role é mantido pelo server gates; opcionalmente atualizar aqui se quiseres
      setReady(true);
    });

    return () => {
      sub?.subscription?.unsubscribe();
    };
  }, [supabase]);

  const value: AuthContextValue = useMemo(
    () => ({
      user,
      role,
      ready,
      setAuth: (next) => {
        setUser(next.user);
        setRole(next.role);
        setReady(true);
      },
    }),
    [user, role, ready]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used within <AuthProvider />');
  }
  return ctx;
}
