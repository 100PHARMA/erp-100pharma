import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function SSRDebugPage() {
  const cookieStore = cookies();
  const all = cookieStore.getAll();

  const sbCookies = all
    .filter((c) => c.name.startsWith('sb-'))
    .map((c) => ({
      name: c.name,
      valuePreview: (c.value || '').slice(0, 20) + '...',
    }));

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  return (
    <div style={{ padding: 24, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
      <h1>SSR Debug</h1>

      <h2>Cookies sb-* recebidos no request</h2>
      <pre>{JSON.stringify(sbCookies, null, 2)}</pre>

      <h2>supabase.auth.getUser() no SERVER</h2>
      <pre>{JSON.stringify({ user: data?.user?.email ?? null, error: error?.message ?? null }, null, 2)}</pre>

      <p style={{ marginTop: 16 }}>
        Se aparecer sb-* acima, mas user for null, o cookie não está no formato esperado pelo SSR (ou está inválido/expirado).
        Se sb-* não aparecer, o cookie não está sendo enviado ao SSR.
      </p>
    </div>
  );
}
