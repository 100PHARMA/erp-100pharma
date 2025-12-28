'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Target,
  TrendingUp,
  Users,
  MapPin,
  Euro,
  Calendar,
  AlertCircle,
  RefreshCw,
  Package,
} from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type Perfil = {
  role: string;
  vendedor_id: string | null;
};

type PortalMetasRow = {
  vendedor_id: string;
  vendedor_nome: string;

  meta_vendas_sem_iva: number;
  meta_novas_farmacias: number;
  meta_visitas: number;

  realizado_vendas_sem_iva: number;
  realizado_novas_farmacias: number;
  realizado_visitas: number;

  comissao_estimada: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function pct(realizado: number, meta: number) {
  if (!meta || meta <= 0) return 0;
  return clamp((realizado / meta) * 100, 0, 200);
}

function formatCurrencyEUR(valor: number) {
  return valor.toLocaleString('pt-PT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + '€';
}

function formatInt(n: number) {
  return n.toLocaleString('pt-PT');
}

function yyyyMmToRange(yyyymm: string) {
  const [yStr, mStr] = yyyymm.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

export default function PortalMetasPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [vendedorId, setVendedorId] = useState<string | null>(null);
  const [vendedorEmail, setVendedorEmail] = useState<string | null>(null);

  const [mes, setMes] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });

  const [row, setRow] = useState<PortalMetasRow | null>(null);

  // Extra (opcional, mas você já tinha): frascos no mês
  const [qtFrascos, setQtFrascos] = useState<number>(0);

  const { anoSelecionado, mesSelecionado } = useMemo(() => {
    const [y, m] = mes.split('-');
    return { anoSelecionado: Number(y), mesSelecionado: Number(m) };
  }, [mes]);

  async function bootstrap() {
    setLoading(true);
    setErro(null);

    try {
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

      if (perfilErr) throw perfilErr;

      const role = String(perfil?.role ?? '').toUpperCase();
      if (role !== 'VENDEDOR') {
        router.push('/dashboard');
        return;
      }

      if (!perfil?.vendedor_id) {
        throw new Error('Seu perfil não possui vendedor_id. Ajuste em public.perfis.');
      }

      setVendedorId(perfil.vendedor_id);
      await carregar(perfil.vendedor_id, mes);
    } catch (e: any) {
      console.error(e);
      setErro(e?.message || 'Erro ao carregar metas do portal');
    } finally {
      setLoading(false);
    }
  }

  async function carregar(vendId: string, yyyymm: string) {
    setErro(null);

    // 1) Dados principais via RPC (mesmo conceito do ADMIN/metas)
    const { data, error } = await supabase.rpc('portal_metas_meu_mes', {
      p_ano: anoSelecionado,
      p_mes: mesSelecionado,
    });

    if (error) throw error;

    const r = (Array.isArray(data) ? data[0] : data) as any;
    setRow({
      vendedor_id: r.vendedor_id,
      vendedor_nome: r.vendedor_nome ?? '—',
      meta_vendas_sem_iva: Number(r.meta_vendas_sem_iva ?? 0),
      meta_novas_farmacias: Number(r.meta_novas_farmacias ?? 0),
      meta_visitas: Number(r.meta_visitas ?? 0),
      realizado_vendas_sem_iva: Number(r.realizado_vendas_sem_iva ?? 0),
      realizado_novas_farmacias: Number(r.realizado_novas_farmacias ?? 0),
      realizado_visitas: Number(r.realizado_visitas ?? 0),
      comissao_estimada: Number(r.comissao_estimada ?? 0),
    });

    // 2) (Opcional) frascos no mês — mantém sua feature
    const { startISO, endISO } = yyyyMmToRange(yyyymm);

    const { data: fatRows, error: fatErr } = await supabase
      .from('faturas')
      .select(
        `
        id,
        data_emissao,
        estado,
        tipo,
        venda_id,
        vendas!inner ( id, vendedor_id )
      `
      )
      .eq('tipo', 'FATURA')
      .neq('estado', 'CANCELADA')
      .gte('data_emissao', startISO)
      .lt('data_emissao', endISO)
      .eq('vendas.vendedor_id', vendId);

    if (fatErr) {
      console.error(fatErr);
      setQtFrascos(0);
      return;
    }

    const vendaIds = Array.from(new Set((fatRows ?? []).map((f: any) => f.venda_id))).filter(Boolean);

    if (vendaIds.length === 0) {
      setQtFrascos(0);
      return;
    }

    const { data: itensRows, error: itensErr } = await supabase
      .from('venda_itens')
      .select('quantidade, venda_id')
      .in('venda_id', vendaIds);

    if (itensErr) {
      console.error(itensErr);
      setQtFrascos(0);
      return;
    }

    const frascos = (itensRows ?? []).reduce((acc: number, it: any) => acc + Number(it.quantidade ?? 0), 0);
    setQtFrascos(frascos);
  }

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!vendedorId) return;
    (async () => {
      setLoading(true);
      try {
        await carregar(vendedorId, mes);
      } catch (e: any) {
        console.error(e);
        setErro(e?.message || 'Erro ao atualizar mês');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes]);

  const calc = useMemo(() => {
    if (!row) return null;

    const pVendas = pct(row.realizado_vendas_sem_iva, row.meta_vendas_sem_iva);
    const pNovas = pct(row.realizado_novas_farmacias, row.meta_novas_farmacias);
    const pVisitas = pct(row.realizado_visitas, row.meta_visitas);

    const w = [
      row.meta_vendas_sem_iva > 0 ? 1 : 0,
      row.meta_novas_farmacias > 0 ? 1 : 0,
      row.meta_visitas > 0 ? 1 : 0,
    ];
    const sw = w.reduce((a, b) => a + b, 0) || 1;
    const geral = (pVendas * w[0] + pNovas * w[1] + pVisitas * w[2]) / sw;

    return { pVendas, pNovas, pVisitas, geral };
  }, [row]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-6 flex items-center gap-3 text-gray-700">
          <RefreshCw className="w-5 h-5 animate-spin" />
          Carregando metas...
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 mt-0.5" />
            <div>
              <p className="text-red-700 font-semibold">Erro ao carregar</p>
              <p className="text-gray-700 mt-1">{erro}</p>
              <button
                type="button"
                onClick={bootstrap}
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

  if (!row || !calc) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-6 text-gray-700">
          Nenhum dado encontrado.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Minhas Metas</h1>
              <p className="text-gray-600 mt-1">
                Base: <span className="font-semibold">faturas emitidas (sem IVA)</span> + visitas realizadas + novas farmácias
              </p>
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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-6">
            <Kpi
              title="Vendas (sem IVA)"
              value={formatCurrencyEUR(row.realizado_vendas_sem_iva)}
              sub={`Meta: ${formatCurrencyEUR(row.meta_vendas_sem_iva)}`}
              icon={<TrendingUp className="w-6 h-6 text-white" />}
              color="bg-blue-600"
            />
            <Kpi
              title="Novas farmácias"
              value={formatInt(row.realizado_novas_farmacias)}
              sub={`Meta: ${formatInt(row.meta_novas_farmacias)}`}
              icon={<Users className="w-6 h-6 text-white" />}
              color="bg-indigo-600"
            />
            <Kpi
              title="Visitas realizadas"
              value={formatInt(row.realizado_visitas)}
              sub={`Meta: ${formatInt(row.meta_visitas)}`}
              icon={<MapPin className="w-6 h-6 text-white" />}
              color="bg-emerald-600"
            />
            <Kpi
              title="Comissão estimada"
              value={formatCurrencyEUR(row.comissao_estimada)}
              sub="base: faturas emitidas"
              icon={<Euro className="w-6 h-6 text-white" />}
              color="bg-purple-600"
            />
            <Kpi
              title="Frascos (mês)"
              value={formatInt(qtFrascos)}
              sub="somatório venda_itens"
              icon={<Package className="w-6 h-6 text-white" />}
              color="bg-orange-600"
            />
          </div>

          {/* Progresso */}
          <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
            <Bar label="Atingimento Geral" value={calc.geral} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Bar label="Vendas" value={calc.pVendas} />
              <Bar label="Novas farmácias" value={calc.pNovas} />
              <Bar label="Visitas" value={calc.pVisitas} />
            </div>

            <div className="flex items-start gap-3 text-xs text-gray-600 pt-1">
              <AlertCircle className="w-4 h-4 mt-0.5 text-gray-500" />
              <div>
                <p>
                  As metas exibidas aqui vêm das tabelas operacionais do mês (as mesmas do ADMIN/metas).
                  Se a meta estiver 0, o atingimento fica 0%.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* depois: histórico, ranking interno, etc. */}
      </div>
    </div>
  );
}

function Kpi({
  title,
  value,
  sub,
  icon,
  color,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center gap-3">
        <div className={`${color} p-3 rounded-lg`}>{icon}</div>
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  const v = clamp(value, 0, 200);
  return (
    <div>
      <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
        <span>{label}</span>
        <span className="font-semibold text-gray-900">{Math.round(v)}%</span>
      </div>
      <div className="w-full h-3 bg-white rounded-full border border-gray-200 overflow-hidden">
        <div className="h-3 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}
