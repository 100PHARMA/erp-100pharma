'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export default function AfterLoginPage() {
  const supabase = createSupabaseBrowserClient();
  const [state, setState] = useState('A verificar sessão...');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        setState('SEM SESSÃO');
      } else {
        setState(`LOGADO COMO: ${data.user.email}`);
      }
    });
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h2>After Login</h2>
      <p>{state}</p>
    </div>
  );
}
