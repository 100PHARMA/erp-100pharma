'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Car,
  DollarSign,
  Search,
  AlertCircle,
  CheckCircle2,
  XCircle,
  CreditCard,
  RefreshCw,
} from 'lucide-react';

import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type KmLancRow = {
  id: string;
  visita_id: string;
  vendedor_id: string;
  cliente_id: string | null;
  data: string;
  km: number;
  valor_km: number;
  valor_total: number;
  status: 'PENDENTE' | 'APROVADO' | 'PAGO' | 'REJEITADO';
  motivo_rejeicao: string | null;
  criado_em: string;

  vendedor?: { id: string; nome?: string | null } | null;
  cliente?: { id: string; nome?: string | null } | null;
};

function safeNumber(n: any): number {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? v : 0;
}

function yyyyMmToDateRange(yyyymm: string) {
  const [yStr, mStr] = yyyymm.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function formatEUR(valor: number) {
  return safeNumber(valor).toLocaleString('pt-PT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function QuilometragemClient({ initialMes }: { initialMes: string }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [mes, setMes] = useState(initialMes);
  const [statusFiltro, setStatusFiltro] = useState<'TODOS' | KmLancRow['status']>('TODOS');
  const [searchTerm, setSearchTerm] = useState('');

  const [valorKmRef, setValorKmRef] = useState<number>(0.2);
  const [rows, setRows] = useState<KmLancRow[]>([]);

  // ---------------------------------------------------------------------------
  // LOADERS (SEM auth guard no client)
  // ---------------------------------------------------------------------------
  const carregarValorKmRef = async () => {
    const { data: cfgRows, error: cfgErr } = await supabase
      .from('configuracoes_financeiras')
      .select('valor_km')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!cfgErr) {
      const v = safeNumber(cfgRows?.[0]?.valor_km ?? 0.2);
      setValorKmRef(v > 0 ? v : 0.2);
    }
  };

  const carregarLancamentos = async (yyyymm: string) => {
    const { startDate, endDate } = yyyyMmToDateRange(yyyymm);

    const { data, error } = await supabase
      .from('vendedor_km_lancamentos')
      .select(
  'id,visita_id,vendedor_id,cliente_id,data,km,valor_km,valor_total,status,motivo_rejeicao,criado_em,' +
    'vendedor:vendedores!vendedor_km_lancamentos_vendedor_fkey(id,nome),' +
    'cliente:clientes!vendedor_km_lancamentos_cliente_fkey(id,nome)'
)
      .gte('data', startDate)
      .lt('data', endDate)
      .order('data', { ascending: false })
      .order('criado_em', { ascending: false });

    if (error) throw new Error(`Erro ao ler vendedor_km_lancamentos: ${error.message}`);
    setRows((data ?? []) as KmLancRow[]);
  };

  const bootstrap = async () => {
    setLoading(true);
    setErro(null);

    try {
      await carregarValorKmRef();
      await carregarLancamentos(mes);
    } catch (e: any) {
      console.error(e);
      setErro(e?.message || 'Erro ao carregar quilometragem');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // EFFECTS
  // ---------------------------------------------------------------------------
  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErro(null);

      try {
        await carregarValorKmRef();
        await carregarLancamentos(mes);
      } catch (e: any) {
        console.error(e);
        setErro(e?.message || 'Erro ao atualizar período');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return rows.filter((r) => {
      if (statusFiltro !== 'TODOS' && r.status !== statusFiltro) return false;
      if (!term) return true;

      const vendedorNome = String(r.vendedor?.nome ?? '').toLowerCase();
      const clienteNome = String(r.cliente?.nome ?? '').toLowerCase();
      const dataStr = String(r.data ?? '').toLowerCase();

      return (
        vendedorNome.includes(term) ||
        clienteNome.includes(term) ||
        dataStr.includes(term) ||
        String(r.km ?? '').toLowerCase().includes(term) ||
        String(r.valor_total ?? '').toLowerCase().includes(term) ||
        String(r.status ?? '').toLowerCase().includes(term)
      );
    });
  }, [rows, searchTerm, statusFiltro]);

  const totalKm = filtered.reduce((acc, r) => acc + safeNumber(r.km), 0);
  const totalValor = filtered.reduce((acc, r) => acc + safeNumber(r.valor_total), 0);
  const pendentes = filtered.filter((r) => r.status === 'PENDENTE').length;

  const recarregar = async () => bootstrap();

  // ---------------------------------------------------------------------------
  // ACTIONS (SEM auth.getUser no client)
  // Nota: removemos aprovado_por/pago_por por enquanto para estabilizar navegação.
  // Depois fazemos RPC server-side para preencher via auth.uid().
  // ---------------------------------------------------------------------------
  const aprovarLancamento = async (id: string) => {
    if (!confirm('Aprovar este lançamento de KM?')) return;

    try {
      setLoading(true);

      const { error } = await supabase
        .from('vendedor_km_lancamentos')
        .update({ status: 'APROVADO', aprovado_em: new Date().toISOString() })
        .eq('id', id);

      if (error) throw new Error(error.message);
      await carregarLancamentos(mes);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Erro ao aprovar');
    } finally {
      setLoading(false);
    }
  };

  const rejeitarLancamento = async (id: string) => {
    const motivo = prompt('Motivo da rejeição (obrigatório):');
    if (!motivo || !motivo.trim()) return;

    try {
      setLoading(true);

      const { error } = await supabase
        .from('vendedor_km_lancamentos')
        .update({ status: 'REJEITADO', motivo_rejeicao: motivo.trim() })
        .eq('id', id);

      if (error) throw new Error(error.message);
      await carregarLancamentos(mes);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Erro ao rejeitar');
    } finally {
      setLoading(false);
    }
  };

  const marcarComoPago = async (id: string) => {
    if (!confirm('Marcar este lançamento como PAGO?')) return;

    try {
      setLoading(true);

      const { error } = await supabase
        .from('vendedor_km_lancamentos')
        .update({ status: 'PAGO', pago_em: new Date().toISOString() })
        .eq('id', id);

      if (error) throw new Error(error.message);
      await carregarLancamentos(mes);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Erro ao marcar como pago');
    } finally {
      setLoading(false);
    }
  };

  const badge = (status: KmLancRow['status']) => {
    const base = 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold';
    if (status === 'PENDENTE') return <span className={`${base} bg-yellow-100 text-yellow-800`}>Pendente</span>;
    if (status === 'APROVADO') return <span className={`${base} bg-blue-100 text-blue-800`}>Aprovado</span>;
    if (status === 'PAGO') return <span className={`${base} bg-green-100 text-green-800`}>Pago</span>;
    return <span className={`${base} bg-red-100 text-red-800`}>Rejeitado</span>;
  };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-6 flex items-center gap-3 text-gray-700">
          <RefreshCw className="w-5 h-5 animate-spin" />
          Carregando quilometragem...
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-7 h-7 text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-700 font-bold text-lg">Erro ao carregar quilometragem</p>
              <p className="text-gray-700 mt-2 whitespace-pre-wrap">{erro}</p>

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={recarregar}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold"
                >
                  Tentar novamente
                </button>
              </div>

              <p className="mt-4 text-xs text-gray-500">
                Se o erro mencionar <b>RLS/permission</b>, a policy do ADMIN em <b>vendedor_km_lancamentos</b> pode estar a bloquear.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Quilometragem</h1>
              <p className="text-gray-600 mt-1">Controle de quilometragem e reembolsos (vendedor_km_lancamentos)</p>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-500" />
              <input
                type="month"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
              />
              <button
                type="button"
                onClick={recarregar}
                className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg font-semibold"
              >
                <RefreshCw className="w-4 h-4" />
                Recarregar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-3 rounded-lg">
                  <Car className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total KM</p>
                  <p className="text-2xl font-bold text-gray-900">{totalKm.toLocaleString('pt-PT')}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-600 p-3 rounded-lg">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Reembolso</p>
                  <p className="text-2xl font-bold text-gray-900">€ {formatEUR(totalValor)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-3">
                <div className="bg-orange-600 p-3 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Valor por KM (ref.)</p>
                  <p className="text-2xl font-bold text-gray-900">€ {formatEUR(valorKmRef)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-3">
                <div className="bg-yellow-600 p-3 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Pendentes</p>
                  <p className="text-2xl font-bold text-gray-900">{pendentes}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Pesquisar por vendedor, cliente, data, km, valor ou status..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <select
                value={statusFiltro}
                onChange={(e) => setStatusFiltro(e.target.value as any)}
                className="md:w-56 px-4 py-3 border border-gray-200 rounded-lg bg-white"
              >
                <option value="TODOS">Todos os Status</option>
                <option value="PENDENTE">Pendente</option>
                <option value="APROVADO">Aprovado</option>
                <option value="PAGO">Pago</option>
                <option value="REJEITADO">Rejeitado</option>
              </select>
            </div>
          </div>

          <div className="mt-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Data</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Vendedor</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Cliente</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">KM</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Valor/km</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Total</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Status</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Ações</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-10 text-center text-gray-500">
                        Nenhum registo encontrado para este filtro.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r) => {
                      const vendedorNome = r.vendedores?.nome ?? r.vendedor_id;
                      const clienteNome = r.clientes?.nome ?? (r.cliente_id ?? '—');

                      return (
                        <tr key={r.id} className="hover:bg-blue-50/50 transition-colors">
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {new Date(r.data + 'T00:00:00Z').toLocaleDateString('pt-PT')}
                          </td>

                          <td className="px-6 py-4 text-sm text-gray-900">{vendedorNome}</td>
                          <td className="px-6 py-4 text-sm text-gray-700">{clienteNome}</td>

                          <td className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                            {safeNumber(r.km).toLocaleString('pt-PT')} km
                          </td>

                          <td className="px-6 py-4 text-right text-sm text-gray-900">€ {formatEUR(safeNumber(r.valor_km))}</td>

                          <td className="px-6 py-4 text-right text-sm font-semibold text-emerald-700">
                            € {formatEUR(safeNumber(r.valor_total))}
                          </td>

                          <td className="px-6 py-4 text-center">{badge(r.status)}</td>

                          <td className="px-6 py-4 text-center">
                            <div className="inline-flex items-center gap-2">
                              {r.status === 'PENDENTE' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => aprovarLancamento(r.id)}
                                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-xs font-semibold"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                    Aprovar
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => rejeitarLancamento(r.id)}
                                    className="inline-flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 text-xs font-semibold"
                                  >
                                    <XCircle className="w-4 h-4" />
                                    Rejeitar
                                  </button>
                                </>
                              )}

                              {r.status === 'APROVADO' && (
                                <button
                                  type="button"
                                  onClick={() => marcarComoPago(r.id)}
                                  className="inline-flex items-center gap-2 bg-emerald-600 text-white px-3 py-2 rounded-lg hover:bg-emerald-700 text-xs font-semibold"
                                >
                                  <CreditCard className="w-4 h-4" />
                                  Marcar Pago
                                </button>
                              )}

                              {r.status === 'REJEITADO' && (
                                <span className="text-xs text-gray-500" title={r.motivo_rejeicao ?? ''}>
                                  Rejeitado
                                </span>
                              )}

                              {r.status === 'PAGO' && <span className="text-xs text-gray-500">OK</span>}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
