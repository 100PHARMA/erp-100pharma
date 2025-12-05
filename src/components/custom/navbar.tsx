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
  Wallet
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

const menuItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
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

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  // Não mostrar navbar na página de login
  if (pathname === '/login') {
    return null;
  }

  return (
    <>
      {/* Desktop Navbar */}
      <nav className="hidden lg:block bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <img 
                src="https://k6hrqrxuu8obbfwn.public.blob.vercel-storage.com/temp/98b4bab4-3285-44fa-9df9-72210bf18f3d.png" 
                alt="100PHARMA Logo" 
                className="h-12 w-auto group-hover:scale-110 transition-transform duration-300" 
              />
            </Link>

            {/* Menu Items */}
            <div className="flex items-center gap-1 overflow-x-auto">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                      transition-all duration-200 whitespace-nowrap
                      ${
                        isActive
                          ? 'bg-white text-blue-600 shadow-lg'
                          : 'text-white hover:bg-blue-500/30'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden xl:inline">{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* User Info & Logout */}
            <div className="flex items-center gap-3">
              {user && (
                <div className="text-sm">
                  <p className="font-medium">{user.user_metadata?.nome || user.email}</p>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white hover:bg-red-500/30 transition-colors"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden xl:inline">Sair</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navbar */}
      <nav className="lg:hidden bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-xl sticky top-0 z-50">
        <div className="px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <img 
                src="https://k6hrqrxuu8obbfwn.public.blob.vercel-storage.com/temp/98b4bab4-3285-44fa-9df9-72210bf18f3d.png" 
                alt="100PHARMA Logo" 
                className="h-10 w-auto" 
              />
            </Link>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-blue-500/30 transition-colors"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="border-t border-blue-500/30 bg-blue-700/95 backdrop-blur-sm">
            <div className="px-4 py-4 space-y-1 max-h-[calc(100vh-4rem)] overflow-y-auto">
              {/* User Info */}
              {user && (
                <div className="px-4 py-3 mb-2 bg-blue-600/50 rounded-lg">
                  <p className="text-sm font-medium">{user.user_metadata?.nome || user.email}</p>
                </div>
              )}

              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium
                      transition-all duration-200
                      ${
                        isActive
                          ? 'bg-white text-blue-600 shadow-lg'
                          : 'text-white hover:bg-blue-600/50'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-white hover:bg-red-500/30 transition-colors mt-2"
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
