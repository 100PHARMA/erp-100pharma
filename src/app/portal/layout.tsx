// src/app/portal/layout.tsx
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import AuthProvider from '@/components/auth/AuthProvider';
import PortalNavbar from '@/components/custom/portal-navbar';

export const dynamic = 'force-dynamic';

export default async function PortalLayout({
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

  const role = String(perfil?.role ?? '').toUpperCase();

  // Segurança: se não for vendedor, manda para o admin (ou dashboard)
  if (role !== 'VENDEDOR') redirect('/dashboard');

  return (
    <AuthProvider
      initialUser={{ id: user.id, email: user.email ?? null }}
      initialRole="VENDEDOR"
    >
      <PortalNavbar />
      <main className="min-h-[calc(100vh-4rem)]">{children}</main>
    </AuthProvider>
  );
}
