'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

type Perfil = {
  role: 'ADMIN' | 'VENDEDOR' | string;
};

export default function PortalPage() {
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anon) {
      // Falha explícita (melhor do que “funcionar” silenciosamente e esconder o problema)
      throw new Error(
        'Faltam variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.',
      );
    }

    return createClient(url, anon);
  }, []);

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setErrorMsg(null);

      // 1) User autenticado (middleware já deve garantir, mas não confiamos cegamente)
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (!isMounted) return;

      if (userErr) {
        setErrorMsg(userErr.message);
        setLoading(false);
        return;
      }

      const user = userData?.user;
      if (!user) {
        // Se isso acontecer, o middleware não aplicou (ou token expirou).
        window.location.href = '/login';
        return;
      }

      setEmail(user.email ?? null);

      // 2) Perfil (role) vindo de public.perfis
      const { data: perfil, error: perfilErr } = await supabase
        .from('perfis')
        .select('role')
        .eq('id', user.id)
        .single<Perfil>();

      if (!isMounted) return;

      if (perfilErr) {
        // Importante: não “engolir” o erro, porque isso é peça crítica de segurança.
        setErrorMsg(`Erro ao buscar perfil (perfis): ${perfilErr.message}`);
        setRole(null);
        setLoading(false);
        return;
      }

      setRole(perfil?.role ?? null);
      setLoading(false);
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  async function handleSignOut() {
    setErrorMsg(null);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setErrorMsg(`Erro ao sair: ${error.message}`);
      return;
    }
    window.location.href = '/login';
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Portal do Vendedor</h1>
              <p className="mt-1 text-sm text-gray-600">
                Área mínima para validação de segurança (RLS + middleware + perfis).
              </p>
            </div>

            <button
              onClick={handleSignOut}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
              type="button"
            >
              Sair
            </button>
          </div>

          <div className="mt-6 space-y-3">
            {loading ? (
              <div className="rounded-lg bg-gray-100 p-4 text-sm text-gray-700">
                A carregar dados do utilizador…
              </div>
            ) : errorMsg ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {errorMsg}
              </div>
            ) : (
              <>
                <div className="rounded-lg bg-gray-50 p-4">
                  <div className="text-xs font-medium text-gray-500">Email</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">
                    {email ?? '—'}
                  </div>
                </div>

                <div className="rounded-lg bg-gray-50 p-4">
                  <div className="text-xs font-medium text-gray-500">Role</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">
                    {role ?? '—'}
                  </div>
                </div>

                <div className="pt-2">
                  <Link
                    href="/portal/visitas"
                    className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
                  >
                    Visitas
                  </Link>

                  <p className="mt-2 text-xs text-gray-600">
                    (Ainda vamos criar /portal/visitas na etapa 3. Por agora, este link pode dar 404.)
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          Produção: erp-100pharma (Next.js App Router + Supabase Auth/RLS) — rota /portal mínima.
        </div>
      </div>
    </main>
  );
}
