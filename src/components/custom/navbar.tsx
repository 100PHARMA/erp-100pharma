// src/components/custom/navbar.tsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  FileText,
  Users,
  UserCircle,
  TrendingUp,
  MapPin,
  Target,
  DollarSign,
  Trophy,
  Settings,
  Menu,
  X,
  Building2,
  ShoppingBag,
  Calendar,
  User,
  Car,
  LogOut,
  Wallet,
  Home,
  MoreHorizontal,
  ChevronDown,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type Role = 'ADMIN' | 'VENDEDOR' | 'UNKNOWN';

const adminMenuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/produtos', label: 'Produtos', icon: Package },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/fornecedores', label: 'Fornecedores', icon: Building2 },
  { href: '/compras', label: 'Compras', icon: ShoppingBag },
  { href: '/vendedores', label: 'Vendedores', icon: UserCircle },
  { href: '/vendas', label: 'Vendas', icon: ShoppingCart },
  { href: '/faturas', label: 'Faturas', icon: FileText },
  { href: '/comissoes', label: 'Comissões', icon: TrendingUp },

  // a partir daqui vai para "Mais"
  { href: '/financeiro', label: 'Financeiro', icon: Wallet },
  { href: '/tarefas', label: 'Tarefas', icon: Calendar },
  { href: '/visitas', label: 'Visitas', icon: MapPin },
  { href: '/quilometragem', label: 'Quilometragem', icon: Car },
  { href: '/podologistas', label: 'Podologistas', icon: User },
  { href: '/metas', label: 'Metas', icon: Target },
  { href: '/contas-a-receber', label: 'Contas a Receber', icon: DollarSign },
  { href: '/concursos', label: 'Concursos', icon: Trophy },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
];

const vendorMenuItems = [
  { href: '/portal', label: 'Início', icon: Home },
  { href: '/portal/vendas', label: 'Vendas', icon: ShoppingCart },
  { href: '/portal/visitas', label: 'Visitas', icon: MapPin },
  { href: '/portal/quilometragem', label: 'Quilometragem', icon: Car },
  { href: '/portal/metas', label: 'Metas', icon: Target },
];

