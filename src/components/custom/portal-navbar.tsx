'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

function isActivePath(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href !== '/' && pathname.startsWith(href + '/')) return true;
  return false;
}

export default function PortalNavbar() {
  const pathname = usePathname();
  const { user, role, ready, signOut } = useAuth();

  if (!ready) {
    return (
      <div className="h-16 bg-indigo-600 text-white flex items-center px-4">
        A carregar...
      </div>
    );
  }

  // Se por algum motivo o client não tem user, força re-login
  // (o server ainda pode estar autenticado, mas o client não consegue operar com RLS)
  if (!user) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return null;
  }

  const displayName = user.email ?? '—';

  return (
    <div className="h-16 bg-indigo-600 text-white flex items-center px-4 gap-4">
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
          onClick={signOut}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          title="Sair"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm font-medium">Sair</span>
        </button>
      </div>
    </div>
  );
}
