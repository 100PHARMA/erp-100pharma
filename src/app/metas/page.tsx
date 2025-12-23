'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Target,
  TrendingUp,
  Users,
  MapPin,
  RefreshCw,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

type MetasEmpresaRow = {
  meta_vendas_sem_iva: number;
  meta_novas_farmacias: number;
  meta_visitas: number;
};

type MetasVendedorRow = {
  vendedor_id: string;
  vendedor_nome: string;

  meta_vendas_sem_iva: number;
  meta_novas_farmacias: number;
  meta_visitas: number;

  realizado_vendas_sem_iva: number;
  realizado_novas_farmacias: number;
  realizado_visitas: number;
};

function safeNum(v: unknown, fallback = 0) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

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

function pct(realizado: number, meta: number) {
  if (!meta || meta <= 0) return 0;
  return clamp((realizado / meta) * 100, 0, 200);
}

type BarVariant = 'vendas' | 'novas' | 'visitas' | 'geral';

function barColor(variant: BarVariant, value: number) {
  // value 0..200
  // Paleta consistente com o teu layout (azul/roxo/verde/laranja)
  // e com leitura clara.
  const v = clamp(value, 0, 200);

  // abaixo de 60%: mais “alerta”
  const low = v < 60;

  if (variant === 'vendas') return low ? '#F59E0B' : '#7C3AED'; // amber / roxo
  if (variant === 'novas') return low ? '#F97316' : '#2563EB';  // laranja / azul
  if (variant === 'visitas') return low ? '#EF4444' : '#16A34A';// vermelho / verde
  return low ? '#9CA3AF' : '#111827';                           // cinza / quase preto
}

