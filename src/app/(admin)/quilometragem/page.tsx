// src/app/(admin)/quilometragem/page.tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';

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
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // No server component não devemos tentar setar cookies aqui.
          // Refresh/rotations são tratadas no middleware.
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/quilometragem`);
  }

  const { data: perfil, error: perfilErr } = await supabase
    .from('perfis')
    .select('id, role, vendedor_id')
    .eq('id', user.id)
    .maybeSingle<Perfil>();

  if (perfilErr) {
    // Se isso falhar, é RLS/policy em perfis (ou tabela não acessível no server).
    // Redireciona para login para evitar estado quebrado.
    redirect(`/login?next=/quilometragem`);
  }

  const role = String(perfil?.role ?? '').toUpperCase().trim();

  if (role !== 'ADMIN') {
    redirect('/portal');
  }

  return <QuilometragemClient initialMes={currentYYYYMM()} />;
}

