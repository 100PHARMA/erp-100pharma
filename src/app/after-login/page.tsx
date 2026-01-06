import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Perfil = { role: string | null };

export default async function AfterLoginPage() {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?e=session_missing');

  const { data: perfil, error } = await supabase
    .from('perfis')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<Perfil>();

  if (error) redirect('/login?e=perfil_read');

  const role = String(perfil?.role ?? '').toUpperCase().trim();
  if (role === 'ADMIN') redirect('/dashboard');
  if (role === 'VENDEDOR') redirect('/portal');

  // Se não tem role válido, não deixa entrar “meio logado”.
  redirect('/login?e=perfil_missing');
}
