'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Car,
  DollarSign,
  Calendar,
  Search,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  MapPin,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

type KmStatus = 'PENDENTE' | 'APROVADO' | 'PAGO' | 'REJEITADO';

type KmLancRow = {
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
  vendedores?: { id: string; nome: string | null } | null;
  clientes?: { id: string; nome: string | null } | null;
};

type GroupRow = {
  key: string; // vendedor_id|yyyy-mm
  vendedor_id: string;
  vendedor_nome: string;
  periodo_label: string; // "Março 2025"
  ano: number;
  mes: number;
  total_km: number;
  valor_km_ref: number; // média simples do período
  total_reembolso: number;
  status_geral: KmStatus;
  pendentes: number;
  aprovados: number;
  pagos: number;
  rejeitados: number;
};

function safeNumber(n: any): number {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? v : 0;
}

function yyyyMm(dateStr: string): string {
  return dateStr.slice(0, 7); // YYYY-MM
}

function monthLabelPT(ano: number, mes: number): string {
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
  return `${meses[mes - 1]} ${ano}`;
}

function statusBadge(status: KmStatus) {
  switch (status) {
    case 'PAGO':
      return 'bg-emerald-100 text-emerald-800';
    case 'APROVADO':
      return 'bg-blue-100 text-blue-800';
    case 'PENDENTE':
      return 'bg-yellow-100 text-yellow-800';
    case 'REJEITADO':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function statusIcon(status: KmStatus) {
  switch (status) {
    case 'PAGO':
      return <CheckCircle2 className="w-4 h-4" />;
    case 'APROVADO':
      return <CheckCircle2 className="w-4 h-4" />;
    case 'PENDENTE':
      return <Clock className="w-4 h-4" />;
    case 'REJEITADO':
      return <XCircle className="w-4 h-4" />;
    default:
      return <AlertCircle className="w-4 h-4" />;
  }
}

function computeGroupStatus(p: { pendentes: number; aprovados: number; pagos: number; rejeitados: number }): KmStatus {
  if (p.pendentes > 0) return 'PENDENTE';
  if (p.aprovados > 0) return 'APROVADO';
  if (p.pagos > 0) return 'PAGO';
  return 'REJEITADO';
}

function yyyyMmToDateRange(yyyymm: string) {
  const [yStr, mStr] = yyyymm.split('-');
  const y = Number(yStr);
  const m = Number(mStr); // 1..12
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1)); // próximo mês
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);
  return { startDate, endDate, ano: y, mes: m };
}

