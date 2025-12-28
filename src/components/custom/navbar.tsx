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
  { href: '/portal/visitas',
