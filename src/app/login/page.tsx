import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams?: { next?: string };
};

export default function LoginPage({ searchParams }: Props) {
  async function signIn(formData: FormData) {
    'use server';

    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    if (!email || !password) redirect('/login?e=missing_credentials');

    const supabase = createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) redirect(`/login?e=${encodeURIComponent(error.message)}`);

    const next = searchParams?.next ? decodeURIComponent(searchParams.next) : '/after-login';
    redirect(next);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <form action={signIn} style={{ width: 360, display: 'grid', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Login</h1>

        <input
          name="email"
          type="email"
          placeholder="Email"
          autoComplete="email"
          required
          style={{ padding: 12, borderRadius: 8, border: '1px solid #ddd' }}
        />

        <input
          name="password"
          type="password"
          placeholder="Senha"
          autoComplete="current-password"
          required
          style={{ padding: 12, borderRadius: 8, border: '1px solid #ddd' }}
        />

        <button
          type="submit"
          style={{
            padding: 12,
            borderRadius: 8,
            border: 0,
            background: '#111827',
            color: 'white',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Entrar
        </button>
      </form>
    </div>
  );
}
