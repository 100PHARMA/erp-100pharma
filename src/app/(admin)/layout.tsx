import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: perfil, error } = await supabase
    .from('perfis')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (error) redirect('/login?e=perfil_read');
  const role = String(perfil?.role ?? '').toUpperCase();
  if (!role) redirect('/login?e=perfil_missing');

  if (role !== 'ADMIN') redirect('/portal');

  return <main>{children}</main>;
}
