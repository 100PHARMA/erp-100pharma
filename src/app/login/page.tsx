export const dynamic = 'force-dynamic';

type Props = {
  searchParams?: { next?: string; e?: string };
};

export default function LoginPage({ searchParams }: Props) {
  const next = searchParams?.next ? decodeURIComponent(searchParams.next) : '/after-login';
  const errorMsg = searchParams?.e ? decodeURIComponent(searchParams.e) : null;

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <form
        method="post"
        action={`/auth/sign-in?next=${encodeURIComponent(next)}`}
        style={{ width: 360, display: 'grid', gap: 12 }}
      >
        <h1 style={{ margin: 0, fontSize: 24 }}>Login</h1>

        {errorMsg && (
          <div style={{ padding: 12, borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b' }}>
            {errorMsg}
          </div>
        )}

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
