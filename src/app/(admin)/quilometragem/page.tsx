import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import QuilometragemClient from './quilometragem-client';

export const dynamic = 'force-dynamic';

type Perfil = {
  id: string;
  role: string | null;
  vendedor_id: string | null;
};

function currentYYYYMM() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export default async function QuilometragemAdminPage() {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/quilometragem');
  }

  // (admin)/layout.tsx já garante ADMIN, mas mantemos a checagem
  // aqui como proteção extra para acesso direto à rota.
  const { data: perfil, error: perfilErr } = await supabase
    .from('perfis')
    .select('id, role, vendedor_id')
    .eq('id', user.id)
    .maybeSingle<Perfil>();

  if (perfilErr) {
    redirect('/login?e=perfil_read&next=/quilometragem');
  }

  const role = String(perfil?.role ?? '').toUpperCase().trim();
  if (role !== 'ADMIN') {
    redirect('/portal');
  }

  return <QuilometragemClient initialMes={currentYYYYMM()} />;
}
