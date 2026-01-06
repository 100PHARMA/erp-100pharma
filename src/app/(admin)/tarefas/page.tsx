import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import TarefasClient from './tarefas-client';

export const dynamic = 'force-dynamic';

export default async function TarefasAdminPage() {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/tarefas');
  }

  // (admin)/layout.tsx já garante ADMIN; aqui só passamos userId para o client.
  return <TarefasClient userId={user.id} />;
}
