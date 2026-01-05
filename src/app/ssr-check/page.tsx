import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function SSRCheckPage() {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div style={{ padding: 24 }}>
      <h2>SSR Check</h2>
      {user ? (
        <p>SERVER VÊ USER: {user.email}</p>
      ) : (
        <p>SERVER NÃO VÊ USER</p>
      )}
    </div>
  );
}
