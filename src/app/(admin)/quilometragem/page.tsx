'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Search,
  Car,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  X,
  Eye,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

type KmStatus = 'PENDENTE' | 'APROVADO' | 'PAGO' | 'REJEITADO';

type KmLancamento = {
  id: string;
  visita_id: string;
  vendedor_id: string;
  cliente_id: string | null;
  data: string; // date
  km: number;
  valor_km: number;
  valor_total: number;
  status: KmStatus;
  motivo_rejeicao: string | null;
  criado_em: string;
  aprovado_em: string | null;
  pago_em: string | null;
  vendedores?: { id: string; nome: string } | null;
};

type LinhaResumo = {
  vendedor_id: string;
  vendedor_nome: string;
  periodoLabel: string; // ex: "Dezembro 2025"
  total_km: number;
  valor_km_ref: number;
  total_reembolso: number;
  status: KmStatus;
  pendentes: number;
  aprovados: number;
  pagos: number;
  rejeitados: number;
};

function safeNumber(n: any): number {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? v : 0;
}

function yyyyMmToDateRange(yyyymm: string) {
  const [yStr, mStr] = yyyymm.split('-');
  const y = Number(yStr);
  const m = Number(mStr); // 1..12
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  const startDate = start.toISOString().slice(0, 10); // YYYY-MM-DD
  const endDate = end.toISOString().slice(0, 10);
  return { startDate, endDate };
}

function monthLabelPt(yyyymm: string) {
  const [yStr, mStr] = yyyymm.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const meses = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];
  return `${meses[m - 1]} ${y}`;
}

