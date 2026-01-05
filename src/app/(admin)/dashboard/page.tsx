// src/app/(admin)/dashboard/page.tsx
import Link from 'next/link';
import {
  ShoppingCart,
  Package,
  Users,
  Truck,
  Receipt,
  TrendingUp,
  CalendarCheck,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

type KPI = {
  label: string;
  value: number | null;
  hint?: string;
};

async function safeCountTable(table: string): Promise<number | null> {
  try {
    const supabase = createSupabaseServerClient();
    const { count, error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true });

    if (error) return null;
    return typeof count === 'number' ? count : null;
  } catch {
    return null;
  }
}

async function safeSumColumn(
  table: string,
  column: string
): Promise<number | null> {
  // Tenta somar via select simples (traz dados) — como não sabemos o schema,
  // mantemos como best-effort e retornamos null se falhar.
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.from(table).select(column).limit(5000);
    if (error || !data) return null;

    let sum = 0;
    let ok = false;
    for (const row of data as Array<Record<string, any>>) {
      const v = row?.[column];
      const n =
        typeof v === 'number'
          ? v
          : typeof v === 'string'
            ? Number(v.replace(',', '.'))
            : NaN;
      if (!Number.isNaN(n)) {
        sum += n;
        ok = true;
      }
    }
    return ok ? sum : null;
  } catch {
    return null;
  }
}

function formatInt(v: number | null) {
  if (v === null) return '—';
  return new Intl.NumberFormat('pt-PT').format(v);
}

function formatEUR(v: number | null) {
  if (v === null) return '—';
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(v);
}

function Card({
  title,
  value,
  icon,
  href,
  subtitle,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  href?: string;
  subtitle?: string;
}) {
  const Inner = (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-gray-500">{title}</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
          {subtitle ? (
            <div className="mt-1 text-xs text-gray-500">{subtitle}</div>
          ) : null}
        </div>
        <div className="shrink-0 rounded-xl p-3 bg-gray-50 border border-gray-100">
          {icon}
        </div>
      </div>
    </div>
  );

  if (!href) return Inner;

  return (
    <Link href={href} className="block">
      {Inner}
    </Link>
  );
}

function QuickLink({
  title,
  desc,
  href,
  icon,
}: {
  title: string;
  desc: string;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow group"
    >
      <div className="flex items-start gap-4">
        <div className="rounded-xl p-3 bg-gray-50 border border-gray-100 group-hover:bg-gray-100 transition-colors">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-gray-900">{title}</div>
          <div className="text-sm text-gray-600 mt-1">{desc}</div>
        </div>
      </div>
    </Link>
  );
}

function HealthRow({
  label,
  status,
  detail,
}: {
  label: string;
  status: 'ok' | 'warn' | 'bad';
  detail: string;
}) {
  const Icon =
    status === 'ok' ? (
      <CheckCircle2 className="w-4 h-4" />
    ) : status === 'warn' ? (
      <AlertTriangle className="w-4 h-4" />
    ) : (
      <AlertTriangle className="w-4 h-4" />
    );

  const tone =
    status === 'ok'
      ? 'text-green-700 bg-green-50 border-green-100'
      : status === 'warn'
        ? 'text-amber-700 bg-amber-50 border-amber-100'
        : 'text-red-700 bg-red-50 border-red-100';

  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-900">{label}</div>
        <div className="text-xs text-gray-500 mt-0.5">{detail}</div>
      </div>
      <div className={`shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${tone}`}>
        {Icon}
        <span className="text-xs font-semibold">
          {status === 'ok' ? 'OK' : status === 'warn' ? 'Atenção' : 'Erro'}
        </span>
      </div>
    </div>
  );
}

