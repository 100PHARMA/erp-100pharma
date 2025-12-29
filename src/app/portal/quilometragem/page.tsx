'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Car,
  DollarSign,
  Search,
  AlertCircle,
  CheckCircle2,
  Clock3,
  BadgeInfo,
} from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type Perfil = {
  role: string;
  vendedor_id: string | null;
};

type KmStatus = 'PENDENTE' | 'APROVADO' | 'PAGO' | string;

type KmRow = {
  id: string;
  vendedor_id: string;
  data: string; // date (YYYY-MM-DD)
  km: number | null;
  valor_total: number | null;
  status: KmStatus;
  visita_id?: string | null;
};

function yyyyMmToDateRange(yyyymm: string) {
  const [yStr, mStr] = yyyymm.split('-');
  const y = Number(yStr);
  const m = Number(mStr);

  // start = 1º dia do mês
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  // end = 1º dia do próximo mês (exclusivo)
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0));

  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);

  return { startDate, endDate };
}

function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatEUR(n: number) {
  return n.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatKm(n: number) {
  return n.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function statusLabel(s: KmStatus) {
  const up = String(s ?? '').toUpperCase();
  if (up === 'PENDENTE') return 'Pendente';
  if (up === 'APROVADO') return 'Em aprovação';
  if (up === 'PAGO') return 'Pago';
  return up || '—';
}

function statusPillClass(s: KmStatus) {
  const up = String(s ?? '').toUpperCase();
  if (up === 'PAGO') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (up === 'APROVADO') return 'bg-blue-100 text-blue-800 border-blue-200';
  if (up === 'PENDENTE') return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

export default function PortalQuilometragemPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);

  const [vendedorId, setVendedorId] = useState<string | null>(null);
  const [vendedorEmail, setVendedorEmail] = useState<string | null>(null);

  const [mes, setMes] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });

  const [valorKmRef, setValorKmRef] = useState<number>(0.2);

  const [rows, setRows] = useState<KmRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // =========================================================
  // BOOTSTRAP: user -> perfis -> vendedor_id
  // =========================================================
  useEffect(() => {
    (async () => {
      setLoading(true);

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr || !user) {
        router.push('/login');
        return;
      }

      setVendedorEmail(user.email ?? null);

      const { data: perfil, error: perfilErr } = await supabase
        .from('perfis')
        .select('role, vendedor_id')
        .eq('id', user.id)
        .maybeSingle<Perfil>();

      if (perfilErr) {
        alert('Erro ao buscar perfil: ' + perfilErr.message);
        router.push('/login');
        return;
      }

      const role = String(perfil?.role ?? '').toUpperCase();
      if (role !== 'VENDEDOR') {
        router.push('/dashboard');
        return;
      }

      if (!perfil?.vendedor_id) {
        alert('Seu perfil não possui vendedor_id. Ajuste em public.perfis.');
        router.push('/portal');
        return;
      }

      setVendedorId(perfil.vendedor_id);
      await carregar(perfil.vendedor_id, mes);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!vendedorId) return;
    (async () => {
      setLoading(true);
      await carregar(vendedorId, mes);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes]);

  // =========================================================
  // CARREGAR
  // =========================================================
  const carregar = async (vendId: string, yyyymm: string) => {
    // valor/km (ref.) do config
    const { data: configRows, error: cfgErr } = await supabase
      .from('configuracoes_financeiras')
      .select('valor_km')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!cfgErr) {
      const v = Number(configRows?.[0]?.valor_km ?? 0.2);
      setValorKmRef(v > 0 ? v : 0.2);
    }

    const { startDate, endDate } = yyyyMmToDateRange(yyyymm);

    // IMPORTANTE:
    // - fonte correta: vendedor_km_lancamentos
    // - NÃO selecionar created_at (não existe na tua tabela)
    const { data, error } = await supabase
      .from('vendedor_km_lancamentos')
      .select('id, vendedor_id, data, km, valor_total, status, visita_id')
      .eq('vendedor_id', vendId)
      .gte('data', startDate)
      .lt('data', endDate)
      .order('data', { ascending: false });

    if (error) {
      console.error(error);
      alert('Erro ao carregar quilometragem: ' + error.message);
      setRows([]);
      return;
    }

    setRows((data ?? []) as KmRow[]);
  };

  // =========================================================
  // FILTRO + KPIs
  // =========================================================
  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return rows;

    return rows.filter((r) => {
      const d = String(r.data ?? '').toLowerCase();
      const km = String(r.km ?? '').toLowerCase();
      const val = String(r.valor_total ?? '').toLowerCase();
      const st = statusLabel(r.status).toLowerCase();
      return d.includes(term) || km.includes(term) || val.includes(term) || st.includes(term);
    });
  }, [rows, searchTerm]);

  // Total do mês = PENDENTE + APROVADO + PAGO (ou seja: todos os que retornaram)
  const totalKmMes = useMemo(() => filtered.reduce((acc, r) => acc + safeNum(r.km), 0), [filtered]);
  const totalValorMes = useMemo(
    () => filtered.reduce((acc, r) => acc + safeNum(r.valor_total), 0),
    [filtered],
  );

  const totalPagoMes = useMemo(
    () =>
      filtered
        .filter((r) => String(r.status ?? '').toUpperCase() === 'PAGO')
        .reduce((acc, r) => acc + safeNum(r.valor_total), 0),
    [filtered],
  );

  const totalEmAprovacaoMes = useMemo(
    () =>
      filtered
        .filter((r) => String(r.status ?? '').toUpperCase() === 'APROVADO')
        .reduce((acc, r) => acc + safeNum(r.valor_total), 0),
    [filtered],
  );

  const qtdLancamentos = filtered.length;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-6 flex items-center gap-3 text-gray-700">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          Carregando quilometragem...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Minha Quilometragem</h1>
              <p className="text-gray-600 mt-1">Leitura dos registos apurados para reembolso</p>
              <p className="text-xs text-gray-500 mt-1">
                Logado como: <span className="font-semibold">{vendedorEmail ?? 'vendedor'}</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-500" />
              <input
                type="month"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
              />
            </div>
          </div>

          {/* KPIs (responsivo e alinhado) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mt-6">
            <Kpi
              title="Total km (mês)"
              value={`${formatKm(totalKmMes)} km`}
              icon={<Car className="w-6 h-6 text-white" />}
              color="bg-blue-600"
            />

            <Kpi
              title="Total (€) (mês)"
              value={`€ ${formatEUR(totalValorMes)}`}
              icon={<DollarSign className="w-6 h-6 text-white" />}
              color="bg-emerald-600"
            />

            <Kpi
              title="Lançamentos"
              value={`${qtdLancamentos}`}
              icon={<Search className="w-6 h-6 text-white" />}
              color="bg-purple-600"
            />

            <Kpi
              title="Valor/km (ref.)"
              value={`€ ${formatEUR(valorKmRef)}`}
              icon={<AlertCircle className="w-6 h-6 text-white" />}
              color="bg-orange-600"
            />

            <Kpi
              title="Total pago (€)"
              value={`€ ${formatEUR(totalPagoMes)}`}
              icon={<CheckCircle2 className="w-6 h-6 text-white" />}
              color="bg-emerald-700"
            />

            <Kpi
              title="Em aprovação (€)"
              value={`€ ${formatEUR(totalEmAprovacaoMes)}`}
              icon={<Clock3 className="w-6 h-6 text-white" />}
              color="bg-blue-700"
            />
          </div>

          {/* Busca */}
          <div className="mt-6 bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Pesquisar por data, km, valor ou status..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Tabela */}
          <div className="mt-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Data</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Km</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Valor</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Estado</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-gray-500">
                        Nenhum registo encontrado para este mês.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r) => (
                      <tr key={r.id} className="hover:bg-blue-50/50 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {new Date(r.data).toLocaleDateString('pt-PT')}
                        </td>

                        <td className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                          {formatKm(safeNum(r.km))} km
                        </td>

                        <td className="px-6 py-4 text-right text-sm font-semibold text-emerald-700">
                          € {formatEUR(safeNum(r.valor_total))}
                        </td>

                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-semibold border ${statusPillClass(
                              r.status,
                            )}`}
                          >
                            {statusLabel(r.status)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Nota */}
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-gray-700">
            <div className="flex items-start gap-3">
              <BadgeInfo className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900">Nota</p>
                <p className="mt-1">
                  O “Total (mês)” inclui lançamentos <strong>pendentes</strong>, <strong>em aprovação</strong> e{' '}
                  <strong>pagos</strong>. Valores sujeitos a validação e aprovação.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Evolução futura: filtros por status, link da visita, export, etc. */}
      </div>
    </div>
  );
}

function Kpi({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 h-full">
      <div className="flex items-center gap-3">
        <div className={`${color} p-3 rounded-lg shrink-0`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-sm text-gray-600 leading-tight">{title}</p>
          <p className="text-xl font-bold text-gray-900 truncate">{value}</p>
        </div>
      </div>
    </div>
  );
}