function ProgressBar({
  value,
  variant,
}: {
  value: number;
  variant: BarVariant;
}) {
  const v = clamp(value, 0, 200);
  const color = barColor(variant, v);
  return (
    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
      <div
        className="h-3 rounded-full transition-all"
        style={{
          width: `${v}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}

export default function MetasPage() {
  const hoje = new Date();
  const [mesAno, setMesAno] = useState(() => {
    const y = hoje.getFullYear();
    const m = String(hoje.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [empresaMeta, setEmpresaMeta] = useState<MetasEmpresaRow>({
    meta_vendas_sem_iva: 0,
    meta_novas_farmacias: 0,
    meta_visitas: 0,
  });

  const [rows, setRows] = useState<MetasVendedorRow[]>([]);

  const { anoSelecionado, mesSelecionado } = useMemo(() => {
    const [anoStr, mesStr] = mesAno.split('-');
    return {
      anoSelecionado: Number(anoStr),
      mesSelecionado: Number(mesStr),
    };
  }, [mesAno]);

  // debounce para evitar múltiplos reloads em sequência
  const reloadTimerRef = useRef<number | null>(null);
  function carregarDebounced(ms = 350) {
    if (reloadTimerRef.current) window.clearTimeout(reloadTimerRef.current);
    reloadTimerRef.current = window.setTimeout(() => {
      carregar();
    }, ms);
  }

  async function carregar() {
    setLoading(true);
    setErro(null);

    try {
      // 1) Metas empresa (global)
      const { data: empData, error: empErr } = await supabase.rpc(
        'relatorio_metas_empresa_mes',
        { p_ano: anoSelecionado, p_mes: mesSelecionado }
      );
      if (empErr) throw empErr;

      const empRow = (Array.isArray(empData) ? empData[0] : empData) as any;

      setEmpresaMeta({
        meta_vendas_sem_iva: safeNum(empRow?.meta_vendas_sem_iva, 0),
        meta_novas_farmacias: safeNum(empRow?.meta_novas_farmacias, 0),
        meta_visitas: safeNum(empRow?.meta_visitas, 0),
      });

      // 2) Metas por vendedor + realizados
      const { data: vendData, error: vendErr } = await supabase.rpc(
        'relatorio_metas_mes',
        { p_ano: anoSelecionado, p_mes: mesSelecionado }
      );
      if (vendErr) throw vendErr;

      const list = (vendData || []) as any[];

      const parsed: MetasVendedorRow[] = list.map((r) => ({
        vendedor_id: r.vendedor_id,
        vendedor_nome: r.vendedor_nome ?? '—',

        meta_vendas_sem_iva: safeNum(r.meta_vendas_sem_iva, 0),
        meta_novas_farmacias: safeNum(r.meta_novas_farmacias, 0),
        meta_visitas: safeNum(r.meta_visitas, 0),

        realizado_vendas_sem_iva: safeNum(r.realizado_vendas_sem_iva, 0),
        realizado_novas_farmacias: safeNum(r.realizado_novas_farmacias, 0),
        realizado_visitas: safeNum(r.realizado_visitas, 0),
      }));

      // ordena por % de vendas (desc), depois por realizado_vendas (desc)
      parsed.sort((a, b) => {
        const pa = pct(a.realizado_vendas_sem_iva, a.meta_vendas_sem_iva);
        const pb = pct(b.realizado_vendas_sem_iva, b.meta_vendas_sem_iva);
        if (pb !== pa) return pb - pa;
        return b.realizado_vendas_sem_iva - a.realizado_vendas_sem_iva;
      });

      setRows(parsed);
    } catch (e: any) {
      console.error(e);
      setErro(e?.message || 'Erro ao carregar metas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesAno]);

  // Realtime: se mudar visitas/faturas/metas, recarrega automaticamente
  useEffect(() => {
    // Se não quiser realtime, pode remover este bloco inteiro.
    const channel = supabase
      .channel('metas-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vendedor_visitas' },
        () => carregarDebounced(300)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'faturas' },
        () => carregarDebounced(500)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vendedor_metas_operacionais_mensais' },
        () => carregarDebounced(250)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'empresa_metas_mensais' },
        () => carregarDebounced(250)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (reloadTimerRef.current) window.clearTimeout(reloadTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesAno]);

  const resumo = useMemo(() => {
    const metaTotalVendas = rows.reduce((acc, r) => acc + r.meta_vendas_sem_iva, 0);
    const realTotalVendas = rows.reduce((acc, r) => acc + r.realizado_vendas_sem_iva, 0);

    const metaTotalNovas = rows.reduce((acc, r) => acc + r.meta_novas_farmacias, 0);
    const realTotalNovas = rows.reduce((acc, r) => acc + r.realizado_novas_farmacias, 0);

    const metaTotalVisitas = rows.reduce((acc, r) => acc + r.meta_visitas, 0);
    const realTotalVisitas = rows.reduce((acc, r) => acc + r.realizado_visitas, 0);

    const acimaDaMeta = rows.filter(
      (r) => r.meta_vendas_sem_iva > 0 && r.realizado_vendas_sem_iva >= r.meta_vendas_sem_iva
    ).length;

    const metaEmpresaVendas = empresaMeta.meta_vendas_sem_iva > 0 ? empresaMeta.meta_vendas_sem_iva : metaTotalVendas;
    const metaEmpresaNovas = empresaMeta.meta_novas_farmacias > 0 ? empresaMeta.meta_novas_farmacias : metaTotalNovas;
    const metaEmpresaVisitas = empresaMeta.meta_visitas > 0 ? empresaMeta.meta_visitas : metaTotalVisitas;

    const atingVendas = pct(realTotalVendas, metaEmpresaVendas);
    const atingNovas = pct(realTotalNovas, metaEmpresaNovas);
    const atingVisitas = pct(realTotalVisitas, metaEmpresaVisitas);

    const pesos = [
      metaEmpresaVendas > 0 ? 1 : 0,
      metaEmpresaNovas > 0 ? 1 : 0,
      metaEmpresaVisitas > 0 ? 1 : 0,
    ];
    const somaPesos = pesos.reduce((a, b) => a + b, 0) || 1;

    const atingGeral =
      (atingVendas * pesos[0] + atingNovas * pesos[1] + atingVisitas * pesos[2]) / somaPesos;

    return {
      metaEmpresaVendas,
      realTotalVendas,
      atingVendas,

      metaEmpresaNovas,
      realTotalNovas,
      atingNovas,

      metaEmpresaVisitas,
      realTotalVisitas,
      atingVisitas,

      atingGeral,
      acimaDaMeta,
    };
  }, [rows, empresaMeta]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 text-gray-700">
            <RefreshCw className="w-5 h-5 animate-spin" />
            Carregando metas...
          </div>
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 mt-0.5" />
            <div>
              <p className="text-red-600 font-semibold">Erro ao carregar</p>
              <p className="text-gray-700 mt-1">{erro}</p>
              <button
                type="button"
                onClick={carregar}
                className="mt-4 bg-gray-900 text-white px-4 py-2 rounded-lg font-semibold"
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
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Metas</h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Acompanhamento por vendedor com base em <strong>faturas emitidas</strong>, visitas e novas farmácias
              (primeira compra da vida do cliente no mês).
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 bg-white rounded-xl shadow-lg px-4 py-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
                <Calendar className="w-5 h-5 text-gray-700" />
              </span>
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

      {/* Cards (empresa) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card
          title="Meta Total (Vendas)"
          value={formatCurrencyEUR(resumo.metaEmpresaVendas)}
          icon={<Target className="w-5 h-5" />}
          sub={`${formatCurrencyEUR(resumo.realTotalVendas)} realizado`}
        />
        <Card
          title="Atingimento (Vendas)"
          value={`${Math.round(resumo.atingVendas)}%`}
          icon={<TrendingUp className="w-5 h-5" />}
          sub="base: faturas emitidas"
        />
        <Card
          title="Atingimento (Geral)"
          value={`${Math.round(resumo.atingGeral)}%`}
          icon={<Users className="w-5 h-5" />}
          sub="média (vendas/novas/visitas)"
        />
        <Card
          title="Acima da Meta (Vendas)"
          value={formatInt(resumo.acimaDaMeta)}
          icon={<Target className="w-5 h-5" />}
          sub="vendedores com meta > 0"
        />
      </div>

      {/* Barra geral da empresa (opcional, mas ajuda visualmente) */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Vendas</span>
              <span className="font-semibold text-gray-900">{Math.round(resumo.atingVendas)}%</span>
            </div>
            <ProgressBar value={resumo.atingVendas} variant="vendas" />
          </div>
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Novas farmácias</span>
              <span className="font-semibold text-gray-900">{Math.round(resumo.atingNovas)}%</span>
            </div>
            <ProgressBar value={resumo.atingNovas} variant="novas" />
          </div>
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Visitas</span>
              <span className="font-semibold text-gray-900">{Math.round(resumo.atingVisitas)}%</span>
            </div>
            <ProgressBar value={resumo.atingVisitas} variant="visitas" />
          </div>
        </div>
      </div>

      {/* Lista por vendedor */}
      <div className="space-y-4">
        {rows.map((r) => {
          const pVendas = pct(r.realizado_vendas_sem_iva, r.meta_vendas_sem_iva);
          const pNovas = pct(r.realizado_novas_farmacias, r.meta_novas_farmacias);
          const pVisitas = pct(r.realizado_visitas, r.meta_visitas);

          const w = [
            r.meta_vendas_sem_iva > 0 ? 1 : 0,
            r.meta_novas_farmacias > 0 ? 1 : 0,
            r.meta_visitas > 0 ? 1 : 0,
          ];
          const sw = w.reduce((a, b) => a + b, 0) || 1;
          const atingVendedor = (pVendas * w[0] + pNovas * w[1] + pVisitas * w[2]) / sw;

          return (
            <div key={r.vendedor_id} className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-gray-900">{r.vendedor_nome}</div>
                    <div className="text-sm text-gray-500">
                      {mesAno} • Atingimento geral:{' '}
                      <span className="font-semibold text-gray-900">{Math.round(atingVendedor)}%</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm text-gray-500">Vendas</div>
                  <div className="text-base font-bold text-gray-900">
                    {formatCurrencyEUR(r.realizado_vendas_sem_iva)}{' '}
                    <span className="text-gray-400 font-semibold">
                      / {formatCurrencyEUR(r.meta_vendas_sem_iva)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
                <Metric
                  label="Vendas (sem IVA)"
                  icon={<TrendingUp className="w-5 h-5" />}
                  pctValue={pVendas}
                  left={formatCurrencyEUR(r.realizado_vendas_sem_iva)}
                  right={formatCurrencyEUR(r.meta_vendas_sem_iva)}
                />
                <Metric
                  label="Novas farmácias"
                  icon={<Users className="w-5 h-5" />}
                  pctValue={pNovas}
                  left={formatInt(r.realizado_novas_farmacias)}
                  right={formatInt(r.meta_novas_farmacias)}
                />
                <Metric
                  label="Visitas"
                  icon={<MapPin className="w-5 h-5" />}
                  pctValue={pVisitas}
                  left={formatInt(r.realizado_visitas)}
                  right={formatInt(r.meta_visitas)}
                />
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                    <span>Vendas</span>
                    <span className="font-semibold text-gray-900">{Math.round(pVendas)}%</span>
                  </div>
                  <ProgressBar value={pVendas} variant="vendas" />
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                    <span>Novas farmácias</span>
                    <span className="font-semibold text-gray-900">{Math.round(pNovas)}%</span>
                  </div>
                  <ProgressBar value={pNovas} variant="novas" />
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                    <span>Visitas</span>
                    <span className="font-semibold text-gray-900">{Math.round(pVisitas)}%</span>
                  </div>
                  <ProgressBar value={pVisitas} variant="visitas" />
                </div>
              </div>
            </div>
          );
        })}

        {rows.length === 0 && (
          <div className="bg-white rounded-xl shadow-lg p-10 text-center text-gray-600">
            Nenhum vendedor encontrado.
          </div>
        )}
      </div>
    </div>
  );
}

function Card({
  title,
  value,
  sub,
  icon,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-600">{title}</span>
        <div className="text-gray-700">{icon}</div>
      </div>
      <div className="text-xl sm:text-2xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function Metric({
  label,
  icon,
  pctValue,
  left,
  right,
}: {
  label: string;
  icon: React.ReactNode;
  pctValue: number;
  left: string;
  right: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-gray-700">
          <span className="inline-flex">{icon}</span>
          <span className="text-sm font-semibold">{label}</span>
        </div>
        <span className="text-sm font-bold text-gray-900">{Math.round(pctValue)}%</span>
      </div>

      <div className="flex items-end justify-between">
        <div className="text-base font-bold text-gray-900">{left}</div>
        <div className="text-sm text-gray-400 font-semibold">/ {right}</div>
      </div>
    </div>
  );
}

