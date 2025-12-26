// erp-100pharma/src/app/auth/callback/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function parseHashParams(hash: string) {
  const h = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(h);
  return {
    access_token: params.get('access_token') || '',
    refresh_token: params.get('refresh_token') || '',
    type: params.get('type') || '',
    error: params.get('error') || '',
    error_code: params.get('error_code') || '',
    error_description: params.get('error_description') || '',
  };
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [msg, setMsg] = useState('A validar sessão...');

  useEffect(() => {
    const run = async () => {
      try {
        const { access_token, refresh_token, type, error, error_description } =
          parseHashParams(window.location.hash);

        if (error) {
          setMsg(`Erro: ${decodeURIComponent(error_description || error)}`);
          // manda pro login com mensagem simples
          router.replace(`/login?error=${encodeURIComponent(error_description || error)}`);
          return;
        }

        if (!access_token || !refresh_token) {
          setMsg('Link inválido ou incompleto (tokens ausentes).');
          router.replace('/login');
          return;
        }

        const { error: setErr } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (setErr) {
          setMsg(`Falha ao criar sessão: ${setErr.message}`);
          router.replace('/login');
          return;
        }

        // Limpa o hash (boa prática)
        window.history.replaceState(null, '', '/auth/callback');

        if (type === 'recovery') {
          router.replace('/reset-password');
        } else {
          router.replace('/');
        }
      } catch (e: any) {
        setMsg(`Erro inesperado: ${e?.message || 'desconhecido'}`);
        router.replace('/login');
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Aguarde</h1>
        <p className="text-gray-600">{msg}</p>
      </div>
    </div>
  );
}
