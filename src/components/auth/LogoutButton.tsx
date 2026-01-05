'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onLogout = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      await fetch('/auth/signout', { method: 'POST' });
      router.replace('/login');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }, [loading, router]);

  return (
    <button onClick={onLogout} disabled={loading} className={className}>
      {loading ? 'A sair…' : 'Sair'}
    </button>
  );
}
