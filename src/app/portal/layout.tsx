// src/app/portal/layout.tsx
import Link from "next/link";

function PortalNavbar() {
  return (
    <div className="h-16 bg-indigo-600 text-white flex items-center px-4 gap-4">
      <Link href="/portal" className="font-semibold">Portal</Link>
      <Link href="/portal/vendas">Vendas</Link>
      <Link href="/portal/metas">Metas</Link>
      <Link href="/portal/quilometragem">Quilometragem</Link>
      <Link href="/portal/visitas">Visitas</Link>
      <div className="ml-auto">
        {/* aqui você coloca o botão Sair do portal */}
      </div>
    </div>
  );
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <PortalNavbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </div>
    </div>
  );
}
