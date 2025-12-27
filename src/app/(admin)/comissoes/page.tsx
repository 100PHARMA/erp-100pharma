'use client';

import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  TrendingUp,
  DollarSign,
  Users,
  Package,
  Receipt,
  Target,
  RefreshCw,
  Eye,
  X,
  Lock,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { PeriodoMesPicker } from '@/components/PeriodoMesPicker';
import { getVendedorMetricasMes, type VendedorMetricasMes } from '@/lib/vendedor-metricas';

// =====================================================
// TIPOS
// =====================================================

type RowComissao = {
  vendedor_id: string;
  vendedor_nome: string;

  base_sem_iva: number;
  comissao_calculada: number;

  faixa_atual: 'FAIXA_1' | 'FAIXA_2' | 'FAIXA_3';
  percentual_meta: number;

  num_faturas: number;
  clientes_unicos: number;
  frascos: number;

  ticket_medio: number;
  preco_medio_frasco: number;

  faturas_pagas: number;
  faturas_pendentes: number;

  // mês fechado → snapshot tem config congelada (opcional p/ rótulos)
  comissao_faixa1?: number;
  comissao_faixa2?: number;
  comissao_faixa3?: number;

  // (opcional) para exibir "Meta: X€" no fechado se quiser
  meta_mensal?: number;
};

type SortKey =
  | 'base_sem_iva'
  | 'comissao_calculada'
  | 'frascos'
  | 'clientes_unicos'
  | 'num_faturas'
  | 'ticket_medio'
  | 'preco_medio_frasco'
  | 'vendedor_nome';

type SortDir = 'asc' | 'desc';

type RpcDetalheRow = {
  fatura_id: string;
  numero: string;
  data_emissao: string;
  tipo: string;
  estado: string;
  cliente_nome: string | null;
  base_sem_iva: number;
};

type SnapshotRow = {
  vendedor_id: string;
  ano: number;
  mes: number;

  base_sem_iva: number;
  comissao_calculada: number;
  faixa_atual: string;
  percentual_meta: number;

  num_faturas: number;
  clientes_unicos: number;
  frascos: number;

  faturas_pagas: number;
  faturas_pendentes: number;

  // config congelada
  meta_mensal: number;
  comissao_faixa1: number;
  comissao_faixa2: number;
  comissao_faixa3: number;

  fechado_em: string;

  vendedores?: { nome: string } | null;
};

// =====================================================
// HELPERS
// =====================================================

function formatCurrencyEUR(valor: number) {
  return (
    valor.toLocaleString('pt-PT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + '€'
  );
}

function formatInt(n: number) {
  return n.toLocaleString('pt-PT');
}

function safeNum(v: unknown, fallback = 0) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeFaixa(v: any): 'FAIXA_1' | 'FAIXA_2' | 'FAIXA_3' {
  return v === 'FAIXA_2' ? 'FAIXA_2' : v === 'FAIXA_3' ? 'FAIXA_3' : 'FAIXA_1';
}

function faixaBadge(faixa: 'FAIXA_1' | 'FAIXA_2' | 'FAIXA_3') {
  if (faixa === 'FAIXA_1') return 'bg-blue-100 text-blue-800';
  if (faixa === 'FAIXA_2') return 'bg-yellow-100 text-yellow-800';
  return 'bg-green-100 text-green-800';
}

function faixaPercentLabel(
  faixa: 'FAIXA_1' | 'FAIXA_2' | 'FAIXA_3',
  row: RowComissao,
  mesFechado: boolean
) {
  // mês fechado → usar snapshot (percentuais congelados)
  if (mesFechado) {
    if (faixa === 'FAIXA_1' && Number.isFinite(row.comissao_faixa1 as any))
      return `${row.comissao_faixa1}%`;
    if (faixa === 'FAIXA_2' && Number.isFinite(row.comissao_faixa2 as any))
      return `${row.comissao_faixa2}%`;
    if (faixa === 'FAIXA_3' && Number.isFinite(row.comissao_faixa3 as any))
      return `${row.comissao_faixa3}%`;
    return faixa === 'FAIXA_1' ? 'FAIXA 1' : faixa === 'FAIXA_2' ? 'FAIXA 2' : 'FAIXA 3';
  }

  // mês aberto → apenas rótulo de faixa (comissão já vem calculada do getVendedorMetricasMes)
  return faixa === 'FAIXA_1' ? 'FAIXA 1' : faixa === 'FAIXA_2' ? 'FAIXA 2' : 'FAIXA 3';
}

// =====================================================
// PAGE WRAPPER (Suspense obrigatório por useSearchParams)
// =====================================================

export default function ComissoesPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <p className="text-gray-700 font-medium">Carregando comissões...</p>
            </div>
          </div>
        </div>
      }
    >
      <ComissoesClient />
    </Suspense>
  );
}

