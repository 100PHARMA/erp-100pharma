// src/app/(admin)/dashboard/page.tsx
import Link from 'next/link';
import {
  TrendingUp,
  FileText,
  Users,
  Package,
  AlertTriangle,
  CalendarDays,
  ArrowUpRight,
  Wallet,
} from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

type KPI = {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  href?: string;
};

function eur(v: number) {
  try {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);
  } catch {
    return `${v.toFixed(2)} €`;
  }
}

function fmtInt(v: number) {
  try {
    return new Intl.NumberFormat('pt-PT').format(v);
  } catch {
    return String(v);
  }
}

function monthRangeUTC() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

async function safeCount(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  table: string,
  filters?: (q: any) => any
): Promise<number | null> {
  try {
    let q = supabase.from(table).select('*', { count: 'exact', head: true });
    if (filters) q = filters(q);
    const { count, error } = await q;
    if (error) return null;
    return typeof count === 'number' ? count : null;
  } catch {
    return null;
  }
}

async function safeSum(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  table: string,
  sumField: string,
  filters?: (q: any) => any
): Promise<number | null> {
  // Supabase não tem SUM direto no select padrão; fazemos via RPC seria ideal,
  // mas para não depender de RPCs, buscamos um agregado simples via view/SQL não existe aqui.
  // Então fazemos um fetch pequeno e somamos (apenas para o mês atual).
  // Se sua tabela tiver muito volume, depois trocamos por uma VIEW ou RPC.
  try {
    let q = supabase.from(table).select(sumField);
    if (filters) q = filters(q);
    const { data, error } = await q;
    if (error || !data) return null;
    let total = 0;
    for (const row of data as any[]) {
      const v = Number(row?.[sumField] ?? 0);
      if (!Number.isNaN(v)) total += v;
    }
    return total;
  } catch {
    return null;
  }
}

