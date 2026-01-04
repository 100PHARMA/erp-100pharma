'use client';

import type { User } from '@supabase/supabase-js';
import { useAuthContext, type AuthRole } from '@/components/auth/AuthProvider';

export function useAuth(): {
  user: User | null;
  role: AuthRole;
  loading: boolean;
  ready: boolean;
  signOut: () => void;
} {
  const { user, role, ready } = useAuthContext();

  // loading aqui vira apenas o inverso de ready (porque o server já fornece o initial state)
  const loading = !ready;

  // Logout definitivo é server-side
  const signOut = () => {
    window.location.href = '/auth/signout';
  };

  return { user, role, loading, ready, signOut };
}