// =====================================================
// CLIENT
// =====================================================

function ComissoesClient() {
  const sp = useSearchParams();

  const now = new Date();
  const anoAtual = now.getUTCFullYear();
  const mesAtual = now.getUTCMonth() + 1;

  const anoSelecionado = Number(sp.get('ano')) || anoAtual;
  const mesSelecionado = Number(sp.get('mes')) || mesAtual;

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [rows, setRows] = useState<RowComissao[]>([]);
  const [mesFechado, setMesFechado] = useState(false);
  const [fechadoEm, setFechadoEm] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>('base_sem_iva');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Modal detalhe
  const [detalheAberto, setDetalheAberto] = useState(false);
  const [detalheVendedor, setDetalheVendedor] = useState<{ id: string; nome: string } | null>(
    null
  );
  const [detalheLoading, setDetalheLoading] = useState(false);
  const [detalheErro, setDetalheErro] = useState<string | null>(null);
  const [detalheFaturas, setDetalheFaturas] = useState<
    Array<{
      id: string;
      numero: string;
      data_emissao: string;
      estado: string;
      tipo: string;
      cliente_nome: string;
      base_sem_iva: number;
    }>
  >([]);

  // ESC + trava scroll quando modal aberto
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') fecharDetalhe();
    }

    if (detalheAberto) {
      document.addEventListener('keydown', onKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detalheAberto]);

  // =====================================================
  // CARREGAMENTO (SNAPSHOT -> FONTE ÚNICA)
  // =====================================================

  async function carregar() {
    setLoading(true);
    setErro(null);

    try {
      // 1) Tenta snapshot (mês FECHADO)
      const { data: snapData, error: snapError } = await supabase
        .from('comissoes_mensais')
        .select(
          `
          vendedor_id, ano, mes,
          base_sem_iva, comissao_calculada, faixa_atual, percentual_meta,
          num_faturas, clientes_unicos, frascos, faturas_pagas, faturas_pendentes,
          meta_mensal, comissao_faixa1, comissao_faixa2, comissao_faixa3,
          fechado_em,
          vendedores ( nome )
        `
        )
        .eq('ano', anoSelecionado)
        .eq('mes', mesSelecionado);

      if (snapError) throw snapError;

      const snaps = (snapData || []) as SnapshotRow[];

      if (snaps.length > 0) {
        setMesFechado(true);
        setFechadoEm(snaps[0]?.fechado_em || null);

        const rowsOut: RowComissao[] = snaps.map((s) => {
          const base = safeNum(s.base_sem_iva, 0);
          const numFaturas = safeNum(s.num_faturas, 0);
          const frascos = safeNum(s.frascos, 0);

          const ticketMedio = numFaturas > 0 ? base / numFaturas : 0;
          const precoMedioFrasco = frascos > 0 ? base / frascos : 0;

          return {
            vendedor_id: s.vendedor_id,
            vendedor_nome: s.vendedores?.nome || '—',
            base_sem_iva: base,
            comissao_calculada: safeNum(s.comissao_calculada, 0),
            faixa_atual: normalizeFaixa(s.faixa_atual),
            percentual_meta: safeNum(s.percentual_meta, 0),

            num_faturas: numFaturas,
            clientes_unicos: safeNum(s.clientes_unicos, 0),
            frascos,
            ticket_medio: ticketMedio,
            preco_medio_frasco: precoMedioFrasco,

            faturas_pagas: safeNum(s.faturas_pagas, 0),
            faturas_pendentes: safeNum(s.faturas_pendentes, 0),

            meta_mensal: safeNum(s.meta_mensal, 0),
            comissao_faixa1: safeNum(s.comissao_faixa1, 0),
            comissao_faixa2: safeNum(s.comissao_faixa2, 0),
            comissao_faixa3: safeNum(s.comissao_faixa3, 0),
          };
        });

        setRows(rowsOut);
        return;
      }

      // 2) ABERTO: fonte única
      setMesFechado(false);
      setFechadoEm(null);

      const met = await getVendedorMetricasMes(anoSelecionado, mesSelecionado);

      // Precisamos do nome do vendedor na UI
      const { data: vendData, error: vendErr } = await supabase
        .from('vendedores')
        .select('id,nome')
        .order('nome', { ascending: true });

      if (vendErr) throw vendErr;

      const nomePorId = new Map<string, string>();
      for (const v of vendData || []) nomePorId.set((v as any).id, (v as any).nome);

      const rowsOut: RowComissao[] = (met || []).map((m: VendedorMetricasMes) => {
        const base = safeNum((m as any).base_sem_iva, 0);
        const numFaturas = safeNum((m as any).num_faturas, 0);
        const frascos = safeNum((m as any).frascos, 0);

        const ticketMedio = numFaturas > 0 ? base / numFaturas : 0;
        const precoMedioFrasco = frascos > 0 ? base / frascos : 0;

        return {
          vendedor_id: (m as any).vendedor_id,
          vendedor_nome: nomePorId.get((m as any).vendedor_id) || '—',

          base_sem_iva: base,
          comissao_calculada: safeNum((m as any).comissao_calculada, 0),
          faixa_atual: normalizeFaixa((m as any).faixa_atual),
          percentual_meta: safeNum((m as any).percentual_meta, 0),

          num_faturas: numFaturas,
          clientes_unicos: safeNum((m as any).clientes_unicos, 0),
          frascos,

          ticket_medio: ticketMedio,
          preco_medio_frasco: precoMedioFrasco,

          faturas_pagas: safeNum((m as any).faturas_pagas, 0),
          faturas_pendentes: safeNum((m as any).faturas_pendentes, 0),
        };
      });

      setRows(rowsOut);
    } catch (e: any) {
      console.error(e);
      setErro(e?.message || 'Erro ao carregar comissões');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anoSelecionado, mesSelecionado]);

  // =====================================================
  // FECHAR MÊS
  // =====================================================

  async function fecharMes() {
    if (mesFechado) return;

    const ok = window.confirm(
      `Tem certeza que deseja FECHAR o mês ${anoSelecionado}-${String(mesSelecionado).padStart(
        2,
        '0'
      )}?\n\nDepois de fechado, os valores ficam imutáveis (snapshot).`
    );
    if (!ok) return;

    try {
      setLoading(true);
      setErro(null);

      const { error } = await supabase.rpc('fechar_comissoes_mes', {
        p_ano: anoSelecionado,
        p_mes: mesSelecionado,
      });

      if (error) throw error;

      await carregar();
    } catch (e: any) {
      console.error(e);
      setErro(e?.message || 'Erro ao fechar mês');
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // STATS
  // =====================================================

  const stats = useMemo(() => {
    const totalBase = rows.reduce((acc, r) => acc + r.base_sem_iva, 0);
    const totalComissao = rows.reduce((acc, r) => acc + r.comissao_calculada, 0);
    const totalFrascos = rows.reduce((acc, r) => acc + r.frascos, 0);
    const totalFaturas = rows.reduce((acc, r) => acc + r.num_faturas, 0);
    const ticketMedioGeral = totalFaturas > 0 ? totalBase / totalFaturas : 0;

    const totalPendentes = rows.reduce((acc, r) => acc + r.faturas_pendentes, 0);
    const totalPagas = rows.reduce((acc, r) => acc + r.faturas_pagas, 0);

    return {
      totalBase,
      totalComissao,
      totalFrascos,
      totalFaturas,
      ticketMedioGeral,
      totalPendentes,
      totalPagas,
    };
  }, [rows]);

  // =====================================================
  // SORT
  // =====================================================

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;

      if (sortKey === 'vendedor_nome') {
        return a.vendedor_nome.localeCompare(b.vendedor_nome) * dir;
      }

      const av = (a as any)[sortKey] as number;
      const bv = (b as any)[sortKey] as number;
      return (av - bv) * dir;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  // =====================================================
  // DETALHE VENDEDOR (RPC)
  // =====================================================

  async function abrirDetalhe(vendedorId: string, vendedorNome: string) {
    setDetalheAberto(true);
    setDetalheVendedor({ id: vendedorId, nome: vendedorNome });
    setDetalheLoading(true);
    setDetalheErro(null);
    setDetalheFaturas([]);

    try {
      const { data, error } = await supabase.rpc('relatorio_comissoes_detalhe_mes', {
        p_vendedor_id: vendedorId,
        p_ano: anoSelecionado,
        p_mes: mesSelecionado,
      });

      if (error) throw error;

      const detalhe = (data || []) as RpcDetalheRow[];

      setDetalheFaturas(
        detalhe.map((r) => ({
          id: r.fatura_id,
          numero: r.numero,
          data_emissao: r.data_emissao,
          estado: r.estado,
          tipo: r.tipo || 'FATURA',
          cliente_nome: r.cliente_nome || '—',
          base_sem_iva: safeNum(r.base_sem_iva, 0),
        }))
      );
    } catch (e: any) {
      console.error(e);
      setDetalheErro(e?.message || 'Erro ao carregar detalhe');
    } finally {
      setDetalheLoading(false);
    }
  }

  function fecharDetalhe() {
    setDetalheAberto(false);
    setDetalheVendedor(null);
    setDetalheErro(null);
    setDetalheFaturas([]);
  }

  // =====================================================
  // RENDER
  // =====================================================

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <p className="text-gray-700 font-medium">Carregando comissões e performance...</p>
          </div>
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <p className="text-red-600 font-semibold mb-2">Erro ao carregar</p>
          <p className="text-gray-700 mb-4">{erro}</p>
          <button
            type="button"
            onClick={carregar}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Comissões</h1>

              <span
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${
                  mesFechado ? 'bg-gray-900 text-white' : 'bg-blue-100 text-blue-800'
                }`}
              >
                {mesFechado ? (
                  <>
                    <Lock className="w-4 h-4" /> MÊS FECHADO
                  </>
                ) : (
                  <>MÊS ABERTO</>
                )}
              </span>

              {mesFechado && fechadoEm && (
                <span className="text-xs text-gray-500">
                  Fechado em {new Date(fechadoEm).toLocaleString('pt-PT')}
                </span>
              )}
            </div>

            <p className="text-gray-600 text-sm sm:text-base">
              Base: <strong>€ sem IVA</strong>, sempre por <strong>faturas emitidas</strong>. Snapshot
              mensal quando fechado.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <PeriodoMesPicker />

            {!mesFechado && (
              <button
                type="button"
                onClick={fecharMes}
                className="bg-red-600 text-white px-4 py-3 rounded-xl font-semibold shadow-lg flex items-center gap-2 justify-center hover:opacity-95"
              >
                <Lock className="w-5 h-5" />
                Fechar mês
              </button>
            )}

            <button
              type="button"
              onClick={carregar}
              className="bg-gray-900 text-white px-4 py-3 rounded-xl font-semibold shadow-lg flex items-center gap-2 justify-center hover:opacity-95"
            >
              <RefreshCw className="w-5 h-5" />
              Atualizar
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <StatCard
          title="Base (sem IVA)"
          value={formatCurrencyEUR(stats.totalBase)}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <StatCard
          title="Comissão"
          value={formatCurrencyEUR(stats.totalComissao)}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatCard
          title="Frascos"
          value={formatInt(stats.totalFrascos)}
          icon={<Package className="w-5 h-5" />}
        />
        <StatCard
          title="Faturas"
          value={formatInt(stats.totalFaturas)}
          icon={<Receipt className="w-5 h-5" />}
        />
        <StatCard
          title="Ticket médio"
          value={formatCurrencyEUR(stats.ticketMedioGeral)}
          icon={<Users className="w-5 h-5" />}
        />
        <StatCard
          title={mesFechado ? 'Pagas / Pendentes (no fecho)' : 'Pagas / Pendentes'}
          value={`${formatInt(stats.totalPagas)} / ${formatInt(stats.totalPendentes)}`}
          icon={<Target className="w-5 h-5" />}
        />
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <Th
                  onClick={() => toggleSort('vendedor_nome')}
                  active={sortKey === 'vendedor_nome'}
                  dir={sortDir}
                >
                  Vendedor
                </Th>
                <ThRight
                  onClick={() => toggleSort('base_sem_iva')}
                  active={sortKey === 'base_sem_iva'}
                  dir={sortDir}
                >
                  Base (sem IVA)
                </ThRight>
                <ThRight
                  onClick={() => toggleSort('comissao_calculada')}
                  active={sortKey === 'comissao_calculada'}
                  dir={sortDir}
                >
                  Comissão
                </ThRight>
                <ThCenter>Faixa</ThCenter>
                <ThRight
                  onClick={() => toggleSort('num_faturas')}
                  active={sortKey === 'num_faturas'}
                  dir={sortDir}
                >
                  Nº faturas
                </ThRight>
                <ThRight
                  onClick={() => toggleSort('clientes_unicos')}
                  active={sortKey === 'clientes_unicos'}
                  dir={sortDir}
                >
                  Clientes únicos
                </ThRight>
                <ThRight
                  onClick={() => toggleSort('frascos')}
                  active={sortKey === 'frascos'}
                  dir={sortDir}
                >
                  Frascos
                </ThRight>
                <ThRight
                  onClick={() => toggleSort('ticket_medio')}
                  active={sortKey === 'ticket_medio'}
                  dir={sortDir}
                >
                  Ticket médio
                </ThRight>
                <ThRight
                  onClick={() => toggleSort('preco_medio_frasco')}
                  active={sortKey === 'preco_medio_frasco'}
                  dir={sortDir}
                >
                  €/frasco (médio)
                </ThRight>
                <ThRight>Meta</ThRight>
                <ThCenter>Ações</ThCenter>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {sortedRows.map((r) => (
                <tr key={r.vendedor_id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-4 sm:px-6">
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-900">{r.vendedor_nome}</span>
                      <span className="text-xs text-gray-500">
                        {mesFechado ? 'No fecho — ' : ''}
                        Pagas: {r.faturas_pagas} • Pendentes: {r.faturas_pendentes}
                      </span>
                    </div>
                  </td>

                  <td className="py-4 px-4 text-right">
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrencyEUR(r.base_sem_iva)}
                    </span>
                  </td>

                  <td className="py-4 px-4 text-right">
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrencyEUR(r.comissao_calculada)}
                    </span>
                  </td>

                  <td className="py-4 px-4 text-center">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${faixaBadge(
                        r.faixa_atual
                      )}`}
                    >
                      {faixaPercentLabel(r.faixa_atual, r, mesFechado)}
                    </span>
                  </td>

                  <td className="py-4 px-4 text-right">
                    <span className="text-sm text-gray-900">{formatInt(r.num_faturas)}</span>
                  </td>

                  <td className="py-4 px-4 text-right">
                    <span className="text-sm text-gray-900">{formatInt(r.clientes_unicos)}</span>
                  </td>

                  <td className="py-4 px-4 text-right">
                    <span className="text-sm text-gray-900">{formatInt(r.frascos)}</span>
                  </td>

                  <td className="py-4 px-4 text-right">
                    <span className="text-sm text-gray-900">
                      {formatCurrencyEUR(r.ticket_medio)}
                    </span>
                  </td>

                  <td className="py-4 px-4 text-right">
                    <span className="text-sm text-gray-900">
                      {formatCurrencyEUR(r.preco_medio_frasco)}
                    </span>
                  </td>

                  <td className="py-4 px-4 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-semibold text-gray-900">
                        {Math.round(r.percentual_meta)}%
                      </span>
                      {mesFechado && Number.isFinite(r.meta_mensal as any) && (
                        <span className="text-xs text-gray-500">
                          Meta: {formatCurrencyEUR(safeNum(r.meta_mensal, 0))}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-4 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => abrirDetalhe(r.vendedor_id, r.vendedor_nome)}
                      className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700"
                    >
                      <Eye className="w-4 h-4" />
                      Ver
                    </button>
                  </td>
                </tr>
              ))}

              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-gray-600">
                    Nenhum dado encontrado para o período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal detalhe */}
      {detalheAberto && detalheVendedor && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) fecharDetalhe();
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-xl font-bold">Detalhe do mês — {detalheVendedor.nome}</h2>
                <p className="text-sm text-white/80">
                  {anoSelecionado}-{String(mesSelecionado).padStart(2, '0')} • faturas emitidas (tipo
                  FATURA e estado ≠ CANCELADA)
                </p>
              </div>
              <button
                type="button"
                onClick={fecharDetalhe}
                className="p-2 rounded-lg hover:bg-white/10"
                aria-label="Fechar"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {mesFechado && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                  <p className="font-semibold">Mês fechado</p>
                  <p className="text-sm">
                    Este detalhe é consultado em tempo real (estado atual das faturas). Os totais e
                    “pagas/pendentes” da aba Comissões permanecem congelados no fecho (snapshot).
                  </p>
                </div>
              )}

              {detalheLoading && (
                <div className="flex items-center gap-3 text-gray-700">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Carregando detalhe...
                </div>
              )}

              {detalheErro && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 font-semibold">
                  {detalheErro}
                </div>
              )}

              {!detalheLoading && !detalheErro && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                      <tr>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700">
                          Fatura
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700">
                          Cliente
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700">
                          Data
                        </th>
                        <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700">
                          Tipo
                        </th>
                        <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700">
                          Estado
                        </th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-700">
                          Base (sem IVA)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {detalheFaturas.map((f) => (
                        <tr key={f.id} className="hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm font-semibold text-gray-900">
                            {f.numero}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-800">{f.cliente_nome}</td>
                          <td className="py-3 px-4 text-sm text-gray-800">
                            {new Date(f.data_emissao).toLocaleDateString('pt-PT')}
                          </td>
                          <td className="py-3 px-4 text-center text-xs font-semibold">
                            <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-800">
                              {f.tipo || 'FATURA'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center text-xs font-semibold">
                            <span
                              className={`px-2 py-1 rounded-full ${
                                f.estado === 'PAGA'
                                  ? 'bg-green-100 text-green-800'
                                  : f.estado === 'PENDENTE'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {f.estado}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-sm font-semibold text-gray-900">
                            {formatCurrencyEUR(f.base_sem_iva)}
                          </td>
                        </tr>
                      ))}

                      {detalheFaturas.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-10 text-center text-gray-600">
                            Sem faturas neste período para este vendedor.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-4 text-xs text-gray-500">
                Dica: fecha com <strong>ESC</strong> ou clicando fora do modal.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================
// COMPONENTES AUXILIARES
// =====================================================

function StatCard({ title, value, icon }: { title: string; value: string; icon: ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-600">{title}</span>
        <div className="text-gray-700">{icon}</div>
      </div>
      <div className="text-xl sm:text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
  dir,
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  dir?: 'asc' | 'desc';
}) {
  return (
    <th
      className={`text-left py-4 px-4 sm:px-6 text-sm font-semibold text-gray-700 ${
        onClick ? 'cursor-pointer select-none hover:text-gray-900' : ''
      }`}
      onClick={onClick}
      title={onClick ? 'Ordenar' : undefined}
    >
      <div className="flex items-center gap-2">
        {children}
        {active && <span className="text-xs text-gray-500">{dir === 'asc' ? '▲' : '▼'}</span>}
      </div>
    </th>
  );
}

function ThRight({
  children,
  onClick,
  active,
  dir,
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  dir?: 'asc' | 'desc';
}) {
  return (
    <th
      className={`text-right py-4 px-4 text-sm font-semibold text-gray-700 ${
        onClick ? 'cursor-pointer select-none hover:text-gray-900' : ''
      }`}
      onClick={onClick}
      title={onClick ? 'Ordenar' : undefined}
    >
      <div className="flex items-center justify-end gap-2">
        {children}
        {active && <span className="text-xs text-gray-500">{dir === 'asc' ? '▲' : '▼'}</span>}
      </div>
    </th>
  );
}

function ThCenter({ children }: { children: ReactNode }) {
  return <th className="text-center py-4 px-4 text-sm font-semibold text-gray-700">{children}</th>;
}

