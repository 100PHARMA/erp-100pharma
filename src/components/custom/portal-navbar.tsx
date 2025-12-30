'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { LogOut } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type Role = 'ADMIN' | 'VENDEDOR' | 'UNKNOWN';

function isActivePath(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href !== '/' && pathname.startsWith(href + '/')) return true;
  return false;
}

export default function PortalNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [role, setRole] = useState<Role>('UNKNOWN');
  const [displayName, setDisplayName] = useState<string>('');

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  useEffect(() => {
    let cancelled = false;

    async function loadIdentity() {
      try {
        const userId = user?.id || (await supabase.auth.getUser()).data.user?.id;
        const email = user?.email || (await supabase.auth.getUser()).data.user?.email || '';

        if (!userId) {
          if (!cancelled) {
            setRole('UNKNOWN');
            setDisplayName('');
          }
          return;
        }

        const { data: perfil, error } = await supabase
          .from('perfis')
          .select('role, vendedor_id')
          .eq('id', userId)
          .maybeSingle();

        if (error) {
          if (!cancelled) {
            setRole('UNKNOWN');
            setDisplayName(email);
          }
          return;
        }

        const r = String(perfil?.role ?? '').toUpperCase();
        const resolvedRole: Role =
          r === 'ADMIN' ? 'ADMIN' : r === 'VENDEDOR' ? 'VENDEDOR' : 'UNKNOWN';

        let name = (user?.user_metadata?.nome ?? '').trim();

        // Se for vendedor e tiver vendedor_id, buscar nome em vendedores
        if (resolvedRole === 'VENDEDOR' && perfil?.vendedor_id) {
          const { data: vend, error: vErr } = await supabase
            .from('vendedores')
            .select('nome')
            .eq('id', perfil.vendedor_id)
            .maybeSingle();

          if (!vErr) {
            const vendNome = String(vend?.nome ?? '').trim();
            if (vendNome) name = vendNome;
          }
        }

        if (!name) name = email;

        if (!cancelled) {
          setRole(resolvedRole);
          setDisplayName(name);
        }
      } catch {
        // fallback mínimo
        if (!cancelled) {
          setRole('UNKNOWN');
          setDisplayName(user?.email ?? '');
        }
      }
    }

    loadIdentity();

    return () => {
      cancelled = true;
    };
  }, [supabase, user?.id, user?.email, user?.user_metadata]);

  return (
    <div className="h-16 bg-indigo-600 text-white flex items-center px-4 gap-4">
      <Link href="/portal" className="font-semibold">
        Portal
      </Link>

      <Link
        href="/portal/vendas"
        className={isActivePath(pathname, '/portal/vendas') ? 'underline underline-offset-4' : 'opacity-95 hover:opacity-100'}
      >
        Vendas
      </Link>

      <Link
        href="/portal/metas"
        className={isActivePath(pathname, '/portal/metas') ? 'underline underline-offset-4' : 'opacity-95 hover:opacity-100'}
      >
        Metas
      </Link>

      <Link
        href="/portal/quilometragem"
        className={isActivePath(pathname, '/portal/quilometragem') ? 'underline underline-offset-4' : 'opacity-95 hover:opacity-100'}
      >
        Quilometragem
      </Link>

      <Link
        href="/portal/visitas"
        className={isActivePath(pathname, '/portal/visitas') ? 'underline underline-offset-4' : 'opacity-95 hover:opacity-100'}
      >
        Visitas
      </Link>

      <div className="ml-auto flex items-center gap-4">
        {/* Identidade do logado */}
        <div className="text-right leading-tight">
          <div className="text-sm font-semibold">{displayName || user?.email || '—'}</div>
          <div className="text-xs opacity-90">{role === 'VENDEDOR' ? 'Vendedor' : role === 'ADMIN' ? 'Admin' : ''}</div>
        </div>

        <button
          onClick={handleLogout}
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