function isActivePath(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href !== '/' && pathname.startsWith(href + '/')) return true;
  return false;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [role, setRole] = useState<Role>('UNKNOWN');
  const [displayName, setDisplayName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [loadingIdentity, setLoadingIdentity] = useState(true);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  // Não renderiza no /login
  if (pathname === '/login' || pathname.startsWith('/login/')) return null;

  useEffect(() => {
    let cancelled = false;

    async function loadIdentity() {
      setLoadingIdentity(true);

      const { data: uRes } = await supabase.auth.getUser();
      const u = user ?? uRes.user ?? null;

      if (!u) {
        if (!cancelled) {
          setRole('UNKNOWN');
          setDisplayName('');
          setEmail('');
          setLoadingIdentity(false);
        }
        return;
      }

      const userId = u.id;
      const userEmail = u.email ?? '';
      if (!cancelled) setEmail(userEmail);

      const { data: perfil } = await supabase
        .from('perfis')
        .select('role, vendedor_id')
        .eq('id', userId)
        .maybeSingle();

      const r = String(perfil?.role ?? '').toUpperCase();
      const resolvedRole: Role =
        r === 'ADMIN' ? 'ADMIN' : r === 'VENDEDOR' ? 'VENDEDOR' : 'UNKNOWN';

      let name = String((u.user_metadata as any)?.nome ?? '').trim();

      if (resolvedRole === 'VENDEDOR' && perfil?.vendedor_id) {
        const { data: vend } = await supabase
          .from('vendedores')
          .select('nome')
          .eq('id', perfil.vendedor_id)
          .maybeSingle();

        const vendNome = String(vend?.nome ?? '').trim();
        if (vendNome) name = vendNome;
      }

      if (!name) name = userEmail;

      if (!cancelled) {
        setRole(resolvedRole);
        setDisplayName(name);
        setLoadingIdentity(false);
      }
    }

    loadIdentity();

    const { data: sub } = supabase.auth.onAuthStateChange(() => loadIdentity());

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
    };
  }, [supabase, user?.id]);

  const isVendor = role === 'VENDEDOR';
  const menuItems = isVendor ? vendorMenuItems : adminMenuItems;
  const homeHref = isVendor ? '/portal' : '/dashboard';

  // ERP real: poucos itens visíveis + "Mais"
  const primaryItems = isVendor ? menuItems : menuItems.slice(0, 9);
  const moreItems = isVendor ? [] : menuItems.slice(9);

  return (
    <>
      {/* Desktop */}
      <nav className="hidden lg:block bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3">
            {/* LOGO apenas (sem texto 100PHARMA) */}
            <Link href={homeHref} className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-white/10 ring-1 ring-white/20 overflow-hidden flex items-center justify-center">
                <img
                  src="https://k6hrqrxuu8obbfwn.public.blob.vercel-storage.com/temp/98b4bab4-3285-44fa-9df9-72210bf18f3d.png"
                  alt="100PHARMA"
                  className="h-full w-full object-contain p-1"
                />
              </div>
            </Link>

            {/* Menus principais */}
            <div className="flex items-center gap-1 min-w-0">
              {primaryItems.map((item) => {
                const Icon = item.icon;
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cx(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap',
                      active ? 'bg-white text-blue-600 shadow-lg' : 'text-white hover:bg-blue-500/30'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden xl:inline">{item.label}</span>
                  </Link>
                );
              })}

              {/* Dropdown "Mais" (remove aqueles “…” feios de overflow) */}
              {!isVendor && moreItems.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMoreOpen((v) => !v)}
                    className={cx(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap',
                      'text-white hover:bg-blue-500/30'
                    )}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                    <span className="hidden xl:inline">Mais</span>
                    <ChevronDown className="w-4 h-4 opacity-90" />
                  </button>

                  {moreOpen && (
                    <div
                      className="absolute left-0 mt-2 w-72 rounded-xl bg-white text-gray-900 shadow-xl ring-1 ring-black/10 overflow-hidden z-50"
                      onMouseLeave={() => setMoreOpen(false)}
                    >
                      <div className="p-2">
                        {moreItems.map((item) => {
                          const Icon = item.icon;
                          const active = isActivePath(pathname, item.href);
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setMoreOpen(false)}
                              className={cx(
                                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition',
                                active ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50'
                              )}
                            >
                              <Icon className="w-4 h-4" />
                              <span>{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Direita: identidade + sair (isolado do menu) */}
<div className="ml-auto flex items-center gap-4 pl-4 border-l border-white/20 shrink-0">
  <div className="text-sm text-right leading-tight hidden xl:block">
    <div className="font-semibold">
      {displayName || email || '—'}
    </div>
    <div className="text-xs opacity-90">
      {isVendor ? 'Vendedor' : role === 'ADMIN' ? 'Admin' : ''}
    </div>
  </div>

  <button
    onClick={handleLogout}
    className="min-w-[88px] flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-white hover:bg-red-500/30 transition-colors"
    title="Sair"
  >
    <LogOut className="w-4 h-4" />
    <span>Sair</span>
  </button>
</div>
          </div>
        </div>
      </nav>

      {/* Mobile */}
      <nav className="lg:hidden bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-xl sticky top-0 z-50">
        <div className="px-4">
          <div className="flex items-center justify-between h-16">
            <Link href={homeHref} className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-white/10 ring-1 ring-white/20 overflow-hidden flex items-center justify-center">
                <img
                  src="https://k6hrqrxuu8obbfwn.public.blob.vercel-storage.com/temp/98b4bab4-3285-44fa-9df9-72210bf18f3d.png"
                  alt="100PHARMA"
                  className="h-full w-full object-contain p-1"
                />
              </div>
            </Link>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-blue-500/30 transition-colors"
              aria-label="Abrir menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-blue-500/30 bg-blue-700/95 backdrop-blur-sm">
            <div className="px-4 py-4 space-y-1 max-h-[calc(100vh-4rem)] overflow-y-auto">
              <div className="px-4 py-3 mb-2 bg-blue-600/50 rounded-lg">
                <p className="text-sm font-semibold">{displayName || email || '—'}</p>
                <p className="text-xs opacity-90">
                  {isVendor ? 'Vendedor' : role === 'ADMIN' ? 'Admin' : ''}
                </p>
              </div>

              {menuItems.map((item) => {
                const Icon = item.icon;
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cx(
                      'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition',
                      active ? 'bg-white text-blue-600 shadow-lg' : 'text-white hover:bg-blue-600/50'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold text-white hover:bg-red-500/30 transition-colors mt-2"
              >
                <LogOut className="w-5 h-5" />
                <span>Sair</span>
              </button>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
