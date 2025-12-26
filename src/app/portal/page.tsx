import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function PortalPage() {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    redirect('/login');
  }

  const { data: perfil, error: perfilErr } = await supabase
    .from('perfis')
    .select('role')
    .eq('id', user.id)
    .single();

  const email = user.email ?? '—';
  const role = perfilErr ? '—' : (perfil?.role ?? '—');

  async function signOut() {
    'use server';
    const supabase = createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect('/login');
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

            <form action={signOut}>
              <button
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                type="submit"
              >
                Sair
              </button>
            </form>
          </div>

          <div className="mt-6 space-y-3">
            {perfilErr ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                Erro ao buscar perfil (perfis): {perfilErr.message}
              </div>
            ) : null}

            <div className="rounded-lg bg-gray-50 p-4">
              <div className="text-xs font-medium text-gray-500">Email</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">{email}</div>
            </div>

            <div className="rounded-lg bg-gray-50 p-4">
              <div className="text-xs font-medium text-gray-500">Role</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">{role}</div>
            </div>

            <div className="pt-2">
              <Link
                href="/portal/visitas"
                className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
              >
                Visitas
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          Produção: erp-100pharma (Next.js App Router + Supabase Auth/RLS) — rota /portal mínima.
        </div>
      </div>
    </main>
  );
}
