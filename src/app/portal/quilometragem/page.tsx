'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Car,
  DollarSign,
  Search,
  AlertCircle,
  CheckCircle,
  Clock,
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
  created_at?: string | null;
};

function yyyyMmToDateRange(yyyymm: string) {
  const [yStr, mStr] = yyyymm.split('-');
  const y = Number(yStr);
  const m = Number(mStr);

  // intervalo [startDate, endDate) em DATE
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0));

  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);

  return { startDate, endDate };
}

function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatEUR(v: number) {
  return v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatKm(v: number) {
  return v.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function statusLabel(s: string) {
  const u = String(s ?? '').toUpperCase();
  if (u === 'PENDENTE') return 'Pendente';
  if (u === 'APROVADO') return 'Em aprovação';
  if (u === 'PAGO') return 'Pago';
  return u || '—';
}

function statusBadgeClass(s: string) {
  const u = String(s ?? '').toUpperCase();
  if (u === 'PENDENTE') return 'bg-yellow-100 text-yellow-800';
  if (u === 'APROVADO') return 'bg-blue-100 text-blue-800';
  if (u === 'PAGO') return 'bg-green-100 text-green-800';
  return 'bg-gray-100 text-gray-700';
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

  // Atualiza quando troca mês
  useEffect(() => {
    if (!vendedorId) return;
    (async () => {
      setLoading(true);
      await carregar(vendedorId, mes);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes]);

  const carregar = async (vendId: string, yyyymm: string) => {
    // 1) valor/km referência
    const { data: configRows, error: cfgErr } = await supabase
      .from('configuracoes_financeiras')
      .select('valor_km')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!cfgErr) {
      const v = safeNum(configRows?.[0]?.valor_km ?? 0.2);
      setValorKmRef(v > 0 ? v : 0.2);
    }

    // 2) km lançamentos no mês
    const { startDate, endDate } = yyyyMmToDateRange(yyyymm);

    const { data, error } = await supabase
      .from('vendedor_km_lancamentos')
      .select('id, vendedor_id, data, km, valor_total, status, visita_id, created_at')
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

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return rows;

    return rows.filter((r) => {
      return (
        String(r.data ?? '').toLowerCase().includes(term) ||
        String(r.km ?? '').toLowerCase().includes(term) ||
        String(r.valor_total ?? '').toLowerCase().includes(term) ||
        String(r.status ?? '').toLowerCase().includes(term)
      );
    });
  }, [rows, searchTerm]);

  // KPIs
  const kpis = useMemo(() => {
    const totalKmMes = filtered.reduce((acc, r) => acc + safeNum(r.km), 0);

    const totalValorMes = filtered.reduce((acc, r) => {
      // Para PENDENTE/APROVADO pode existir valor_total já calculado (baseado em km * valor_km no momento).
      // Se vier nulo, não inventamos; soma 0.
      return acc + safeNum(r.valor_total);
    }, 0);

    const totalPagoMes = filtered
      .filter((r) => String(r.status ?? '').toUpperCase() === 'PAGO')
      .reduce((acc, r) => acc + safeNum(r.valor_total), 0);

    const totalAprovacaoMes = filtered
      .filter((r) => String(r.status ?? '').toUpperCase() === 'APROVADO')
      .reduce((acc, r) => acc + safeNum(r.valor_total), 0);

    const qtdLancamentos = filtered.length;

    return { totalKmMes, totalValorMes, totalPagoMes, totalAprovacaoMes, qtdLancamentos };
  }, [filtered]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <p className="text-gray-600">Carregando quilometragem...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
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

          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mt-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-3 rounded-lg">
                  <Car className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total km (mês)</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {formatKm(kpis.totalKmMes)} km
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-600 p-3 rounded-lg">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total (€) (mês)</p>
                  <p className="text-2xl font-bold text-emerald-700">€ {formatEUR(kpis.totalValorMes)}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="bg-purple-600 p-3 rounded-lg">
                  <Search className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Lançamentos</p>
                  <p className="text-2xl font-bold text-purple-700">{kpis.qtdLancamentos}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="bg-orange-600 p-3 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Valor/km (ref.)</p>
                  <p className="text-2xl font-bold text-orange-700">
                    € {formatEUR(valorKmRef)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="bg-green-600 p-3 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total pago (€)</p>
                  <p className="text-2xl font-bold text-green-700">€ {formatEUR(kpis.totalPagoMes)}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-sky-50 to-sky-100 p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="bg-sky-600 p-3 rounded-lg">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Em aprovação (€)</p>
                  <p className="text-2xl font-bold text-sky-700">€ {formatEUR(kpis.totalAprovacaoMes)}</p>
                </div>
              </div>
            </div>
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
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusBadgeClass(
                              String(r.status ?? '')
                            )}`}
                          >
                            {statusLabel(String(r.status ?? ''))}
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
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900">Nota</p>
                <p className="mt-1">
                  Os valores apresentados incluem lançamentos pendentes, em aprovação e pagos, e estão sujeitos a validação e aprovação.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Evolução futura: filtro por status, detalhe por visita, export, etc. */}
      </div>
    </div>
  );
}
