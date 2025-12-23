'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Target,
  TrendingUp,
  Users,
  MapPin,
  RefreshCw,
  AlertCircle,
  Calendar,
  Lock,
  Pencil,
  X,
  Save,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// =====================================================
// TIPOS
// =====================================================

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

type SnapshotCheckRow = {
  fechado_em: string | null;
};

type MetasEmpresaUpsert = {
  ano: number;
  mes: number;
  meta_vendas_sem_iva: number;
  meta_novas_farmacias: number;
  meta_visitas: number;
};

type MetasVendedorUpsert = {
  vendedor_id: string;
  ano: number;
  mes: number;
  meta_vendas_sem_iva: number;
  meta_novas_farmacias: number;
  meta_visitas: number;
};

// =====================================================
// HELPERS
// =====================================================

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

function progressColorClass(v: number) {
  if (v >= 100) return 'bg-green-600';
  if (v >= 80) return 'bg-yellow-500';
  return 'bg-red-600';
}

function parseMoneyInput(s: string) {
  // aceita "8.500,50" ou "8500.50" etc.
  const cleaned = s.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseIntInput(s: string) {
  const cleaned = s.replace(/\s/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

// =====================================================
// PROGRESS BAR
// =====================================================

function ProgressBar({ value }: { value: number }) {
  const v = clamp(value, 0, 200);
  return (
    <div className="relative w-full h-3 bg-gray-100 rounded-full overflow-hidden">
      {/* marcador 100% */}
      <div className="absolute left-1/2 top-0 h-3 w-px bg-gray-300" />
      <div
        className={`h-3 rounded-full transition-all duration-500 ${progressColorClass(v)}`}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

// =====================================================
// PAGE
// =====================================================

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

  // Status (não trava edição!)
  const [mesFechado, setMesFechado] = useState(false);
  const [fechadoEm, setFechadoEm] = useState<string | null>(null);

  // Modal edição
  const [editarAberto, setEditarAberto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErro, setSaveErro] = useState<string | null>(null);

  // Form (strings para input)
  const [formEmpresaVendas, setFormEmpresaVendas] = useState('0');
  const [formEmpresaNovas, setFormEmpresaNovas] = useState('0');
  const [formEmpresaVisitas, setFormEmpresaVisitas] = useState('0');

  type FormVend = { vendas: string; novas: string; visitas: string };
  const [formVendedores, setFormVendedores] = useState<Record<string, FormVend>>({});

  const { anoSelecionado, mesSelecionado } = useMemo(() => {
    const [anoStr, mesStr] = mesAno.split('-');
    return {
      anoSelecionado: Number(anoStr),
      mesSelecionado: Number(mesStr),
    };
  }, [mesAno]);

  // =====================================================
  // CARREGAR
  // =====================================================

  async function carregar() {
    setLoading(true);
    setErro(null);

    try {
      // 0) Apenas status: mês está “fechado” se houver snapshot em comissoes_mensais
      const { data: snapCheck, error: snapErr } = await supabase
        .from('comissoes_mensais')
        .select('fechado_em')
        .eq('ano', anoSelecionado)
        .eq('mes', mesSelecionado)
        .limit(1);

      if (snapErr) throw snapErr;

      if ((snapCheck || []).length > 0) {
        const s = (snapCheck?.[0] as SnapshotCheckRow) || null;
        setMesFechado(true);
        setFechadoEm(s?.fechado_em || null);
      } else {
        setMesFechado(false);
        setFechadoEm(null);
      }

      // 1) Metas empresa
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

      // 2) Metas por vendedor
      const { data: vendData, error: vendErr } = await supabase.rpc(
        'relatorio_metas_mes',
        { p_ano: anoSelecionado, p_mes: mesSelecionado }
      );
      if (vendErr) throw vendErr;

      const parsed: MetasVendedorRow[] = (vendData || []).map((r: any) => ({
        vendedor_id: r.vendedor_id,
        vendedor_nome: r.vendedor_nome ?? '—',

        meta_vendas_sem_iva: safeNum(r.meta_vendas_sem_iva, 0),
        meta_novas_farmacias: safeNum(r.meta_novas_farmacias, 0),
        meta_visitas: safeNum(r.meta_visitas, 0),

        realizado_vendas_sem_iva: safeNum(r.realizado_vendas_sem_iva, 0),
        realizado_novas_farmacias: safeNum(r.realizado_novas_farmacias, 0),
        realizado_visitas: safeNum(r.realizado_visitas, 0),
      }));

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

  // =====================================================
  // RESUMO
  // =====================================================

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

    const metaEmpresaVendas =
      empresaMeta.meta_vendas_sem_iva > 0 ? empresaMeta.meta_vendas_sem_iva : metaTotalVendas;
    const metaEmpresaNovas =
      empresaMeta.meta_novas_farmacias > 0 ? empresaMeta.meta_novas_farmacias : metaTotalNovas;
    const metaEmpresaVisitas =
      empresaMeta.meta_visitas > 0 ? empresaMeta.meta_visitas : metaTotalVisitas;

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

  // =====================================================
  // MODAL: ABRIR / FECHAR / SALVAR
  // =====================================================

  function abrirEditar() {
    setSaveErro(null);

    // Empresa
    setFormEmpresaVendas(String(empresaMeta.meta_vendas_sem_iva ?? 0));
    setFormEmpresaNovas(String(empresaMeta.meta_novas_farmacias ?? 0));
    setFormEmpresaVisitas(String(empresaMeta.meta_visitas ?? 0));

    // Vendedores
    const next: Record<string, FormVend> = {};
    for (const r of rows) {
      next[r.vendedor_id] = {
        vendas: String(r.meta_vendas_sem_iva ?? 0),
        novas: String(r.meta_novas_farmacias ?? 0),
        visitas: String(r.meta_visitas ?? 0),
      };
    }
    setFormVendedores(next);

    setEditarAberto(true);
  }

  function fecharEditar() {
    if (saving) return;
    setEditarAberto(false);
    setSaveErro(null);
  }

  async function salvarMetas() {
    setSaving(true);
    setSaveErro(null);

    try {
      const payloadEmpresa: MetasEmpresaUpsert = {
        ano: anoSelecionado,
        mes: mesSelecionado,
        meta_vendas_sem_iva: parseMoneyInput(formEmpresaVendas),
        meta_novas_farmacias: parseIntInput(formEmpresaNovas),
        meta_visitas: parseIntInput(formEmpresaVisitas),
      };

      // 1) Upsert empresa_metas_mensais
      const { error: empUpErr } = await supabase
        .from('empresa_metas_mensais')
        .upsert(payloadEmpresa as any, { onConflict: 'ano,mes' });

      if (empUpErr) throw empUpErr;

      // 2) Upsert vendedor_metas_operacionais_mensais
      const payloadVendedores: MetasVendedorUpsert[] = rows.map((r) => {
        const f = formVendedores[r.vendedor_id] || { vendas: '0', novas: '0', visitas: '0' };
        return {
          vendedor_id: r.vendedor_id,
          ano: anoSelecionado,
          mes: mesSelecionado,
          meta_vendas_sem_iva: parseMoneyInput(f.vendas),
          meta_novas_farmacias: parseIntInput(f.novas),
          meta_visitas: parseIntInput(f.visitas),
        };
      });

      const { error: vendUpErr } = await supabase
        .from('vendedor_metas_operacionais_mensais')
        .upsert(payloadVendedores as any, { onConflict: 'vendedor_id,ano,mes' });

      if (vendUpErr) throw vendUpErr;

      // Recarrega para refletir
      setEditarAberto(false);
      await carregar();
    } catch (e: any) {
      console.error(e);
      setSaveErro(e?.message || 'Erro ao salvar metas');
    } finally {
      setSaving(false);
    }
  }

  // ESC no modal
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && editarAberto) fecharEditar();
    }
    if (editarAberto) document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editarAberto, saving]);

  // =====================================================
  // RENDER
  // =====================================================

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl shadow-lg p-6 flex items-center gap-3 text-gray-700">
          <RefreshCw className="w-5 h-5 animate-spin" />
          Carregando metas...
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
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
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-gray-900">Metas</h1>

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

          <p className="text-gray-600">
            Acompanhamento por vendedor com base em <strong>faturas emitidas</strong>, visitas e novas farmácias.
            {mesFechado && (
              <>
                {' '}
                <span className="font-semibold text-gray-900">
                  (Fechado afeta comissões; metas continuam editáveis.)
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 bg-white rounded-xl shadow-lg px-4 py-3">
            <Calendar className="w-5 h-5 text-gray-700" />
            <input
              type="month"
              value={mesAno}
              onChange={(e) => setMesAno(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="button"
            onClick={abrirEditar}
            className="bg-blue-600 text-white px-4 py-3 rounded-xl font-semibold shadow-lg flex items-center gap-2 justify-center hover:bg-blue-700"
          >
            <Pencil className="w-5 h-5" />
            Alterar metas
          </button>

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

      {/* Cards empresa */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card title="Meta Total (Vendas)" value={formatCurrencyEUR(resumo.metaEmpresaVendas)} icon={<Target className="w-5 h-5" />} />
        <Card title="Atingimento (Vendas)" value={`${Math.round(resumo.atingVendas)}%`} icon={<TrendingUp className="w-5 h-5" />} />
        <Card title="Atingimento (Geral)" value={`${Math.round(resumo.atingGeral)}%`} icon={<Users className="w-5 h-5" />} />
        <Card title="Acima da Meta" value={formatInt(resumo.acimaDaMeta)} icon={<Target className="w-5 h-5" />} />
      </div>

      {/* Lista vendedores */}
      <div className="space-y-4">
        {rows.map((r) => {
          const pVendas = pct(r.realizado_vendas_sem_iva, r.meta_vendas_sem_iva);
          const pNovas = pct(r.realizado_novas_farmacias, r.meta_novas_farmacias);
          const pVisitas = pct(r.realizado_visitas, r.meta_visitas);

          return (
            <div key={r.vendedor_id} className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-lg font-bold text-gray-900">{r.vendedor_nome}</div>
                <div className="text-sm text-gray-500">{mesAno}</div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Metric
                  label="Vendas"
                  left={formatCurrencyEUR(r.realizado_vendas_sem_iva)}
                  right={formatCurrencyEUR(r.meta_vendas_sem_iva)}
                  pctValue={pVendas}
                  icon={<TrendingUp className="w-5 h-5" />}
                />
                <Metric
                  label="Novas farmácias"
                  left={formatInt(r.realizado_novas_farmacias)}
                  right={formatInt(r.meta_novas_farmacias)}
                  pctValue={pNovas}
                  icon={<Users className="w-5 h-5" />}
                />
                <Metric
                  label="Visitas"
                  left={formatInt(r.realizado_visitas)}
                  right={formatInt(r.meta_visitas)}
                  pctValue={pVisitas}
                  icon={<MapPin className="w-5 h-5" />}
                />
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Vendas</span>
                    <span className="font-semibold text-gray-900">{Math.round(pVendas)}%</span>
                  </div>
                  <ProgressBar value={pVendas} />
                </div>
                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Novas farmácias</span>
                    <span className="font-semibold text-gray-900">{Math.round(pNovas)}%</span>
                  </div>
                  <ProgressBar value={pNovas} />
                </div>
                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Visitas</span>
                    <span className="font-semibold text-gray-900">{Math.round(pVisitas)}%</span>
                  </div>
                  <ProgressBar value={pVisitas} />
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

      {/* MODAL EDITAR */}
      {editarAberto && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) fecharEditar();
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-xl font-bold">Alterar metas — {mesAno}</h2>
                <p className="text-sm text-white/80">
                  Metas são editáveis mesmo com mês fechado (fechamento congela comissões, não metas).
                </p>
              </div>
              <button
                type="button"
                onClick={fecharEditar}
                className="p-2 rounded-lg hover:bg-white/10"
                aria-label="Fechar"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {saveErro && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 font-semibold">
                  {saveErro}
                </div>
              )}

              {/* Empresa */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-3">Metas da Empresa</h3>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <Field
                    label="Meta Vendas (sem IVA)"
                    value={formEmpresaVendas}
                    onChange={setFormEmpresaVendas}
                    hint="Ex: 8500"
                  />
                  <Field
                    label="Meta Novas farmácias"
                    value={formEmpresaNovas}
                    onChange={setFormEmpresaNovas}
                    hint="Ex: 10"
                  />
                  <Field
                    label="Meta Visitas"
                    value={formEmpresaVisitas}
                    onChange={setFormEmpresaVisitas}
                    hint="Ex: 80"
                  />
                </div>
              </div>

              {/* Vendedores */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">Metas por Vendedor</h3>

                <div className="overflow-x-auto border border-gray-100 rounded-xl">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700">Vendedor</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-700">Vendas (sem IVA)</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-700">Novas farmácias</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-700">Visitas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((r) => {
                        const fv = formVendedores[r.vendedor_id] || { vendas: '0', novas: '0', visitas: '0' };

                        return (
                          <tr key={r.vendedor_id} className="hover:bg-gray-50">
                            <td className="py-3 px-4 text-sm font-semibold text-gray-900">{r.vendedor_nome}</td>

                            <td className="py-3 px-4">
                              <input
                                className="w-full text-right px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                value={fv.vendas}
                                onChange={(e) =>
                                  setFormVendedores((prev) => ({
                                    ...prev,
                                    [r.vendedor_id]: { ...fv, vendas: e.target.value },
                                  }))
                                }
                                inputMode="decimal"
                              />
                            </td>

                            <td className="py-3 px-4">
                              <input
                                className="w-full text-right px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                value={fv.novas}
                                onChange={(e) =>
                                  setFormVendedores((prev) => ({
                                    ...prev,
                                    [r.vendedor_id]: { ...fv, novas: e.target.value },
                                  }))
                                }
                                inputMode="numeric"
                              />
                            </td>

                            <td className="py-3 px-4">
                              <input
                                className="w-full text-right px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                value={fv.visitas}
                                onChange={(e) =>
                                  setFormVendedores((prev) => ({
                                    ...prev,
                                    [r.vendedor_id]: { ...fv, visitas: e.target.value },
                                  }))
                                }
                                inputMode="numeric"
                              />
                            </td>
                          </tr>
                        );
                      })}

                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-gray-600">
                            Nenhum vendedor encontrado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-end">
                <button
                  type="button"
                  onClick={fecharEditar}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={salvarMetas}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2 justify-center"
                >
                  {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Guardar metas
                </button>
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

function Card({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-600">{title}</span>
        <div className="text-gray-700">{icon}</div>
      </div>
      <div className="text-xl font-bold text-gray-900">{value}</div>
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
          {icon}
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

function Field({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div>
      <div className="text-sm font-semibold text-gray-700 mb-1">{label}</div>
      <input
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
    </div>
  );
}

