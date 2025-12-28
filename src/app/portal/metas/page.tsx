'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Target,
  TrendingUp,
  FileText,
  Package,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type Perfil = {
  role: string;
  vendedor_id: string | null;
};

type ConfigFinanceira = {
  meta_mensal: number | null;
  faixa1_limite: number | null;
  comissao_faixa1: number | null;
  faixa2_limite: number | null;
  comissao_faixa2: number | null;
  comissao_faixa3: number | null;
};

function yyyyMmToRange(yyyymm: string) {
  // yyyymm: "2025-12"
  const [yStr, mStr] = yyyymm.split('-');
  const y = Number(yStr);
  const m = Number(mStr); // 1..12
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0)); // first day of next month
  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
  };
}

export default function PortalMetasPage() {
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

  const [metaMensal, setMetaMensal] = useState<number>(0);
  const [faturadoSemIva, setFaturadoSemIva] = useState<number>(0);
  const [qtFaturas, setQtFaturas] = useState<number>(0);
  const [qtFrascos, setQtFrascos] = useState<number>(0);

  const [config, setConfig] = useState<ConfigFinanceira | null>(null);

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
      await carregarTudo(perfil.vendedor_id, mes);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!vendedorId) return;
    (async () => {
      setLoading(true);
      await carregarTudo(vendedorId, mes);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes]);

  const carregarTudo = async (vendId: string, yyyymm: string) => {
    const { startISO, endISO } = yyyyMmToRange(yyyymm);

    // 1) Config financeira (para fallback meta + faixas de comissão se quiser mostrar)
    const { data: configRows, error: configErr } = await supabase
      .from('configuracoes_financeiras')
      .select(
        'meta_mensal, faixa1_limite, comissao_faixa1, faixa2_limite, comissao_faixa2, comissao_faixa3'
      )
      .order('created_at', { ascending: false })
      .limit(1);

    if (configErr) {
      console.error(configErr);
      alert('Erro ao buscar configurações financeiras: ' + configErr.message);
    }

    const cfg = (configRows?.[0] ?? null) as ConfigFinanceira | null;
    setConfig(cfg);

    // 2) Meta mensal do vendedor (override) -> fallback config.meta_mensal
    const [yStr, mStr] = yyyymm.split('-');
    const ano = Number(yStr);
    const mesNum = Number(mStr);

    const { data: metaRows, error: metaErr } = await supabase
      .from('vendedor_metas_mensais')
      .select('meta_mensal')
      .eq('vendedor_id', vendId)
      .eq('ano', ano)
      .eq('mes', mesNum)
      .limit(1);

    if (metaErr) {
      console.error(metaErr);
    }

    const metaOverride =
      metaRows && metaRows.length > 0 && metaRows[0]?.meta_mensal != null
        ? Number(metaRows[0].meta_mensal)
        : null;

    const metaFinal = Number(metaOverride ?? cfg?.meta_mensal ?? 0);
    setMetaMensal(metaFinal);

    // 3) Faturas do mês (sem IVA), filtrando por vendedor via join com vendas
    //    - tipo = 'FATURA'
    //    - estado <> 'CANCELADA'
    //    - data_emissao entre startISO e endISO
    const { data: fatRows, error: fatErr } = await supabase
      .from('faturas')
      .select(
        `
        id,
        data_emissao,
        estado,
        tipo,
        subtotal,
        total_sem_iva,
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
      alert('Erro ao buscar faturas: ' + fatErr.message);
      setFaturadoSemIva(0);
      setQtFaturas(0);
      setQtFrascos(0);
      return;
    }

    const faturado = (fatRows ?? []).reduce((acc: number, f: any) => {
      const base = f.total_sem_iva != null ? Number(f.total_sem_iva) : Number(f.subtotal ?? 0);
      return acc + base;
    }, 0);

    setFaturadoSemIva(faturado);
    setQtFaturas((fatRows ?? []).length);

    // 4) Frascos no mês: soma de venda_itens.quantidade das vendas que geraram essas faturas
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
      // não bloqueia a tela; só zera frascos
      setQtFrascos(0);
      return;
    }

    const frascos = (itensRows ?? []).reduce((acc: number, it: any) => acc + Number(it.quantidade ?? 0), 0);
    setQtFrascos(frascos);
  };

  const progresso = metaMensal > 0 ? Math.min(100, (faturadoSemIva / metaMensal) * 100) : 0;
  const faltante = Math.max(0, metaMensal - faturadoSemIva);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <p className="text-gray-600">Carregando metas...</p>
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
                Faturação do mês baseada em <span className="font-semibold">faturas emitidas (sem IVA)</span>
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

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-3 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Faturado (sem IVA)</p>
                  <p className="text-2xl font-bold text-blue-700">€ {faturadoSemIva.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-600 p-3 rounded-lg">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Meta do mês</p>
                  <p className="text-2xl font-bold text-emerald-700">€ {metaMensal.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="bg-purple-600 p-3 rounded-lg">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Faturas emitidas</p>
                  <p className="text-2xl font-bold text-purple-700">{qtFaturas}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="bg-orange-600 p-3 rounded-lg">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Frascos (mês)</p>
                  <p className="text-2xl font-bold text-orange-700">{qtFrascos}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-700">
                Progresso da meta: <span className="font-semibold">{progresso.toFixed(1)}%</span>
              </p>
              <p className="text-sm text-gray-700">
                Faltante: <span className="font-semibold">€ {faltante.toFixed(2)}</span>
              </p>
            </div>

            <div className="mt-3 bg-white rounded-full h-3 border border-gray-200 overflow-hidden">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600"
                style={{ width: `${progresso}%` }}
              />
            </div>

            <div className="mt-4 flex items-start gap-3 text-xs text-gray-600">
              <AlertCircle className="w-4 h-4 mt-0.5 text-gray-500" />
              <div>
                <p>
                  Regra: soma das <span className="font-semibold">FATURAS</span> do mês com estado diferente de{' '}
                  <span className="font-semibold">CANCELADA</span>, usando base sem IVA.
                </p>
                {config && (
                  <p className="mt-1">
                    Config de comissão (referência): Faixa1 até €{Number(config.faixa1_limite ?? 0).toFixed(0)} ={' '}
                    {Number(config.comissao_faixa1 ?? 0).toFixed(0)}% | Faixa2 até €{Number(config.faixa2_limite ?? 0).toFixed(0)} ={' '}
                    {Number(config.comissao_faixa2 ?? 0).toFixed(0)}% | Acima = {Number(config.comissao_faixa3 ?? 0).toFixed(0)}%
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Espaço para evolução futura: ranking, histórico 12 meses, etc. */}
      </div>
    </div>
  );
}
