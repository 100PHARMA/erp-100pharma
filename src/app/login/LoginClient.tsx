'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function safeInternalPath(input: string | null | undefined): string | null {
  if (!input) return null;
  // segurança mínima: só permite redirects internos
  if (input.startsWith('/')) return input;
  return null;
}

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // O middleware usa `next`. Mantemos fallback para `redirect` por compatibilidade.
  const nextPath = useMemo(() => {
    const next = safeInternalPath(searchParams?.get('next'));
    const redirect = safeInternalPath(searchParams?.get('redirect'));
    return next || redirect; // pode ser null
  }, [searchParams]);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!isEmail(email)) {
      setErro('Email inválido.');
      return;
    }
    if (!password || password.length < 6) {
      setErro('Password inválida (mínimo 6 caracteres).');
      return;
    }

    setLoading(true);
    try {
      // Client browser da @supabase/ssr escreve sessão em cookies
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      const userId = data.user?.id;
      if (!userId) {
        setErro('Login efetuado, mas não foi possível identificar o utilizador.');
        return;
      }

      // Fonte única: public.perfis
      const { data: perfil, error: perfilError } = await supabase
        .from('perfis')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (perfilError) {
        throw new Error(`Erro ao carregar perfil: ${perfilError.message}`);
      }

      const role = String(perfil?.role ?? '').toUpperCase();

      let target = '/dashboard';

      if (role === 'VENDEDOR') {
        target = '/portal';
      } else if (role === 'ADMIN') {
        target = nextPath || '/dashboard';
      } else {
        // Segurança: não joga para área errada se role estiver ausente/inválida
        setErro('Perfil sem role definido (ADMIN|VENDEDOR). Verifique public.perfis.');
        return;
      }

      router.replace(target);
      router.refresh();
    } catch (e: any) {
      setErro(e?.message || 'Falha no login.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900">Entrar</h1>
        <p className="text-gray-600 mt-1">Acesso ao ERP 100PHARMA</p>

        {erro && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {erro}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Email
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ex: paulo@100pharma.pt"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Password
            </label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gray-900 text-white font-semibold py-3 hover:opacity-95 disabled:opacity-60"
          >
            {loading ? 'A entrar...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-4 text-xs text-gray-500">
          Se você chegou aqui por uma página protegida, será redirecionado após login.
        </div>
      </div>
    </div>
  );
}
