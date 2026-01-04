// src/components/custom/navbar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type Role = 'ADMIN' | 'VENDEDOR' | 'UNKNOWN';

const LOGO_URL =
  'https://k6hrqrxuu8obbfwn.public.blob.vercel-storage.com/temp/98b4bab4-3285-44fa-9df9-72210bf18f3d.png';

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
  const { user } = useAuth();

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [role, setRole] = useState<Role>('UNKNOWN');
  const [displayName, setDisplayName] = useState<string>('');
  const [email, setEmail] = useState<string>('');

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const moreRef = useRef<HTMLDivElement | null>(null);

  const [tarefasPendentesCount, setTarefasPendentesCount] = useState<number>(0);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const handleLogout = useCallback(() => {
    if (logoutLoading) return;

    // 1) travar UI para evitar duplo clique
    setLogoutLoading(true);

    // 2) NÃO esperar nada do client (evita hang)
    // best-effort para limpar estado local — sem await
    try {
      void supabase.auth.signOut();
    } catch {}

    // 3) Logout definitivo: navegação imediata para rota server que limpa cookies e redireciona
    try {
    // Se algum legado do supabase-js ainda existir, mata aqui
    localStorage.removeItem('erp-100pharma-auth');
    localStorage.removeItem('supabase.auth.token');
    sessionStorage.clear();
    } catch {}
    window.location.href = '/auth/signout';
  }, [logoutLoading, supabase]);

  if (pathname === '/login' || pathname.startsWith('/login/')) return null;

  async function loadTarefasPendentesCount(isAdmin: boolean, vendedorId: string | null) {
    try {
      let q = supabase
        .from('tarefas')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'PENDENTE');

      if (!isAdmin && vendedorId) {
        q = q.eq('responsavel_vendedor_id', vendedorId);
      }

      const { count, error } = await q;
      if (error) return;
      setTarefasPendentesCount(count ?? 0);
    } catch {}
  }

  useEffect(() => {
    let cancelled = false;

    async function loadIdentity() {
      const { data: uRes } = await supabase.auth.getUser();
      const u = user ?? uRes.user ?? null;

      if (!u) {
        if (!cancelled) {
          setRole('UNKNOWN');
          setDisplayName('');
          setEmail('');
          setTarefasPendentesCount(0);
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
      }

      await loadTarefasPendentesCount(resolvedRole === 'ADMIN', perfil?.vendedor_id ?? null);
    }

    loadIdentity();
    const { data: sub } = supabase.auth.onAuthStateChange(() => loadIdentity());

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
    };
  }, [supabase, user?.id]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!moreOpen) return;
      const target = e.target as Node;
      if (moreRef.current && !moreRef.current.contains(target)) setMoreOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMoreOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  const isVendor = role === 'VENDEDOR';
  const menuItems = isVendor ? vendorMenuItems : adminMenuItems;
  const homeHref = isVendor ? '/portal' : '/dashboard';

  const primaryItems = isVendor ? menuItems : menuItems.slice(0, 8);
  const moreItems = isVendor ? [] : menuItems.slice(8);

  const nameToShow = displayName || email || '';

  return (
    <>
      <nav className="hidden lg:block bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-3">
            <Link href={homeHref} className="flex items-center">
              <div className="h-11 w-11 rounded-xl bg-white/10 ring-1 ring-white/20 overflow-hidden flex items-center justify-center">
                <img
                  src={LOGO_URL}
                  alt="100PHARMA"
                  className="h-full w-full object-contain p-1"
                />
              </div>
            </Link>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pr-2">
                {primaryItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActivePath(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cx(
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap',
                        active
                          ? 'bg-white text-blue-600 shadow-lg'
                          : 'text-white hover:bg-blue-500/30'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="hidden xl:inline">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="ml-auto flex-none flex items-center gap-2 pl-4 border-l border-white/20">
              {!isVendor && moreItems.length > 0 && (
                <div className="relative" ref={moreRef}>
                  <button
                    type="button"
                    onClick={() => setMoreOpen((v) => !v)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap text-white hover:bg-blue-500/30"
                    aria-haspopup="menu"
                    aria-expanded={moreOpen}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                    <span className="hidden xl:inline">Mais</span>
                    <ChevronDown className="w-4 h-4 opacity-90" />
                  </button>

                  {moreOpen && (
                    <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white text-gray-900 shadow-xl ring-1 ring-black/10 overflow-hidden z-[9999]">
                      <div className="p-2">
                        <div className="px-3 py-2 text-xs font-semibold text-gray-500">
                          Atalhos
                        </div>

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
                              <span className="flex items-center gap-2">
                                {item.label}
                                {item.href === '/tarefas' && tarefasPendentesCount > 0 && (
                                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold bg-red-600 text-white">
                                    {tarefasPendentesCount}
                                  </span>
                                )}
                              </span>
                            </Link>
                          );
                        })}

                        <div className="my-2 h-px bg-gray-200" />

                        {nameToShow && (
                          <div className="px-3 py-2">
                            <div className="text-sm font-semibold">{nameToShow}</div>
                            <div className="text-xs text-gray-600">
                              {isVendor ? 'Vendedor' : role === 'ADMIN' ? 'Admin' : ''}
                            </div>
                            {email && <div className="text-xs text-gray-500 mt-1">{email}</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={handleLogout}
                disabled={logoutLoading}
                className="min-w-[96px] flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-white hover:bg-red-500/30 transition-colors disabled:opacity-60"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
                <span>{logoutLoading ? 'A sair...' : 'Sair'}</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <nav className="lg:hidden bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-xl sticky top-0 z-50">
        <div className="px-4">
          <div className="flex items-center justify-between h-16">
            <Link href={homeHref} className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-white/10 ring-1 ring-white/20 overflow-hidden flex items-center justify-center">
                <img
                  src={LOGO_URL}
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
              {(displayName || email) && (
                <div className="px-4 py-3 mb-2 bg-blue-600/50 rounded-lg">
                  <p className="text-sm font-semibold">{displayName || email}</p>
                  <p className="text-xs opacity-90">
                    {isVendor ? 'Vendedor' : role === 'ADMIN' ? 'Admin' : ''}
                  </p>
                </div>
              )}

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
                    <span className="flex items-center gap-2">
                      {item.label}
                      {!isVendor && item.href === '/tarefas' && tarefasPendentesCount > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold bg-red-600 text-white">
                          {tarefasPendentesCount}
                        </span>
                      )}
                    </span>
                  </Link>
                );
              })}

              <button
                onClick={handleLogout}
                disabled={logoutLoading}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold text-white hover:bg-red-500/30 transition-colors mt-2 disabled:opacity-60"
              >
                <LogOut className="w-5 h-5" />
                <span>{logoutLoading ? 'A sair...' : 'Sair'}</span>
              </button>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
