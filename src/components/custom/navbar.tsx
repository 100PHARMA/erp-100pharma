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
  TrendingUp,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type Role = 'ADMIN' | 'VENDEDOR' | 'UNKNOWN';

const LOGO_URL =
  'https://k6hrqrxuu8obbfwn.public.blob.vercel-storage.com/temp/98b4bab4-3285-44fa-9df9-72210bf18f3d.png';

/* ================= MENUS ================= */

const adminMenuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/produtos', label: 'Produtos', icon: Package },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/fornecedores', label: 'Fornecedores', icon: Building2 },
  { href: '/compras', label: 'Compras', icon: ShoppingBag },
  { href: '/vendedores', label: 'Vendedores', icon: UserCircle },
  { href: '/vendas', label: 'Vendas', icon: ShoppingCart },
  { href: '/faturas', label: 'Faturas', icon: FileText },

  // Dropdown "Mais"
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

/* ================= HELPERS ================= */

function isActivePath(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href !== '/' && pathname.startsWith(href + '/')) return true;
  return false;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

/* ================= COMPONENT ================= */

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [role, setRole] = useState<Role>('UNKNOWN');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  if (pathname === '/login' || pathname.startsWith('/login/')) return null;

  /* ---------- identidade ---------- */
  useEffect(() => {
    let cancelled = false;

    async function loadIdentity() {
      const { data } = await supabase.auth.getUser();
      const u = user ?? data.user;

      if (!u) return;

      setEmail(u.email ?? '');

      const { data: perfil } = await supabase
        .from('perfis')
        .select('role, vendedor_id')
        .eq('id', u.id)
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

        if (vend?.nome) name = vend.nome;
      }

      if (!cancelled) {
        setRole(resolvedRole);
        setDisplayName(name || u.email || '');
      }
    }

    loadIdentity();
    const { data: sub } = supabase.auth.onAuthStateChange(loadIdentity);

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
    };
  }, [supabase, user?.id]);

  /* ---------- fechar dropdown ---------- */
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (moreOpen && moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
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

  const primaryItems = isVendor ? menuItems : menuItems.slice(0, 8);
  const moreItems = isVendor ? [] : menuItems.slice(8);

  /* ================= RENDER ================= */

  return (
    <>
      {/* ========== DESKTOP ========== */}
      <nav className="hidden lg:block bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center h-16 gap-3">
            {/* Logo */}
            <Link href={isVendor ? '/portal' : '/dashboard'}>
              <div className="h-11 w-11 rounded-xl bg-white/10 ring-1 ring-white/20 flex items-center justify-center">
                <img src={LOGO_URL} alt="100PHARMA" className="h-full w-full object-contain p-1" />
              </div>
            </Link>

            {/* Menu principal SEM overflow */}
            <div className="flex items-center gap-1">
              {primaryItems.map((item) => {
                const Icon = item.icon;
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cx(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap',
                      active ? 'bg-white text-blue-600 shadow-lg' : 'hover:bg-blue-500/30'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden xl:inline">{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Direita */}
            <div className="ml-auto flex items-center gap-2 border-l border-white/20 pl-4">
              {!isVendor && (
                <div className="relative" ref={moreRef}>
                  <button
                    onClick={() => setMoreOpen((v) => !v)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-blue-500/30"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                    <span className="hidden xl:inline">Mais</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  {moreOpen && (
                    <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white text-gray-900 shadow-xl ring-1 ring-black/10 z-50">
                      <div className="p-2">
                        {moreItems.map((item) => {
                          const Icon = item.icon;
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setMoreOpen(false)}
                              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50"
                            >
                              <Icon className="w-4 h-4" />
                              {item.label}
                            </Link>
                          );
                        })}

                        <div className="my-2 h-px bg-gray-200" />

                        <div className="px-3 py-2 text-sm">
                          <div className="font-semibold">{displayName}</div>
                          <div className="text-xs text-gray-500">{email}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-red-500/30"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ========== MOBILE ========== */}
      <nav className="lg:hidden bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-xl sticky top-0 z-50">
        <div className="px-4 flex items-center justify-between h-16">
          <Link href={isVendor ? '/portal' : '/dashboard'}>
            <img src={LOGO_URL} alt="100PHARMA" className="h-9 w-9" />
          </Link>

          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="bg-blue-700 px-4 py-4 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-blue-600"
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}

            <button
              onClick={handleLogout}
              className="w-full mt-2 flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-red-500/30"
            >
              <LogOut className="w-5 h-5" />
              Sair
            </button>
          </div>
        )}
      </nav>
    </>
  );
}
