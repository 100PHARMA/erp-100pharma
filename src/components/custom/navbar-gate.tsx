'use client';

import { usePathname } from 'next/navigation';
import Navbar from '@/components/custom/navbar';

export default function NavbarGate() {
  const pathname = usePathname();

  const hideNavbar =
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname === '/reset-password' ||
    pathname.startsWith('/reset-password/') ||
    pathname === '/auth/callback' ||
    pathname.startsWith('/auth/callback/') ||
    pathname === '/portal' ||
    pathname.startsWith('/portal/');

  if (hideNavbar) return null;
  return <Navbar />;
}