export default async function AdminDashboardPage() {
  const supabase = createSupabaseServerClient();
  const { startISO, endISO } = monthRangeUTC();

  // KPIs (tolerantes a schema)
  const [
    clientesCount,
    vendedoresCount,
    faturasMesCount,
    faturasAbertasCount,
    // totals: tenta total_sem_iva, se não existir tenta subtotal
    totalFaturadoSemIvaMes_a,
    totalFaturadoSemIvaMes_b,
    produtosBaixoStockCount,
    visitasPendentesCount,
    kmPendentesCount,
  ] = await Promise.all([
    safeCount(supabase, 'clientes'),
    safeCount(supabase, 'vendedores'),
    safeCount(supabase, 'faturas', (q) =>
      q.gte('data_emissao', startISO).lt('data_emissao', endISO).neq('estado', 'CANCELADA')
    ),
    safeCount(supabase, 'faturas', (q) =>
      q.in('estado', ['PENDENTE', 'EM_ABERTO']).neq('estado', 'CANCELADA')
    ),
    safeSum(supabase, 'faturas', 'total_sem_iva', (q) =>
      q.gte('data_emissao', startISO).lt('data_emissao', endISO).neq('estado', 'CANCELADA')
    ),
    safeSum(supabase, 'faturas', 'subtotal', (q) =>
      q.gte('data_emissao', startISO).lt('data_emissao', endISO).neq('estado', 'CANCELADA')
    ),
    // tenta regras comuns: stock_atual <= stock_minimo
    (async () => {
      try {
        const { data, error } = await supabase
          .from('produtos')
          .select('id, stock_atual, stock_minimo');

        if (error || !data) return null;

        let n = 0;
        for (const p of data as any[]) {
          const atual = Number(p?.stock_atual);
          const minimo = Number(p?.stock_minimo);
          if (!Number.isNaN(atual) && !Number.isNaN(minimo) && atual <= minimo) n += 1;
        }
        return n;
      } catch {
        return null;
      }
    })(),
    safeCount(supabase, 'vendedor_visitas', (q) => q.eq('estado', 'PENDENTE')),
    safeCount(supabase, 'vendedor_km_lancamentos', (q) => q.eq('estado', 'PENDENTE')),
  ]);

  const totalMes = totalFaturadoSemIvaMes_a ?? totalFaturadoSemIvaMes_b;

  const kpis: KPI[] = [
    {
      title: 'Faturação do mês (s/IVA)',
      value: totalMes == null ? '—' : eur(totalMes),
      subtitle: 'Faturas emitidas no mês atual',
      icon: <TrendingUp className="w-5 h-5" />,
      href: '/faturas',
    },
    {
      title: 'Faturas emitidas (mês)',
      value: faturasMesCount == null ? '—' : fmtInt(faturasMesCount),
      subtitle: 'Exclui CANCELADA',
      icon: <FileText className="w-5 h-5" />,
      href: '/faturas',
    },
    {
      title: 'Faturas em aberto',
      value: faturasAbertasCount == null ? '—' : fmtInt(faturasAbertasCount),
      subtitle: 'PENDENTE / EM_ABERTO',
      icon: <Wallet className="w-5 h-5" />,
      href: '/financeiro',
    },
    {
      title: 'Clientes',
      value: clientesCount == null ? '—' : fmtInt(clientesCount),
      subtitle: 'Base total cadastrada',
      icon: <Users className="w-5 h-5" />,
      href: '/clientes',
    },
  ];

  const alerts = [
    {
      title: 'Produtos com stock baixo',
      value: produtosBaixoStockCount == null ? '—' : fmtInt(produtosBaixoStockCount),
      icon: <Package className="w-5 h-5 text-amber-600" />,
      href: '/produtos',
    },
    {
      title: 'Visitas pendentes (vendedores)',
      value: visitasPendentesCount == null ? '—' : fmtInt(visitasPendentesCount),
      icon: <CalendarDays className="w-5 h-5 text-amber-600" />,
      href: '/visitas',
    },
    {
      title: 'KM pendente para aprovação',
      value: kmPendentesCount == null ? '—' : fmtInt(kmPendentesCount),
      icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
      href: '/quilometragem',
    },
    {
      title: 'Vendedores',
      value: vendedoresCount == null ? '—' : fmtInt(vendedoresCount),
      icon: <Users className="w-5 h-5 text-amber-600" />,
      href: '/vendedores',
    },
  ];

  const shortcuts = [
    { title: 'Vendas', desc: 'Gerenciar vendas e orçamentos', href: '/vendas' },
    { title: 'Faturas', desc: 'Emitidas, estados e histórico', href: '/faturas' },
    { title: 'Produtos', desc: 'Stock, preços e catálogo', href: '/produtos' },
    { title: 'Clientes', desc: 'Cadastro e relacionamento', href: '/clientes' },
    { title: 'Vendedores', desc: 'Equipa, metas e performance', href: '/vendedores' },
    { title: 'Financeiro', desc: 'Contas a receber e caixa', href: '/financeiro' },
    { title: 'Comissões', desc: 'Cálculos e pagamentos', href: '/comissoes' },
    { title: 'Tarefas', desc: 'Operação diária do time', href: '/tarefas' },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
              <p className="text-slate-600 mt-1">
                Visão geral operacional (mês atual) e atalhos do ERP.
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Período</div>
              <div className="text-sm font-semibold text-slate-800">
                {new Date(startISO).toLocaleDateString('pt-PT')} —{' '}
                {new Date(new Date(endISO).getTime() - 1).toLocaleDateString('pt-PT')}
              </div>
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          {kpis.map((k) => (
            <div key={k.title} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-slate-600">{k.title}</div>
                  <div className="text-2xl font-bold text-slate-900 mt-2">{k.value}</div>
                  {k.subtitle ? <div className="text-xs text-slate-500 mt-2">{k.subtitle}</div> : null}
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                  {k.icon}
                </div>
              </div>

              {k.href ? (
                <div className="mt-4">
                  <Link
                    href={k.href}
                    className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    Ver detalhes <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {/* Alerts + Shortcuts */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Alerts */}
          <div className="xl:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Alertas</h2>
              <span className="text-xs text-slate-500">Operação</span>
            </div>

            <div className="mt-4 space-y-3">
              {alerts.map((a) => (
                <Link
                  key={a.title}
                  href={a.href}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                      {a.icon}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{a.title}</div>
                      <div className="text-xs text-slate-500">Clique para abrir</div>
                    </div>
                  </div>
                  <div className="text-lg font-bold text-slate-900">{a.value}</div>
                </Link>
              ))}
            </div>
          </div>

          {/* Shortcuts */}
          <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Atalhos</h2>
              <span className="text-xs text-slate-500">Navegação rápida</span>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {shortcuts.map((s) => (
                <Link
                  key={s.title}
                  href={s.href}
                  className="group p-4 rounded-2xl border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-bold text-slate-900 group-hover:text-indigo-700">
                        {s.title}
                      </div>
                      <div className="text-sm text-slate-600 mt-1">{s.desc}</div>
                    </div>
                    <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600" />
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-6 text-xs text-slate-500">
              Nota: se algum KPI aparecer como “—”, é porque a tabela/coluna não existe no seu schema atual
              ou está protegida por RLS. O dashboard continua funcionando.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
