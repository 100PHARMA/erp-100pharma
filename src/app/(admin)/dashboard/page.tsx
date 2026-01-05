// src/app/(admin)/dashboard/page.tsx

import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-gray-600">
          Se você está vendo isto, o roteamento do (admin) e o acesso ADMIN estão OK.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/vendas"
          className="rounded-xl border bg-white p-5 hover:shadow-sm transition"
        >
          <div className="text-lg font-semibold">Vendas</div>
          <div className="text-sm text-gray-600">Gerenciar vendas e orçamentos</div>
        </Link>

        <Link
          href="/vendedores"
          className="rounded-xl border bg-white p-5 hover:shadow-sm transition"
        >
          <div className="text-lg font-semibold">Vendedores</div>
          <div className="text-sm text-gray-600">Equipa, metas e desempenho</div>
        </Link>

        <Link
          href="/visitas"
          className="rounded-xl border bg-white p-5 hover:shadow-sm transition"
        >
          <div className="text-lg font-semibold">Visitas</div>
          <div className="text-sm text-gray-600">Visitas e quilometragem</div>
        </Link>
      </div>

      <div className="text-xs text-gray-500">
        Nota: Se algum link ficar “a carregar”, o problema estará na página destino (não no login).
      </div>
    </div>
  );
}