export default function QuilometragemAdminPage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [mesFiltro, setMesFiltro] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });

  const [statusFiltro, setStatusFiltro] = useState<'TODOS' | KmStatus>('TODOS');
  const [searchTerm, setSearchTerm] = useState('');

  const [rows, setRows] = useState<GroupRow[]>([]);
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);
  const [detalhesGroup, setDetalhesGroup] = useState<GroupRow | null>(null);
  const [detalhesLanc, setDetalhesLanc] = useState<KmLancRow[]>([]);
  const [detalhesLoading, setDetalhesLoading] = useState(false);

  const [valorKmRef, setValorKmRef] = useState<number>(0.2);

  async function carregarValorKmRef() {
    const { data, error } = await supabase
      .from('configuracoes_financeiras')
      .select('valor_km')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!error) {
      const v = safeNumber(data?.[0]?.valor_km ?? 0.2);
      setValorKmRef(v > 0 ? v : 0.2);
    }
  }

  async function carregar() {
    setLoading(true);
    setErro(null);

    try {
      await carregarValorKmRef();

      const { startDate, endDate } = yyyyMmToDateRange(mesFiltro);

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
          vendedores:vendedores ( id, nome ),
          clientes:clientes ( id, nome )
        `
        )
        .gte('data', startDate)
        .lt('data', endDate)
        .order('data', { ascending: false });

      if (error) throw error;

      const lanc = (data ?? []) as KmLancRow[];

      const map = new Map<string, GroupRow>();

      for (const r of lanc) {
        const ym = yyyyMm(r.data);
        const key = `${r.vendedor_id}|${ym}`;

        const [anoStr, mesStr] = ym.split('-');
        const ano = Number(anoStr);
        const mes = Number(mesStr);

        const vendNome = r.vendedores?.nome ?? '—';

        if (!map.has(key)) {
          map.set(key, {
            key,
            vendedor_id: r.vendedor_id,
            vendedor_nome: vendNome,
            periodo_label: monthLabelPT(ano, mes),
            ano,
            mes,
            total_km: 0,
            valor_km_ref: 0,
            total_reembolso: 0,
            status_geral: 'PENDENTE',
            pendentes: 0,
            aprovados: 0,
            pagos: 0,
            rejeitados: 0,
          });
        }

        const g = map.get(key)!;
        g.total_km += safeNumber(r.km);
        g.total_reembolso += safeNumber(r.valor_total);
        g.valor_km_ref += safeNumber(r.valor_km);

        if (r.status === 'PENDENTE') g.pendentes += 1;
        if (r.status === 'APROVADO') g.aprovados += 1;
        if (r.status === 'PAGO') g.pagos += 1;
        if (r.status === 'REJEITADO') g.rejeitados += 1;
      }

      const grouped = Array.from(map.values()).map((g) => {
        const totalLanc = g.pendentes + g.aprovados + g.pagos + g.rejeitados;
        const mediaValorKm = totalLanc > 0 ? g.valor_km_ref / totalLanc : valorKmRef;

        return {
          ...g,
          valor_km_ref: mediaValorKm > 0 ? mediaValorKm : valorKmRef,
          status_geral: computeGroupStatus(g),
        };
      });

      grouped.sort((a, b) => a.vendedor_nome.localeCompare(b.vendedor_nome));

      setRows(grouped);
    } catch (e: any) {
      console.error(e);
      setErro(e?.message || 'Erro ao carregar quilometragem');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesFiltro]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const s = searchTerm.trim().toLowerCase();
      const matchSearch =
        !s ||
        r.vendedor_nome.toLowerCase().includes(s) ||
        r.periodo_label.toLowerCase().includes(s) ||
        String(r.total_km).toLowerCase().includes(s) ||
        String(r.total_reembolso).toLowerCase().includes(s);

      const matchStatus = statusFiltro === 'TODOS' ? true : r.status_geral === statusFiltro;

      return matchSearch && matchStatus;
    });
  }, [rows, searchTerm, statusFiltro]);

  const totalKm = useMemo(() => filtered.reduce((acc, r) => acc + safeNumber(r.total_km), 0), [filtered]);
  const totalReembolso = useMemo(() => filtered.reduce((acc, r) => acc + safeNumber(r.total_reembolso), 0), [filtered]);
  const pendentes = useMemo(() => filtered.reduce((acc, r) => acc + (r.pendentes > 0 ? 1 : 0), 0), [filtered]);

  async function abrirDetalhes(g: GroupRow) {
    setDetalhesAbertos(true);
    setDetalhesGroup(g);
    setDetalhesLanc([]);
    setDetalhesLoading(true);

    try {
      const yyyymm = `${g.ano}-${String(g.mes).padStart(2, '0')}`;
      const { startDate, endDate } = yyyyMmToDateRange(yyyymm);

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
          vendedores:vendedores ( id, nome ),
          clientes:clientes ( id, nome )
        `
        )
        .eq('vendedor_id', g.vendedor_id)
        .gte('data', startDate)
        .lt('data', endDate)
        .order('data', { ascending: false });

      if (error) throw error;

      setDetalhesLanc((data ?? []) as KmLancRow[]);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Erro ao carregar detalhes');
    } finally {
      setDetalhesLoading(false);
    }
  }

  function fecharDetalhes() {
    setDetalhesAbertos(false);
    setDetalhesGroup(null);
    setDetalhesLanc([]);
  }

  async function aprovarGrupo(g: GroupRow) {
    const ok = confirm(`Aprovar todos os lançamentos PENDENTES de ${g.vendedor_nome} em ${g.periodo_label}?`);
    if (!ok) return;

    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id ?? null;

      const yyyymm = `${g.ano}-${String(g.mes).padStart(2, '0')}`;
      const { startDate, endDate } = yyyyMmToDateRange(yyyymm);

      const { error } = await supabase
        .from('vendedor_km_lancamentos')
        .update({
          status: 'APROVADO',
          aprovado_em: new Date().toISOString(),
          aprovado_por: userId,
        })
        .eq('vendedor_id', g.vendedor_id)
        .gte('data', startDate)
        .lt('data', endDate)
        .eq('status', 'PENDENTE');

      if (error) throw error;

      await carregar();
      alert('KM aprovado com sucesso.');
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Erro ao aprovar');
    }
  }

  async function marcarPagoGrupo(g: GroupRow) {
    const ok = confirm(`Marcar como PAGO todos os lançamentos APROVADOS de ${g.vendedor_nome} em ${g.periodo_label}?`);
    if (!ok) return;

    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id ?? null;

      const yyyymm = `${g.ano}-${String(g.mes).padStart(2, '0')}`;
      const { startDate, endDate } = yyyyMmToDateRange(yyyymm);

      const { error } = await supabase
        .from('vendedor_km_lancamentos')
        .update({
          status: 'PAGO',
          pago_em: new Date().toISOString(),
          pago_por: userId,
        })
        .eq('vendedor_id', g.vendedor_id)
        .gte('data', startDate)
        .lt('data', endDate)
        .eq('status', 'APROVADO');

      if (error) throw error;

      await carregar();
      alert('KM marcado como PAGO com sucesso.');
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Erro ao marcar como pago');
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <p className="text-gray-600">Carregando quilometragem...</p>
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-900 font-semibold text-lg">Erro ao carregar</p>
              <p className="text-red-700 mt-1">{erro}</p>
              <button
                type="button"
                onClick={carregar}
                className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700"
              >
                Tentar novamente
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
            <p className="text-gray-600">Controle de quilometragem e reembolsos</p>
          </div>

          <div className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-md">
            <Calendar className="w-5 h-5 text-blue-600" />
            <input
              type="month"
              value={mesFiltro}
              onChange={(e) => setMesFiltro(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-3 rounded-xl">
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
            <div className="bg-emerald-100 p-3 rounded-xl">
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
            <div className="bg-orange-100 p-3 rounded-xl">
              <MapPin className="w-6 h-6 text-orange-700" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Valor por KM (ref.)</p>
              <p className="text-2xl font-bold text-gray-900">
                € {valorKmRef.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-100 p-3 rounded-xl">
              <Clock className="w-6 h-6 text-yellow-700" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pendentes</p>
              <p className="text-2xl font-bold text-gray-900">{pendentes}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar por vendedor ou período..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value as any)}
            className="px-4 py-3 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="TODOS">Todos os Status</option>
            <option value="PENDENTE">Pendente</option>
            <option value="APROVADO">Aprovado</option>
            <option value="PAGO">Pago</option>
            <option value="REJEITADO">Rejeitado</option>
          </select>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Vendedor</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Período</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Total KM</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Valor/KM</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Total Reembolso</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Status</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    Nenhum registo encontrado para este filtro.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.key} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">{r.vendedor_nome}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{r.periodo_label}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">{Math.round(r.total_km).toLocaleString('pt-PT')} km</td>
                    <td className="px-6 py-4 text-sm text-gray-700 text-right">
                      € {r.valor_km_ref.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-emerald-700 text-right">
                      € {r.total_reembolso.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(r.status_geral)}`}>
                        {statusIcon(r.status_geral)}
                        {r.status_geral.charAt(0) + r.status_geral.slice(1).toLowerCase()}
                      </span>
                      <div className="text-[11px] text-gray-500 mt-1">
                        P:{r.pendentes} A:{r.aprovados} Pg:{r.pagos} Rj:{r.rejeitados}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => abrirDetalhes(r)}
                          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
                        >
                          <Eye className="w-4 h-4" />
                          Ver Detalhes
                        </button>

                        {r.pendentes > 0 && (
                          <button
                            type="button"
                            onClick={() => aprovarGrupo(r)}
                            className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors text-sm font-semibold"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Aprovar
                          </button>
                        )}

                        {r.aprovados > 0 && (
                          <button
                            type="button"
                            onClick={() => marcarPagoGrupo(r)}
                            className="inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm font-semibold"
                          >
                            <DollarSign className="w-4 h-4" />
                            Marcar Pago
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detalhes */}
      {detalhesAbertos && detalhesGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-gray-900">Detalhes de Quilometragem</p>
                <p className="text-sm text-gray-600">
                  {detalhesGroup.vendedor_nome} — {detalhesGroup.periodo_label}
                </p>
              </div>
              <button
                type="button"
                onClick={fecharDetalhes}
                className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold"
              >
                Fechar
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[75vh]">
              {detalhesLoading ? (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-gray-700">
                  Carregando detalhes...
                </div>
              ) : detalhesLanc.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-gray-700">
                  Nenhum lançamento encontrado.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Data</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Cliente</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">KM</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Valor/KM</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Valor Total</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {detalhesLanc.map((l) => (
                        <tr key={l.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {new Date(l.data).toLocaleDateString('pt-PT')}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">{l.clientes?.nome ?? '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">
                            {safeNumber(l.km).toLocaleString('pt-PT')} km
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 text-right">
                            € {safeNumber(l.valor_km).toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-emerald-700 text-right">
                            € {safeNumber(l.valor_total).toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(l.status)}`}>
                              {statusIcon(l.status)}
                              {l.status.charAt(0) + l.status.slice(1).toLowerCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-5 flex gap-2">
                {detalhesGroup.pendentes > 0 && (
                  <button
                    type="button"
                    onClick={() => aprovarGrupo(detalhesGroup)}
                    className="bg-emerald-600 text-white px-5 py-3 rounded-lg hover:bg-emerald-700 transition-colors font-semibold inline-flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Aprovar pendentes deste mês
                  </button>
                )}
                {detalhesGroup.aprovados > 0 && (
                  <button
                    type="button"
                    onClick={() => marcarPagoGrupo(detalhesGroup)}
                    className="bg-purple-600 text-white px-5 py-3 rounded-lg hover:bg-purple-700 transition-colors font-semibold inline-flex items-center gap-2"
                  >
                    <DollarSign className="w-5 h-5" />
                    Marcar aprovados como pago
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