function statusBadge(s: KmStatus) {
  switch (s) {
    case 'PAGO':
      return 'bg-emerald-100 text-emerald-800';
    case 'APROVADO':
      return 'bg-blue-100 text-blue-800';
    case 'PENDENTE':
      return 'bg-yellow-100 text-yellow-800';
    case 'REJEITADO':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function statusPrioridade(s: KmStatus) {
  // prioridade para status do “resumo” do vendedor no mês
  // se houver qualquer pendente => PENDENTE
  // senão se houver rejeitado => REJEITADO
  // senão se houver aprovado => APROVADO
  // senão => PAGO
  switch (s) {
    case 'PENDENTE':
      return 4;
    case 'REJEITADO':
      return 3;
    case 'APROVADO':
      return 2;
    case 'PAGO':
      return 1;
    default:
      return 0;
  }
}

export default function QuilometragemAdminPage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [mes, setMes] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });

  const [valorKmRef, setValorKmRef] = useState<number>(0.2);
  const [lancamentos, setLancamentos] = useState<KmLancamento[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<'TODOS' | KmStatus>('TODOS');

  const [modalAberto, setModalAberto] = useState(false);
  const [detalheVendedorId, setDetalheVendedorId] = useState<string | null>(null);

  const periodoLabel = useMemo(() => monthLabelPt(mes), [mes]);

  useEffect(() => {
    (async () => {
      await carregar();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, []);

  useEffect(() => {
    (async () => {
      await carregar();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, [mes]);

  async function carregar() {
    setLoading(true);
    setErro(null);

    try {
      // 1) valor_km de referência (config)
      const { data: cfgRows, error: cfgErr } = await supabase
        .from('configuracoes_financeiras')
        .select('valor_km, created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      if (!cfgErr) {
        const v = safeNumber(cfgRows?.[0]?.valor_km ?? 0.2);
        setValorKmRef(v > 0 ? v : 0.2);
      }

      // 2) carregar lançamentos do mês
      const { startDate, endDate } = yyyyMmToDateRange(mes);

      const { data, error } = await supabase
        .from('vendedor_km_lancamentos')
        .select(
          `
          id,
          visita_id,
          vendedor_id,
          cliente_id,
          data,
          km,
          valor_km,
          valor_total,
          status,
          motivo_rejeicao,
          criado_em,
          aprovado_em,
          pago_em,
          vendedores ( id, nome )
        `
        )
        .gte('data', startDate)
        .lt('data', endDate)
        .order('data', { ascending: false });

      if (error) throw error;

      setLancamentos((data ?? []) as KmLancamento[]);
    } catch (e: any) {
      console.error(e);
      setErro(e?.message || 'Erro ao carregar quilometragem');
      setLancamentos([]);
    } finally {
      setLoading(false);
    }
  }

  const filtrados = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();

    return lancamentos.filter((l) => {
      const nomeVend = String(l.vendedores?.nome ?? '').toLowerCase();
      const matchNome = !s || nomeVend.includes(s) || l.data.toLowerCase().includes(s);

      const matchStatus = statusFiltro === 'TODOS' ? true : l.status === statusFiltro;

      return matchNome && matchStatus;
    });
  }, [lancamentos, searchTerm, statusFiltro]);

  const resumoLinhas: LinhaResumo[] = useMemo(() => {
    const map = new Map<string, LinhaResumo>();

    for (const l of filtrados) {
      const vid = l.vendedor_id;
      const nome = l.vendedores?.nome ?? 'Vendedor';
      const atual = map.get(vid);

      const pend = l.status === 'PENDENTE' ? 1 : 0;
      const apr = l.status === 'APROVADO' ? 1 : 0;
      const pag = l.status === 'PAGO' ? 1 : 0;
      const rej = l.status === 'REJEITADO' ? 1 : 0;

      if (!atual) {
        map.set(vid, {
          vendedor_id: vid,
          vendedor_nome: nome,
          periodoLabel,
          total_km: safeNumber(l.km),
          valor_km_ref: safeNumber(l.valor_km) || valorKmRef,
          total_reembolso: safeNumber(l.valor_total),
          status: l.status,
          pendentes: pend,
          aprovados: apr,
          pagos: pag,
          rejeitados: rej,
        });
      } else {
        atual.total_km += safeNumber(l.km);
        atual.total_reembolso += safeNumber(l.valor_total);
        atual.valor_km_ref = safeNumber(l.valor_km) || atual.valor_km_ref;

        atual.pendentes += pend;
        atual.aprovados += apr;
        atual.pagos += pag;
        atual.rejeitados += rej;

        // status final por prioridade
        if (statusPrioridade(l.status) > statusPrioridade(atual.status)) {
          atual.status = l.status;
        }

        map.set(vid, atual);
      }
    }

    return Array.from(map.values()).sort((a, b) => a.vendedor_nome.localeCompare(b.vendedor_nome));
  }, [filtrados, periodoLabel, valorKmRef]);

  const totalKm = useMemo(() => resumoLinhas.reduce((acc, r) => acc + safeNumber(r.total_km), 0), [resumoLinhas]);
  const totalReembolso = useMemo(
    () => resumoLinhas.reduce((acc, r) => acc + safeNumber(r.total_reembolso), 0),
    [resumoLinhas]
  );
  const pendentesTotal = useMemo(
    () => resumoLinhas.reduce((acc, r) => acc + safeNumber(r.pendentes), 0),
    [resumoLinhas]
  );

  const detalhesDoVendedor = useMemo(() => {
    if (!detalheVendedorId) return [];
    return filtrados.filter((l) => l.vendedor_id === detalheVendedorId);
  }, [filtrados, detalheVendedorId]);

  async function aprovarLancamento(id: string) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('vendedor_km_lancamentos')
        .update({
          status: 'APROVADO',
          aprovado_em: new Date().toISOString(),
          aprovado_por: user?.id ?? null,
          motivo_rejeicao: null,
        })
        .eq('id', id);

      if (error) throw error;

      await carregar();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Erro ao aprovar');
    }
  }

  async function pagarLancamento(id: string) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('vendedor_km_lancamentos')
        .update({
          status: 'PAGO',
          pago_em: new Date().toISOString(),
          pago_por: user?.id ?? null,
        })
        .eq('id', id);

      if (error) throw error;

      await carregar();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Erro ao marcar como pago');
    }
  }

  async function rejeitarLancamento(id: string) {
    const motivo = window.prompt('Motivo da rejeição:');
    if (!motivo || !motivo.trim()) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('vendedor_km_lancamentos')
        .update({
          status: 'REJEITADO',
          motivo_rejeicao: motivo.trim(),
          aprovado_em: new Date().toISOString(),
          aprovado_por: user?.id ?? null,
        })
        .eq('id', id);

      if (error) throw error;

      await carregar();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Erro ao rejeitar');
    }
  }

  function abrirDetalhes(vendedorId: string) {
    setDetalheVendedorId(vendedorId);
    setModalAberto(true);
  }

  function fecharDetalhes() {
    setModalAberto(false);
    setDetalheVendedorId(null);
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando quilometragem...</p>
          </div>
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-900 mb-2">Erro ao carregar quilometragem</h3>
              <div className="text-red-700 mb-4">{erro}</div>
              <button
                onClick={carregar}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Tentar Novamente
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Quilometragem</h1>
            <p className="text-gray-600">Controlo de quilometragem e reembolsos</p>
          </div>

          <div className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-md">
            <Calendar className="w-5 h-5 text-blue-600" />
            <input
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Car className="w-6 h-6 text-blue-700" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total KM</p>
              <p className="text-2xl font-bold text-gray-900">{totalKm.toLocaleString('pt-PT')}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-3 rounded-lg">
              <DollarSign className="w-6 h-6 text-emerald-700" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Reembolso</p>
              <p className="text-2xl font-bold text-gray-900">
                € {totalReembolso.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-3 rounded-lg">
              <AlertCircle className="w-6 h-6 text-orange-700" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Valor por KM</p>
              <p className="text-2xl font-bold text-gray-900">
                € {valorKmRef.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-100 p-3 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-700" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pendentes</p>
              <p className="text-2xl font-bold text-gray-900">{pendentesTotal}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 mb-4">
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar por vendedor ou data..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value as any)}
            className="px-4 py-3 border border-gray-200 rounded-lg bg-white"
          >
            <option value="TODOS">Todos os Status</option>
            <option value="PENDENTE">Pendente</option>
            <option value="APROVADO">Aprovado</option>
            <option value="PAGO">Pago</option>
            <option value="REJEITADO">Rejeitado</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Vendedor</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Período</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Total KM</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Valor/KM</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Total Reembolso</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Status</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {resumoLinhas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                    Nenhum registo encontrado para este filtro.
                  </td>
                </tr>
              ) : (
                resumoLinhas.map((r) => (
                  <tr key={r.vendedor_id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">{r.vendedor_nome}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{r.periodoLabel}</td>
                    <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                      {r.total_km.toLocaleString('pt-PT')} km
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-700">
                      € {r.valor_km_ref.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-semibold text-emerald-700">
                      € {r.total_reembolso.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => abrirDetalhes(r.vendedor_id)}
                        className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
                      >
                        <Eye className="w-4 h-4" />
                        Ver Detalhes
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Detalhes de Quilometragem ({periodoLabel})</h2>
                <button onClick={fecharDetalhes} className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {detalhesDoVendedor.length === 0 ? (
                <div className="text-gray-600">Sem lançamentos.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Data</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Visita</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">KM</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Valor/KM</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Total</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Status</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {detalhesDoVendedor.map((l) => (
                        <tr key={l.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {new Date(l.data).toLocaleDateString('pt-PT')}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">{l.visita_id}</td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                            {safeNumber(l.km).toLocaleString('pt-PT')}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-700">
                            € {safeNumber(l.valor_km).toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-emerald-700">
                            € {safeNumber(l.valor_total).toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(l.status)}`}>
                              {l.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {l.status === 'PENDENTE' && (
                                <>
                                  <button
                                    onClick={() => aprovarLancamento(l.id)}
                                    className="inline-flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                    Aprovar
                                  </button>
                                  <button
                                    onClick={() => rejeitarLancamento(l.id)}
                                    className="inline-flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm font-semibold"
                                  >
                                    <AlertCircle className="w-4 h-4" />
                                    Rejeitar
                                  </button>
                                </>
                              )}

                              {l.status === 'APROVADO' && (
                                <button
                                  onClick={() => pagarLancamento(l.id)}
                                  className="inline-flex items-center gap-2 bg-emerald-600 text-white px-3 py-2 rounded-lg hover:bg-emerald-700 transition-colors text-sm font-semibold"
                                >
                                  <DollarSign className="w-4 h-4" />
                                  Marcar Pago
                                </button>
                              )}

                              {l.status === 'REJEITADO' && l.motivo_rejeicao && (
                                <span className="text-xs text-red-700">Motivo: {l.motivo_rejeicao}</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-gray-700">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900">Regras</p>
                    <p className="mt-1">
                      O Financeiro deve considerar KM <span className="font-semibold">APROVADO</span> ou <span className="font-semibold">PAGO</span>.
                      Enquanto estiver <span className="font-semibold">PENDENTE</span>, não entra nos custos do mês.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

