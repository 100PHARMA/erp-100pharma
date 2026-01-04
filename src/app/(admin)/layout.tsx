// src/app/(admin)/layout.tsx
import { redirect } from 'next/navigation';
import NavbarGate from '@/components/custom/navbar-gate';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import AuthProvider, { type AuthRole } from '@/components/auth/AuthProvider';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: perfil } = await supabase
    .from('perfis')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = String(perfil?.role ?? '').toUpperCase() as AuthRole;

  if (role !== 'ADMIN') redirect('/portal');

  return (
    <AuthProvider
      initialUser={{ id: user.id, email: user.email ?? null }}
      initialRole="ADMIN"
    >
      <NavbarGate />
      <main className="min-h-[calc(100vh-4rem)]">{children}</main>
    </AuthProvider>
  );
}
