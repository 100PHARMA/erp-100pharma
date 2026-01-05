'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LogOut } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

function isActivePath(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href !== '/' && pathname.startsWith(href + '/')) return true;
  return false;
}

export default function PortalNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [email, setEmail] = useState<string>('');
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase.auth.getUser();
      if (!cancelled) setEmail(data.user?.email ?? '');
    }

    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
    };
  }, [supabase]);

  const handleLogout = useCallback(async () => {
    if (logoutLoading) return;

    setLogoutLoading(true);
    try {
      await fetch('/auth/signout', { method: 'POST' });
      router.replace('/login');
      router.refresh();
    } finally {
      setLogoutLoading(false);
    }
  }, [logoutLoading, router]);

  return (
    <div className="bg-indigo-600 text-white">
      <div className="h-16 flex items-center px-4 gap-4">
        <Link href="/portal" className="font-semibold">
          Portal
        </Link>

        <Link
          href="/portal/vendas"
          className={
            isActivePath(pathname, '/portal/vendas')
              ? 'underline underline-offset-4'
              : 'opacity-95 hover:opacity-100'
          }
        >
          Vendas
        </Link>

        <Link
          href="/portal/metas"
          className={
            isActivePath(pathname, '/portal/metas')
              ? 'underline underline-offset-4'
              : 'opacity-95 hover:opacity-100'
          }
        >
          Metas
        </Link>

        <Link
          href="/portal/quilometragem"
          className={
            isActivePath(pathname, '/portal/quilometragem')
              ? 'underline underline-offset-4'
              : 'opacity-95 hover:opacity-100'
          }
        >
          Quilometragem
        </Link>

        <Link
          href="/portal/visitas"
          className={
            isActivePath(pathname, '/portal/visitas')
              ? 'underline underline-offset-4'
              : 'opacity-95 hover:opacity-100'
          }
        >
          Visitas
        </Link>

        <div className="ml-auto flex items-center gap-4">
          <div className="text-right leading-tight">
            <div className="text-sm font-semibold">{email || '—'}</div>
            <div className="text-xs opacity-90">Vendedor</div>
          </div>

          <button
            onClick={handleLogout}
            disabled={logoutLoading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-60"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">{logoutLoading ? 'A sair...' : 'Sair'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
