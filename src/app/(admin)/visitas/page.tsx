// src/app/(admin)/visitas/page.tsx
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import VisitasClient from './visitas-client';

export const dynamic = 'force-dynamic';

export default async function VisitasAdminPage() {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?next=/visitas');

  // OBS: (admin)/layout.tsx já garante role ADMIN.
  // Aqui só garantimos user para entregar userId ao client.
  return <VisitasClient userId={user.id} />;
}
