'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function getHashParams() {
  const hash = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '';
  const params = new URLSearchParams(hash);
  return {
    access_token: params.get('access_token'),
    refresh_token: params.get('refresh_token'),
    type: params.get('type'),
  };
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');

  useEffect(() => {
    (async () => {
      const { access_token, refresh_token, type } = getHashParams();

      if (type !== 'recovery' || !access_token || !refresh_token) {
        setStatus('Link inválido ou expirado. Peça um novo email de recuperação.');
        return;
      }

      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) {
        setStatus('Não consegui validar o link. Peça um novo email de recuperação.');
        return;
      }

      setReady(true);
      setStatus(null);
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    if (!ready) return;

    if (!password || password.length < 8) {
      setStatus('A senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== password2) {
      setStatus('As senhas não coincidem.');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus(error.message);
      return;
    }

    router.replace('/');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900">Definir nova senha</h1>
        <p className="text-sm text-gray-600 mt-1">
          Crie a sua nova senha para entrar no ERP.
        </p>

        {status && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {status}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-700">Nova senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
              placeholder="mínimo 8 caracteres"
              disabled={!ready}
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">Confirmar senha</label>
            <input
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
              disabled={!ready}
            />
          </div>

          <button
            type="submit"
            disabled={!ready}
            className="w-full rounded-xl bg-gray-900 text-white py-3 font-semibold disabled:opacity-50"
          >
            Guardar nova senha
          </button>
        </form>
      </div>
    </div>
  );
}
