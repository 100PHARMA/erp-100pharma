// src/app/(admin)/layout.tsx
import { redirect } from 'next/navigation';
import NavbarGate from '@/components/custom/navbar-gate';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 🔒 Auth gate SERVER-SIDE (fonte única)
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Não logado → login
  if (!user) {
    redirect('/login');
  }

  // Role gate
  const { data: perfil } = await supabase
    .from('perfis')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = String(perfil?.role ?? '').toUpperCase();

  // Não é ADMIN → portal
  if (role !== 'ADMIN') {
    redirect('/portal');
  }

  // UI só renderiza se passou nos gates acima
  return (
    <>
      <NavbarGate />
      <main className="min-h-[calc(100vh-4rem)]">
        {children}
      </main>
    </>
  );
}
