'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  buscarConfiguracaoFinanceira,
  type ConfiguracaoFinanceira,
} from '@/lib/configuracoes-financeiras';

// =====================================================
// TIPOS
// =====================================================

type Vendedor = {
  id: string;
  nome: string;
};

type FaturaRow = {
  id: string;
  numero: string;
  venda_id: string;
  cliente_id: string;
  tipo: string | null;
  estado: string;
  data_emissao: string; // timestamptz
  subtotal: number; // numeric
  total_sem_iva: number | null;
};

type VendaRow = {
  id: string;
  vendedor_id: string | null;
  cliente_id: string;
};

type VendaItemRow = {
  venda_id: string;
  quantidade: number;
};

type ClienteRow = {
  id: string;
  nome: string;
};

type RowComissao = {
  vendedor_id: string;
  vendedor_nome: string;

  base_sem_iva: number;
  comissao_calculada: number;

  faixa_atual: 'FAIXA_1' | 'FAIXA_2' | 'FAIXA_3';
  percentual_meta: number;

  falta_para_3000: number;
  falta_para_7000: number;

  num_faturas: number;
  clientes_unicos: number;
  frascos: number;

  ticket_medio: number;
  preco_medio_frasco: number;

  faturas_pagas: number;
  faturas_pendentes: number;
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

function startOfMonthISO(ano: number, mes: number) {
  const d = new Date(Date.UTC(ano, mes - 1, 1, 0, 0, 0));
  return d.toISOString();
}

function endOfMonthISOExclusive(ano: number, mes: number) {
  const d = new Date(Date.UTC(ano, mes, 1, 0, 0, 0));
  return d.toISOString();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeNum(v: unknown, fallback = 0) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function getFaixa(baseSemIva: number, config: ConfiguracaoFinanceira) {
  if (baseSemIva <= config.faixa1_limite) return 'FAIXA_1' as const;
  if (baseSemIva <= config.faixa2_limite) return 'FAIXA_2' as const;
  return 'FAIXA_3' as const;
}

function calcularComissaoProgressivaLocal(total: number, config: ConfiguracaoFinanceira) {
  const t = Math.max(0, safeNum(total, 0));

  const f1 = Math.max(0, safeNum(config.faixa1_limite, 3000));
  const f2 = Math.max(f1, safeNum(config.faixa2_limite, 7000));

  const p1 = safeNum(config.comissao_faixa1, 5) / 100;
  const p2 = safeNum(config.comissao_faixa2, 8) / 100;
  const p3 = safeNum(config.comissao_faixa3, 10) / 100;

  const base1 = Math.min(t, f1);
  const base2 = Math.min(Math.max(0, t - f1), Math.max(0, f2 - f1));
  const base3 = Math.max(0, t - f2);

  const c1 = base1 * p1;
  const c2 = base2 * p2;
  const c3 = base3 * p3;

  return Number((c1 + c2 + c3).toFixed(2));
}

function calcularPercentualMetaLocal(total: number, config: ConfiguracaoFinanceira) {
  const meta = safeNum(config.meta_mensal, 0);
  if (meta <= 0) return 0;
  const pct = (safeNum(total, 0) / meta) * 100;
  return clamp(Number(pct.toFixed(2)), 0, 200);
}

// =====================================================
// COMPONENTE
// =====================================================

export default function ComissoesPage() {
  const hoje = new Date();
  const [mesAno, setMesAno] = useState(() => {
    const y = hoje.getFullYear();
    const m = String(hoje.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [config, setConfig] = useState<ConfiguracaoFinanceira | null>(null);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [rows, setRows] = useState<RowComissao[]>([]);

  const [sortKey, setSortKey] = useState<SortKey>('base_sem_iva');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Modal detalhe
  const [detalheAberto, setDetalheAberto] = useState(false);
  const [detalheVendedor, setDetalheVendedor] = useState<{ id: string; nome: string } | null>(null);
  const [detalheLoading, setDetalheLoading] = useState(false);
  const [detalheErro, setDetalheErro] = useState<string | null>(null);
  const [detalheFaturas, setDetalheFaturas] = useState<
    Array<{
      id: string;
      numero: string;
      data_emissao: string;
      estado: string;
      tipo: string | null;
      cliente_nome: string;
      base_sem_iva: number;
    }>
  >([]);

  // ✅ ESC + trava scroll do body quando o modal abre
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

  const { anoSelecionado, mesSelecionado } = useMemo(() => {
    const [anoStr, mesStr] = mesAno.split('-');
    return {
      anoSelecionado: Number(anoStr),
      mesSelecionado: Number(mesStr),
    };
  }, [mesAno]);

  const periodo = useMemo(() => {
    const inicio = startOfMonthISO(anoSelecionado, mesSelecionado);
    const fimExclusivo = endOfMonthISOExclusive(anoSelecionado, mesSelecionado);
    return { inicio, fimExclusivo };
  }, [anoSelecionado, mesSelecionado]);

  // =====================================================
  // CARREGAMENTO
  // =====================================================

async function carregar() {
  setLoading(true);
  setErro(null);

  try {
    // 1) Config (faixas + meta)
    const cfg = await buscarConfiguracaoFinanceira();
    setConfig(cfg);

    // 2) Vendedores (para mostrar também quem está zerado no mês)
    const { data: vendedoresData, error: vendedoresError } = await supabase
      .from('vendedores')
      .select('id, nome')
      .order('nome', { ascending: true });

    if (vendedoresError) throw vendedoresError;

    const vendedoresList = (vendedoresData || []) as Vendedor[];
    setVendedores(vendedoresList);

    // 3) RPC do ranking mensal (server-side)
    const { data: rpcData, error: rpcError } = await supabase.rpc('relatorio_comissoes_mes', {
      p_ano: anoSelecionado,
      p_mes: mesSelecionado,
    });

    if (rpcError) throw rpcError;

    type RpcRow = {
      vendedor_id: string;
      vendedor_nome: string;
      base_sem_iva: number;
      num_faturas: number;
      clientes_unicos: number;
      frascos: number;
      faturas_pagas: number;
      faturas_pendentes: number;
    };

    const porVendedor = new Map<string, RpcRow>();
    for (const r of (rpcData || []) as RpcRow[]) {
      porVendedor.set(r.vendedor_id, {
        ...r,
        base_sem_iva: safeNum(r.base_sem_iva, 0),
        num_faturas: safeNum(r.num_faturas, 0),
        clientes_unicos: safeNum(r.clientes_unicos, 0),
        frascos: safeNum(r.frascos, 0),
        faturas_pagas: safeNum(r.faturas_pagas, 0),
        faturas_pendentes: safeNum(r.faturas_pendentes, 0),
      });
    }

    // 4) Monta rows finais (inclui vendedores sem movimento)
    const rowsOut: RowComissao[] = vendedoresList.map((vend) => {
      const r = porVendedor.get(vend.id);

      const base = r ? safeNum(r.base_sem_iva, 0) : 0;
      const numFaturas = r ? safeNum(r.num_faturas, 0) : 0;
      const clientesUnicos = r ? safeNum(r.clientes_unicos, 0) : 0;
      const frascos = r ? safeNum(r.frascos, 0) : 0;

      const ticketMedio = numFaturas > 0 ? base / numFaturas : 0;
      const precoMedioFrasco = frascos > 0 ? base / frascos : 0;

      const faixaAtual = getFaixa(base, cfg);
      const comissao = calcularComissaoProgressivaLocal(base, cfg);
      const percentualMeta = calcularPercentualMetaLocal(base, cfg);

      const falta3000 = clamp(cfg.faixa1_limite - base, 0, cfg.faixa1_limite);
      const falta7000 = clamp(cfg.faixa2_limite - base, 0, cfg.faixa2_limite);

      return {
        vendedor_id: vend.id,
        vendedor_nome: vend.nome,
        base_sem_iva: base,
        comissao_calculada: comissao,
        faixa_atual: faixaAtual,
        percentual_meta: percentualMeta,
        falta_para_3000: falta3000,
        falta_para_7000: falta7000,
        num_faturas: numFaturas,
        clientes_unicos: clientesUnicos,
        frascos,
        ticket_medio: ticketMedio,
        preco_medio_frasco: precoMedioFrasco,
        faturas_pagas: r ? safeNum(r.faturas_pagas, 0) : 0,
        faturas_pendentes: r ? safeNum(r.faturas_pendentes, 0) : 0,
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
  }, [mesAno]);

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
  // DETALHE VENDEDOR
  // =====================================================

  async function abrirDetalhe(vendedorId: string, vendedorNome: string) {
    setDetalheAberto(true);
    setDetalheVendedor({ id: vendedorId, nome: vendedorNome });
    setDetalheLoading(true);
    setDetalheErro(null);
    setDetalheFaturas([]);

    try {
      const { data: faturasData, error: faturasError } = await supabase
        .from('faturas')
        .select('id, numero, venda_id, cliente_id, tipo, estado, data_emissao, subtotal, total_sem_iva')
        .eq('tipo', 'FATURA')
        .neq('estado', 'CANCELADA')
        .gte('data_emissao', periodo.inicio)
        .lt('data_emissao', periodo.fimExclusivo);

      if (faturasError) throw faturasError;

      const faturas = (faturasData || []) as FaturaRow[];
      const vendaIds = Array.from(new Set(faturas.map((f) => f.venda_id)));

      if (vendaIds.length === 0) return;

      const { data: vendasData, error: vendasError } = await supabase
        .from('vendas')
        .select('id, vendedor_id, cliente_id')
        .in('id', vendaIds)
        .eq('vendedor_id', vendedorId);

      if (vendasError) throw vendasError;

      const vendas = (vendasData || []) as VendaRow[];
      const vendasSet = new Set(vendas.map((v) => v.id));

      const faturasDoVendedor = faturas.filter((f) => vendasSet.has(f.venda_id));

      const clienteIds = Array.from(
        new Set(faturasDoVendedor.map((f) => f.cliente_id).filter(Boolean))
      );

      let clientesMap = new Map<string, string>();

      if (clienteIds.length > 0) {
        const { data: clientesData, error: clientesError } = await supabase
          .from('clientes')
          .select('id, nome')
          .in('id', clienteIds);

        if (clientesError) throw clientesError;

        const clientes = (clientesData || []) as ClienteRow[];
        clientesMap = new Map(clientes.map((c) => [c.id, c.nome]));
      }

      const baseSemIvaDaFatura = (f: FaturaRow) => safeNum(f.total_sem_iva ?? f.subtotal ?? 0);

      setDetalheFaturas(
        faturasDoVendedor
          .map((f) => ({
            id: f.id,
            numero: f.numero,
            data_emissao: f.data_emissao,
            estado: f.estado,
            tipo: f.tipo,
            cliente_nome: clientesMap.get(f.cliente_id) || '—',
            base_sem_iva: baseSemIvaDaFatura(f),
          }))
          .sort((a, b) => (a.data_emissao < b.data_emissao ? 1 : -1))
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

  const faixaBadge = (faixa: RowComissao['faixa_atual']) => {
    if (faixa === 'FAIXA_1') return 'bg-blue-100 text-blue-800';
    if (faixa === 'FAIXA_2') return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const faixaLabel = (faixa: RowComissao['faixa_atual']) => {
    if (!config) return faixa === 'FAIXA_1' ? '5%' : faixa === 'FAIXA_2' ? '8%' : '10%';
    if (faixa === 'FAIXA_1') return `${safeNum(config.comissao_faixa1, 5)}%`;
    if (faixa === 'FAIXA_2') return `${safeNum(config.comissao_faixa2, 8)}%`;
    return `${safeNum(config.comissao_faixa3, 10)}%`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
              Comissões e Performance
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Comissão por <strong>emissão de faturas</strong> (tipo FATURA e estado ≠ CANCELADA),
              com faixas progressivas.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 bg-white rounded-xl shadow-lg px-4 py-3">
              <CalendarIcon />
              <input
                type="month"
                value={mesAno}
                onChange={(e) => setMesAno(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

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
          title="Pagas / Pendentes"
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
                        Pagas: {r.faturas_pagas} • Pendentes: {r.faturas_pendentes}
                      </span>
                      {config && (
                        <span className="text-xs text-gray-500">
                          Falta p/ {formatInt(config.faixa1_limite)}:{' '}
                          {formatCurrencyEUR(r.falta_para_3000)} • Falta p/{' '}
                          {formatInt(config.faixa2_limite)}: {formatCurrencyEUR(r.falta_para_7000)}
                        </span>
                      )}
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
                      {faixaLabel(r.faixa_atual)}
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
                      {config && (
                        <span className="text-xs text-gray-500">
                          Meta: {formatCurrencyEUR(safeNum(config.meta_mensal, 0))}
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
                  {mesAno} • faturas emitidas (tipo FATURA e estado ≠ CANCELADA)
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

function CalendarIcon() {
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
      📅
    </span>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: ReactNode;
}) {
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
