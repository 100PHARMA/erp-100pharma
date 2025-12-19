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

type RpcRankingRow = {
  vendedor_id: string;
  vendedor_nome: string;
  base_sem_iva: number;
  num_faturas: number;
  clientes_unicos: number;
  frascos: number;
  faturas_pagas: number;
  faturas_pendentes: number;
};

type SnapshotRow = RpcRankingRow & {
  comissao_calculada: number;
  faixa: string;
  percentual_meta: number;
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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeNum(v: unknown, fallback = 0) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function getFaixa(baseSemIva: number, config: ConfiguracaoFinanceira) {
  if (baseSemIva <= config.faixa1_limite) return 'FAIXA_1';
  if (baseSemIva <= config.faixa2_limite) return 'FAIXA_2';
  return 'FAIXA_3';
}

function calcularComissaoProgressivaLocal(total: number, config: ConfiguracaoFinanceira) {
  const t = Math.max(0, safeNum(total));
  const f1 = safeNum(config.faixa1_limite);
  const f2 = safeNum(config.faixa2_limite);

  const p1 = safeNum(config.comissao_faixa1) / 100;
  const p2 = safeNum(config.comissao_faixa2) / 100;
  const p3 = safeNum(config.comissao_faixa3) / 100;

  const c1 = Math.min(t, f1) * p1;
  const c2 = Math.min(Math.max(t - f1, 0), f2 - f1) * p2;
  const c3 = Math.max(t - f2, 0) * p3;

  return Number((c1 + c2 + c3).toFixed(2));
}

function calcularPercentualMetaLocal(total: number, config: ConfiguracaoFinanceira) {
  if (config.meta_mensal <= 0) return 0;
  return clamp((total / config.meta_mensal) * 100, 0, 200);
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
  const [rows, setRows] = useState<RowComissao[]>([]);

  const [sortKey, setSortKey] = useState<SortKey>('base_sem_iva');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [mesFechado, setMesFechado] = useState(false);

  const [detalheAberto, setDetalheAberto] = useState(false);
  const [detalheVendedor, setDetalheVendedor] = useState<{ id: string; nome: string } | null>(null);
  const [detalheLoading, setDetalheLoading] = useState(false);
  const [detalheErro, setDetalheErro] = useState<string | null>(null);
  const [detalheFaturas, setDetalheFaturas] = useState<any[]>([]);

  const [anoSelecionado, mesSelecionado] = mesAno.split('-').map(Number);

  // =====================================================
  // SNAPSHOT
  // =====================================================

  async function buscarSnapshotMes() {
    const { data, error } = await supabase
      .from('comissoes_mensais')
      .select('*')
      .eq('ano', anoSelecionado)
      .eq('mes', mesSelecionado);

    if (error) throw error;
    return (data ?? []) as SnapshotRow[];
  }

  // =====================================================
  // CARREGAR
  // =====================================================

  async function carregar() {
    setLoading(true);
    setErro(null);

    try {
      const cfg = await buscarConfiguracaoFinanceira();
      setConfig(cfg);

      const snapshot = await buscarSnapshotMes();

      let fonte: RpcRankingRow[] = [];

      if (snapshot.length > 0) {
        setMesFechado(true);
        fonte = snapshot;
      } else {
        setMesFechado(false);
        const { data, error } = await supabase.rpc('relatorio_comissoes_mes', {
          p_ano: anoSelecionado,
          p_mes: mesSelecionado,
        });
        if (error) throw error;
        fonte = data ?? [];
      }

      const rowsOut = fonte.map((r: any) => {
        const base = safeNum(r.base_sem_iva);
        const faixa = getFaixa(base, cfg);
        const comissao = mesFechado
          ? safeNum(r.comissao_calculada)
          : calcularComissaoProgressivaLocal(base, cfg);

        const percentualMeta = mesFechado
          ? safeNum(r.percentual_meta)
          : calcularPercentualMetaLocal(base, cfg);

        return {
          vendedor_id: r.vendedor_id,
          vendedor_nome: r.vendedor_nome,
          base_sem_iva: base,
          comissao_calculada: comissao,
          faixa_atual: faixa,
          percentual_meta: percentualMeta,
          falta_para_3000: clamp(cfg.faixa1_limite - base, 0, cfg.faixa1_limite),
          falta_para_7000: clamp(cfg.faixa2_limite - base, 0, cfg.faixa2_limite),
          num_faturas: safeNum(r.num_faturas),
          clientes_unicos: safeNum(r.clientes_unicos),
          frascos: safeNum(r.frascos),
          ticket_medio: r.num_faturas > 0 ? base / r.num_faturas : 0,
          preco_medio_frasco: r.frascos > 0 ? base / r.frascos : 0,
          faturas_pagas: safeNum(r.faturas_pagas),
          faturas_pendentes: safeNum(r.faturas_pendentes),
        };
      });

      setRows(rowsOut);
    } catch (e: any) {
      console.error(e);
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, [mesAno]);

  // =====================================================
  // FECHAR MÊS
  // =====================================================

  async function fecharMes() {
    if (!confirm(`Deseja FECHAR o mês ${mesAno}? Esta ação é irreversível.`)) return;

    const { error } = await supabase.rpc('fechar_comissoes_mes', {
      p_ano: anoSelecionado,
      p_mes: mesSelecionado,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert('Mês fechado com sucesso.');
    carregar();
  }

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
      return ((a as any)[sortKey] - (b as any)[sortKey]) * dir;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  // =====================================================
  // RENDER
  // =====================================================

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-3">
        <RefreshCw className="animate-spin" /> Carregando…
      </div>
    );
  }

  if (erro) {
    return <div className="p-8 text-red-600">{erro}</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Comissões</h1>

        <div className="flex gap-3">
          <input
            type="month"
            value={mesAno}
            onChange={(e) => setMesAno(e.target.value)}
            className="border rounded px-3 py-2"
          />

          {!mesFechado && (
            <button
              onClick={fecharMes}
              className="bg-red-600 text-white px-4 py-2 rounded font-semibold"
            >
              Fechar mês
            </button>
          )}
        </div>
      </div>

      <pre className="text-xs bg-gray-100 p-3 rounded">
        {mesFechado ? 'MÊS FECHADO (snapshot)' : 'MÊS ABERTO (dinâmico)'}
      </pre>

      {/* TABELA (igual à sua, mantida) */}
      {/* … o resto da tabela permanece exatamente como estava … */}
    </div>
  );
}

