// src/components/custom/navbar.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Package,
  Users,
  Truck,
  ShoppingCart,
  UserRound,
  Receipt,
  BadgePercent,
  Landmark,
  ListTodo,
  MapPin,
  Route,
  Stethoscope,
  Target,
  HandCoins,
  Trophy,
  Settings,
  Menu,
  X,
  LogOut,
  ChevronDown,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';

type AppRole = 'ADMIN' | 'VENDEDOR';

type PerfilRow = {
  role: string;
  vendedor_id: string | null;
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(href + '/');
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [userLabel, setUserLabel] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Fecha menus quando muda rota
  useEffect(() => {
    setMobileOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (!alive) return;

      if (userErr || !userRes?.user) {
        setRole(null);
        setLoading(false);
        return;
      }

      const user = userRes.user;
      setUserEmail(user.email ?? '');

      // Nome: prioriza user_metadata.nome, senão email (sem “poluir”)
      const nome = (user.user_metadata as any)?.nome as string | undefined;
      setUserLabel(nome?.trim() ? nome.trim() : (user.email ?? 'Utilizador'));

      // Role via perfis
      const { data: perfil, error: perfilErr } = await supabase
        .from('perfis')
        .select('role, vendedor_id')
        .eq('id', user.id)
        .maybeSingle<PerfilRow>();

      if (!alive) return;

      if (perfilErr || !perfil?.role) {
        // Falha de perfil = não assume ADMIN por padrão (seria um erro grave de segurança)
        setRole(null);
        setLoading(false);
        return;
      }

      const r = String(perfil.role || '').toUpperCase();
      setRole(r === 'ADMIN' ? 'ADMIN' : 'VENDEDOR');
      setLoading(false);
    }

    load();

    const { data: sub } = supabase.auth.onAuthStateChange((_event) => {
      load();
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const adminNav: NavItem[] = useMemo(
    () => [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/produtos', label: 'Produtos', icon: Package },
      { href: '/clientes', label: 'Clientes', icon: Users },
      { href: '/fornecedores', label: 'Fornecedores', icon: Truck },
      { href: '/compras', label: 'Compras', icon: ShoppingCart },
      { href: '/vendedores', label: 'Vendedores', icon: UserRound },
      { href: '/vendas', label: 'Vendas', icon: ShoppingCart },
      { href: '/faturas', label: 'Faturas', icon: Receipt },
      { href: '/comissoes', label: 'Comissões', icon: BadgePercent },
      { href: '/financeiro', label: 'Financeiro', icon: Landmark },
      { href: '/contas-a-receber', label: 'Contas a Receber', icon: HandCoins },
      { href: '/tarefas', label: 'Tarefas', icon: ListTodo },
      { href: '/visitas', label: 'Visitas', icon: MapPin },
      { href: '/quilometragem', label: 'Quilometragem', icon: Route },
      { href: '/podologistas', label: 'Podologistas', icon: Stethoscope },
      { href: '/metas', label: 'Metas', icon: Target },
      { href: '/concursos', label: 'Concursos', icon: Trophy },
      { href: '/configuracoes', label: 'Configurações', icon: Settings },
    ],
    []
  );

  const vendedorNav: NavItem[] = useMemo(
    () => [
      { href: '/portal', label: 'Portal', icon: LayoutDashboard },
      { href: '/portal/vendas', label: 'Vendas', icon: ShoppingCart },
      { href: '/portal/metas', label: 'Metas', icon: Target },
      { href: '/portal/quilometragem', label: 'Quilometragem', icon: Route },
      { href: '/portal/visitas', label: 'Visitas', icon: MapPin },
    ],
    []
  );

  const nav = role === 'ADMIN' ? adminNav : vendedorNav;

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  // Evita “piscar” navbar sem role definido
  if (loading) return null;
  if (!role) return null;

  const isAdmin = role === 'ADMIN';

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-gradient-to-r from-indigo-700 via-indigo-600 to-violet-700">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6">
        <div className="flex h-16 items-center gap-3">
          {/* Logo (corrigido para não afinar) */}
          <Link href={isAdmin ? '/dashboard' : '/portal'} className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/15">
              {/* Ajusta o caminho conforme teu asset real */}
              <Image
                src="/logo-100pharma.png"
                alt="100PHARMA"
                fill
                sizes="40px"
                className="object-contain p-1"
                priority
              />
            </div>
            <div className="hidden sm:block leading-tight">
              <div className="text-sm font-semibold text-white">100PHARMA</div>
              <div className="text-xs text-white/70">{isAdmin ? 'Admin' : 'Vendedor'}</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex flex-1 items-center gap-1 overflow-x-auto">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx(
                    'group inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition',
                    active
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-white/85 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <Icon className={cx('h-4 w-4', active ? 'text-indigo-700' : 'text-white/85')} />
                  <span className="whitespace-nowrap">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right controls */}
          <div className="ml-auto flex items-center gap-2">
            {/* Mobile menu button */}
            <button
              type="button"
              className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/15"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Abrir menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            {/* User dropdown */}
            <div className="relative">
              <button
                type="button"
                className="inline-flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2 text-left ring-1 ring-white/15 hover:bg-white/15"
                onClick={() => setUserMenuOpen((v) => !v)}
              >
                <div className="hidden sm:block">
                  <div className="text-sm font-semibold text-white leading-tight">{userLabel}</div>
                  <div className="text-xs text-white/70 leading-tight">{userEmail}</div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white">
                  <UserRound className="h-4 w-4" />
                </div>
                <ChevronDown className="hidden sm:block h-4 w-4 text-white/80" />
              </button>

              {userMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-xl"
                  onMouseLeave={() => setUserMenuOpen(false)}
                >
                  <div className="px-4 py-3">
                    <div className="text-sm font-semibold text-gray-900">{userLabel}</div>
                    <div className="text-xs text-gray-600">{userEmail}</div>
                    <div className="mt-1 inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                      {isAdmin ? 'ADMIN' : 'VENDEDOR'}
                    </div>
                  </div>
                  <div className="h-px bg-gray-100" />
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    onClick={handleSignOut}
                  >
                    <LogOut className="h-4 w-4" />
                    Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="lg:hidden pb-3">
            <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl bg-white/10 p-2 ring-1 ring-white/15">
              {nav.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cx(
                      'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition',
                      active ? 'bg-white text-indigo-700' : 'text-white/90 hover:bg-white/10'
                    )}
                  >
                    <Icon className={cx('h-4 w-4', active ? 'text-indigo-700' : 'text-white/90')} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>

            <button
              type="button"
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-indigo-700 shadow-sm"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
