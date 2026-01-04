'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export type AuthRole = 'ADMIN' | 'VENDEDOR' | null;

type DebugInfo = {
  mode: 'init' | 'ready';
  step:
    | 'start'
    | 'getSession'
    | 'getUser'
    | 'fetchRole'
    | 'subscribe'
    | 'done'
    | 'error'
    | 'timeout';
  lastError?: string;
};

type AuthContextType = {
  user: User | null;
  role: AuthRole;
  ready: boolean;
  loading: boolean; // compat (alguns componentes antigos usam loading)
  signOut: () => void;
  debug: DebugInfo;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type Props = {
  children: React.ReactNode;
  initialUser?: { id: string; email: string | null } | null;
  initialRole?: AuthRole;
};

function AuthProviderImpl({ children, initialUser, initialRole }: Props) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [user, setUser] = useState<User | null>(() => {
    if (!initialUser?.id) return null;
    // Shape mínimo para o app não quebrar enquanto confirma no Supabase
    return { id: initialUser.id, email: initialUser.email ?? undefined } as User;
  });

  const [role, setRole] = useState<AuthRole>(() => initialRole ?? null);
  const [ready, setReady] = useState(false);

  const [debug, setDebug] = useState<DebugInfo>({
    mode: 'init',
    step: 'start',
  });

  // Compat: alguns lugares usam "loading"
  const loading = !ready;

  const resolveRoleFromDb = useCallback(
    async (uid: string) => {
      setDebug((d) => ({ ...d, step: 'fetchRole' }));

      const { data, error } = await supabase
        .from('perfis')
        .select('role')
        .eq('id', uid)
        .maybeSingle();

      if (error) throw error;

      const r = String(data?.role ?? '').toUpperCase();
      if (r === 'ADMIN') return 'ADMIN' as const;
      if (r === 'VENDEDOR') return 'VENDEDOR' as const;
      return null;
    },
    [supabase]
  );

  useEffect(() => {
    let mounted = true;

    // Timeout hard para nunca ficar pendurado
    const t = window.setTimeout(() => {
      if (!mounted) return;
      setDebug((d) => ({ ...d, mode: 'ready', step: 'timeout' }));
      setReady(true);
    }, 2500);

    (async () => {
      try {
        setDebug((d) => ({ ...d, step: 'getSession' }));
        const { data: sess } = await supabase.auth.getSession();
        if (!mounted) return;

        const sessionUser = sess.session?.user ?? null;
        if (sessionUser) setUser(sessionUser);

        setDebug((d) => ({ ...d, step: 'getUser' }));

        // Confirma user (best-effort)
        const { data: u } = await supabase.auth.getUser();
        if (!mounted) return;

        const confirmedUser = u.user ?? sessionUser;
        setUser(confirmedUser ?? null);

        // Role
        if (confirmedUser?.id) {
          const dbRole = await resolveRoleFromDb(confirmedUser.id);
          if (!mounted) return;
          setRole(dbRole);
        } else {
          setRole(null);
        }

        setDebug((d) => ({ ...d, step: 'subscribe' }));

        const { data: sub } = supabase.auth.onAuthStateChange(
          async (_evt, session) => {
            if (!mounted) return;

            const nextUser = session?.user ?? null;
            setUser(nextUser);

            try {
              if (nextUser?.id) {
                const dbRole = await resolveRoleFromDb(nextUser.id);
                if (!mounted) return;
                setRole(dbRole);
              } else {
                setRole(null);
              }
            } catch (e: any) {
              // Não derruba UI por role
              setRole(null);
              setDebug((d) => ({
                ...d,
                lastError: e?.message ?? 'role error',
              }));
            }

            setReady(true);
            setDebug((d) => ({ ...d, mode: 'ready', step: 'done' }));
          }
        );

        // marca pronto
        setReady(true);
        setDebug((d) => ({ ...d, mode: 'ready', step: 'done' }));

        return () => {
          sub.subscription.unsubscribe();
        };
      } catch (e: any) {
        if (!mounted) return;
        setUser(null);
        setRole(null);
        setReady(true);
        setDebug((d) => ({
          ...d,
          mode: 'ready',
          step: 'error',
          lastError: e?.message ?? 'unknown error',
        }));
      } finally {
        window.clearTimeout(t);
      }
    })();

    return () => {
      mounted = false;
      window.clearTimeout(t);
    };
  }, [supabase, resolveRoleFromDb]);

  const signOut = useCallback(() => {
    // Não esperar client signOut (evita hang). Logout definitivo no server route.
    try {
      void supabase.auth.signOut();
    } catch {}

    try {
      localStorage.removeItem('erp-100pharma-auth');
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.clear();
    } catch {}

    window.location.href = '/auth/signout';
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ user, role, ready, loading, signOut, debug }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Named export (para: import { AuthProvider } from ...)
 */
export const AuthProvider = AuthProviderImpl;

/**
 * Default export (para: import AuthProvider from ...)
 * Isso elimina de vez o erro “does not contain a default export”.
 */
export default AuthProviderImpl;

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
