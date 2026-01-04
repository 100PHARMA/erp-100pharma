'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

function isActivePath(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href !== '/' && pathname.startsWith(href + '/')) return true;
  return false;
}

export default function PortalNavbar() {
  const pathname = usePathname();
  const { user, role, ready, signOut, debug } = useAuth();
  const router = useRouter();
const [logoutLoading, setLogoutLoading] = useState(false);

const handleLogout = useCallback(async () => {
  if (logoutLoading) return;

  setLogoutLoading(true);
  try {
    // IMPORTANTE: chama a rota server que limpa cookies sb-*
    await fetch('/auth/signout', { method: 'POST' });

    router.replace('/login');
    router.refresh();
  } finally {
    setLogoutLoading(false);
  }
}, [logoutLoading, router]);


  // Nunca fica “a carregar” eternamente, por causa do timeout do hook.
  if (!ready) {
    return (
      <div className="h-16 bg-indigo-600 text-white flex items-center px-4">
        A carregar...
      </div>
    );
  }

  // Se ready e não tem user, não fica preso: força login
  if (!user) {
    return (
      <div className="h-16 bg-indigo-600 text-white flex items-center justify-between px-4">
        <div>
          Sessão não disponível no client. ({debug.mode} / {debug.step})
          {debug.lastError ? ` — ${debug.lastError}` : ''}
        </div>
        <a className="underline" href="/login">
          Ir para login
        </a>
      </div>
    );
  }

  const displayName = user.email ?? '—';

  return (
    <div className="bg-indigo-600 text-white">
      {/* DEBUG (remover depois) */}
      <div className="text-[11px] opacity-90 px-4 py-1 border-b border-white/15">
        debug: {debug.mode} / {debug.step}
        {debug.lastError ? ` — ${debug.lastError}` : ''}
      </div>

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
            <div className="text-sm font-semibold">{displayName}</div>
            <div className="text-xs opacity-90">
              {role === 'VENDEDOR' ? 'Vendedor' : role === 'ADMIN' ? 'Admin' : ''}
            </div>
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
