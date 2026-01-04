'use client';

import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

// tenta usar o provider, mas não pode travar a app se não existir
import { useAuthContext, type AuthRole } from '@/components/auth/AuthProvider';

type Return = {
  user: User | null;
  role: AuthRole;
  loading: boolean; // para UI
  ready: boolean;   // nunca fica eternamente false
  debug: {
    mode: 'context' | 'fallback';
    step: string;
    lastError?: string;
  };
  signOut: () => void;
};

export function useAuth(): Return {
  let ctx: any = null;
  try {
    ctx = useAuthContext();
  } catch {
    ctx = null;
  }

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  // fallback state
  const [user, setUser] = useState<User | null>(ctx?.user ?? null);
  const [role, setRole] = useState<AuthRole>(ctx?.role ?? 'UNKNOWN');
  const [ready, setReady] = useState<boolean>(!!ctx); // se existe ctx, já é “ready”
  const [debug, setDebug] = useState<Return['debug']>({
    mode: ctx ? 'context' : 'fallback',
    step: ctx ? 'ctx:init' : 'fb:init',
  });

  useEffect(() => {
    // Se tem provider, não deixa “ready” depender de qualquer outra coisa
    if (ctx) {
      setUser(ctx.user ?? null);
      setRole(ctx.role ?? 'UNKNOWN');
      setReady(true);
      setDebug({ mode: 'context', step: 'ctx:ready' });
      return;
    }

    let cancelled = false;

    // Timeout anti “loading eterno”
    const t = setTimeout(() => {
      if (!cancelled) {
        setReady(true);
        setDebug((d) => ({ ...d, step: 'fb:timeout(ready)' }));
      }
    }, 1500);

    async function load() {
      try {
        setDebug({ mode: 'fallback', step: 'fb:getUser:start' });
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          if (!cancelled) {
            setDebug({ mode: 'fallback', step: 'fb:getUser:error', lastError: error.message });
            setUser(null);
            setRole('UNKNOWN');
            setReady(true);
          }
          return;
        }

        if (!cancelled) {
          setUser(data.user ?? null);
          setRole('UNKNOWN');
          setReady(true);
          setDebug({ mode: 'fallback', step: data.user ? 'fb:getUser:ok(user)' : 'fb:getUser:ok(null)' });
        }
      } catch (e: any) {
        if (!cancelled) {
          setUser(null);
          setRole('UNKNOWN');
          setReady(true);
          setDebug({ mode: 'fallback', step: 'fb:getUser:exception', lastError: e?.message ?? String(e) });
        }
      }
    }

    load();

    const { data: sub } = supabase.auth.onAuthStateChange(async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!cancelled) {
          setUser(data.user ?? null);
          setReady(true);
          setDebug({ mode: 'fallback', step: data.user ? 'fb:onChange:user' : 'fb:onChange:null' });
        }
      } catch (e: any) {
        if (!cancelled) {
          setReady(true);
          setDebug({ mode: 'fallback', step: 'fb:onChange:exception', lastError: e?.message ?? String(e) });
        }
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(t);
      sub?.subscription?.unsubscribe();
    };
  }, [ctx, supabase]);

  const signOut = () => {
    window.location.href = '/auth/signout';
  };

  return {
    user,
    role,
    loading: !ready,
    ready,
    debug,
    signOut,
  };
}
