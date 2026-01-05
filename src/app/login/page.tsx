'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (loading) return;
    setLoading(true);
    setMsg('A autenticar (SSR)...');

    try {
      const r = await fetch('/auth/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok) {
        setMsg(data?.error ?? 'Erro no login');
        setLoading(false);
        return;
      }

      setMsg('Login OK');
      router.replace('/ssr-check'); // primeiro valida SSR
      router.refresh();
    } catch (e: any) {
      setMsg(e?.message ?? 'Erro inesperado');
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 360 }}>
      <h2>Login</h2>

      <input
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ display: 'block', width: '100%', marginBottom: 8 }}
      />

      <input
        type="password"
        placeholder="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ display: 'block', width: '100%', marginBottom: 8 }}
      />

      <button onClick={handleLogin} disabled={loading}>
        {loading ? 'A entrar…' : 'Entrar'}
      </button>

      <p>{msg}</p>
    </div>
  );
}