export default async function AdminDashboardPage() {
  // KPIs (best-effort)
  const [
    produtos,
    clientes,
    fornecedores,
    vendedores,
    vendas,
    faturas,
    tarefas,
    visitas,
    kmPendentes,
  ] = await Promise.all([
    safeCountTable('produtos'),
    safeCountTable('clientes'),
    safeCountTable('fornecedores'),
    safeCountTable('vendedores'),
    safeCountTable('vendas'),
    safeCountTable('faturas'),
    safeCountTable('tarefas'),
    // se você tiver a tabela vendedor_visitas (ou visitas), ajuste o nome aqui
    safeCountTable('vendedor_visitas'),
    // se você usa vendedor_km_lancamentos, ajuste aqui
    safeCountTable('vendedor_km_lancamentos'),
  ]);

  // Vendas € (opcional): tenta somar algo comum; ajuste quando quiser
  const totalSemIva =
    (await safeSumColumn('faturas', 'total_sem_iva')) ??
    (await safeSumColumn('faturas', 'subtotal')) ??
    null;

  const kpis: KPI[] = [
    { label: 'Produtos', value: produtos },
    { label: 'Clientes', value: clientes },
    { label: 'Fornecedores', value: fornecedores },
    { label: 'Vendedores', value: vendedores },
    { label: 'Vendas (registos)', value: vendas },
    { label: 'Faturas (registos)', value: faturas },
    { label: 'Tarefas', value: tarefas },
    { label: 'Visitas (registos)', value: visitas },
    { label: 'Km lançados', value: kmPendentes },
  ];

  // “Saúde do sistema” (heurística simples)
  const health = [
    {
      label: 'Sessão e autorização (SSR)',
      status: 'ok' as const,
      detail: 'Você chegou em /dashboard, logo o gate do (admin) passou.',
    },
    {
      label: 'Cadastros essenciais',
      status:
        (produtos ?? 0) > 0 && (clientes ?? 0) > 0 ? ('ok' as const) : ('warn' as const),
      detail:
        (produtos ?? 0) > 0 && (clientes ?? 0) > 0
          ? 'Produtos e Clientes possuem registos.'
          : 'Faltam registos em Produtos e/ou Clientes.',
    },
    {
      label: 'Vendedores',
      status: (vendedores ?? 0) > 0 ? ('ok' as const) : ('warn' as const),
      detail:
        (vendedores ?? 0) > 0
          ? 'Vendedores cadastrados.'
          : 'Nenhum vendedor encontrado (ver tabela/seed/RLS).',
    },
    {
      label: 'Movimentação',
      status: (vendas ?? 0) > 0 || (faturas ?? 0) > 0 ? ('ok' as const) : ('warn' as const),
      detail:
        (vendas ?? 0) > 0 || (faturas ?? 0) > 0
          ? 'Existem vendas/faturas no sistema.'
          : 'Sem vendas/faturas ainda — ou nomes de tabela/coluna diferentes.',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-8">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Dashboard (Admin)
              </h1>
              <p className="text-gray-600 mt-2">
                Visão geral do ERP: cadastros, operação e indicadores básicos.
              </p>
            </div>

            <div className="hidden md:flex items-center gap-2 text-sm text-gray-500">
              <BarChart3 className="w-4 h-4" />
              <span>Atualização em tempo real (best-effort)</span>
            </div>
          </div>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <Card
            title="Faturação (base sem IVA)"
            value={formatEUR(totalSemIva)}
            icon={<Receipt className="w-6 h-6 text-indigo-600" />}
            href="/faturas"
            subtitle="Se aparecer —, ajuste a coluna (total_sem_iva/subtotal)"
          />
          <Card
            title="Vendas (registos)"
            value={formatInt(vendas)}
            icon={<ShoppingCart className="w-6 h-6 text-blue-600" />}
            href="/vendas"
          />
          <Card
            title="Produtos"
            value={formatInt(produtos)}
            icon={<Package className="w-6 h-6 text-green-600" />}
            href="/produtos"
          />
          <Card
            title="Clientes"
            value={formatInt(clientes)}
            icon={<Users className="w-6 h-6 text-purple-600" />}
            href="/clientes"
          />
          <Card
            title="Vendedores"
            value={formatInt(vendedores)}
            icon={<TrendingUp className="w-6 h-6 text-orange-600" />}
            href="/vendedores"
          />
          <Card
            title="Fornecedores"
            value={formatInt(fornecedores)}
            icon={<Truck className="w-6 h-6 text-slate-700" />}
            href="/fornecedores"
          />
          <Card
            title="Visitas (registos)"
            value={formatInt(visitas)}
            icon={<CalendarCheck className="w-6 h-6 text-emerald-600" />}
            href="/visitas"
            subtitle="Se der —, ajuste nome da tabela (vendedor_visitas/visitas)"
          />
          <Card
            title="Km lançados"
            value={formatInt(kmPendentes)}
            icon={<MapPin className="w-6 h-6 text-rose-600" />}
            href="/quilometragem"
            subtitle="Se der —, ajuste nome da tabela (vendedor_km_lancamentos)"
          />
        </div>

        {/* Quick links + Health */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick actions */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Atalhos</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Acesso rápido às rotinas mais usadas.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                <QuickLink
                  title="Vendas"
                  desc="Criar e gerir vendas e orçamentos."
                  href="/vendas"
                  icon={<ShoppingCart className="w-5 h-5 text-blue-700" />}
                />
                <QuickLink
                  title="Faturas"
                  desc="Emitir, rever e acompanhar faturas."
                  href="/faturas"
                  icon={<Receipt className="w-5 h-5 text-indigo-700" />}
                />
                <QuickLink
                  title="Produtos"
                  desc="Gestão de catálogo e stock."
                  href="/produtos"
                  icon={<Package className="w-5 h-5 text-green-700" />}
                />
                <QuickLink
                  title="Vendedores"
                  desc="Performance, comissões e métricas."
                  href="/vendedores"
                  icon={<TrendingUp className="w-5 h-5 text-orange-700" />}
                />
                <QuickLink
                  title="Tarefas"
                  desc="Organização interna e pendências."
                  href="/tarefas"
                  icon={<CheckCircle2 className="w-5 h-5 text-emerald-700" />}
                />
                <QuickLink
                  title="Visitas & Km"
                  desc="Rotas, visitas e quilometragem."
                  href="/visitas"
                  icon={<MapPin className="w-5 h-5 text-rose-700" />}
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-bold text-gray-900">Resumo técnico (para debug)</h2>
              <p className="text-sm text-gray-600 mt-1">
                Mostra rapidamente se as tabelas/rotas essenciais estão a responder.
              </p>

              <div className="mt-4 divide-y divide-gray-100">
                {kpis.map((k) => (
                  <div key={k.label} className="flex items-center justify-between py-3">
                    <div className="text-sm text-gray-700">{k.label}</div>
                    <div className="text-sm font-semibold text-gray-900">{formatInt(k.value)}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 text-xs text-gray-500">
                Se algum KPI aparecer como “—”, isso normalmente indica: tabela não existe com esse nome,
                RLS bloqueando, ou schema diferente do esperado.
              </div>
            </div>
          </div>

          {/* Health */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 h-fit">
            <h2 className="text-xl font-bold text-gray-900">Saúde do sistema</h2>
            <p className="text-sm text-gray-600 mt-1">
              Diagnóstico rápido para orientar as próximas correções.
            </p>

            <div className="mt-4 divide-y divide-gray-100">
              {health.map((h) => (
                <HealthRow
                  key={h.label}
                  label={h.label}
                  status={h.status}
                  detail={h.detail}
                />
              ))}
            </div>

            <div className="mt-5 p-4 rounded-xl bg-gray-50 border border-gray-100">
              <div className="text-sm font-semibold text-gray-900">Próximo passo recomendado</div>
              <div className="text-sm text-gray-600 mt-1">
                Se “Vendedores” estiver “Atenção”, o problema quase sempre é:
                <span className="font-medium text-gray-800"> RLS, seed inexistente, ou nome de tabela</span>.
                Aí você ajusta os nomes aqui e/ou corrige policies.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
