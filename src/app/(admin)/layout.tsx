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
  const supabase = createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: perfil } = await supabase
    .from('perfis')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = String(perfil?.role ?? '').toUpperCase();
  if (role !== 'ADMIN') redirect('/portal');

  return (
    <>
      <NavbarGate />
      <main className="min-h-[calc(100vh-4rem)]">{children}</main>
    </>
  );
}
