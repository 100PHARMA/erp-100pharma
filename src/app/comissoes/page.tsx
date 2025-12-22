'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Trophy,
  Search,
  AlertCircle,
  RefreshCcw,
  Lock,
  Unlock,
  DollarSign,
  TrendingUp,
  Target,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { PeriodoMesPicker } from '../../components/PeriodoMesPicker';
import { getVendedorMetricasMes, type VendedorMetricasMes } from '@/lib/vendedor-metricas';

type SnapshotComissaoMensal = {
  id: string;
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

  // config congelada (mantida na tabela, mas página só exibe o necessário)
  meta_mensal: number;

  fechado_em: string;
};

type VendedorDb = {
  id: string;
  nome: string;
  email: string | null;
  ativo: boolean | null;
};

type RowUi = {
  vendedor_id: string;
  vendedor_nome: string;
  vendedor_email: string | null;
  ativo: boolean;

  base_sem_iva: number;
  comissao_calculada: number;
  faixa_atual: string;
  percentual_meta: number;
  meta_mensal_usada: number;

  num_faturas: number;
  clientes_unicos: number;
  frascos: number;
  faturas_pagas: number;
  faturas_pendentes: number;
};

type SortKey = 'BASE' | 'COMISSAO' | 'PERCENTUAL_META';

function safeNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function fmtEuro(v: number) {
  return (
    v.toLocaleString('pt-PT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + '€'
  );
}

export default function ComissoesPage() {
  const sp = useSearchParams();

  const now = new Date();
  const anoAtual = now.getUTCFullYear();
  const mesAtual = now.getUTCMonth() + 1;

  const ano = Number(sp.get('ano')) || anoAtual;
  const mes = Number(sp.get('mes')) || mesAtual;

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [busca, setBusca] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('BASE');

  const [mesFechado, setMesFechado] = useState(false);
  const [fechadoEm, setFechadoEm] = useState<string | null>(null);

  const [rows, setRows] = useState<RowUi[]>([]);

  useEffect(() => {
    carregarTudo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, mes]);

  async function carregarTudo() {
    try {
      setLoading(true);
      setErro(null);

      // 1) Vendedores (para nome/email/ativo)
      const { data: vendData, error: vendErr } = await supabase
        .from('vendedores')
        .select('id,nome,email,ativo')
        .order('nome', { ascending: true });

      if (vendErr) throw vendErr;

      const vendById = new Map<string, VendedorDb>();
      for (const v of (vendData ?? []) as VendedorDb[]) vendById.set(v.id, v);

      // 2) Tenta snapshot (mês FECHADO)
      const { data: snapData, error: snapErr } = await supabase
        .from('comissoes_mensais')
        .select(
          `
          id, vendedor_id, ano, mes,
          base_sem_iva, comissao_calculada, faixa_atual, percentual_meta,
          num_faturas, clientes_unicos, frascos, faturas_pagas, faturas_pendentes,
          meta_mensal,
          fechado_em
        `,
        )
        .eq('ano', ano)
        .eq('mes', mes);

      if (snapErr) throw snapErr;

      const snaps = (snapData ?? []) as any[];

      if (snaps.length > 0) {
        // MÊS FECHADO: lê EXCLUSIVAMENTE do snapshot
        setMesFechado(true);
        setFechadoEm(snaps[0]?.fechado_em ?? null);

        const out: RowUi[] = snaps.map((s) => {
          const v = vendById.get(String(s.vendedor_id));
          return {
            vendedor_id: String(s.vendedor_id),
            vendedor_nome: v?.nome ?? 'Vendedor não encontrado',
            vendedor_email: v?.email ?? null,
            ativo: !!v?.ativo,

            base_sem_iva: safeNum(s.base_sem_iva, 0),
            comissao_calculada: safeNum(s.comissao_calculada, 0),
            faixa_atual: String(s.faixa_atual ?? 'FAIXA_1'),
            percentual_meta: safeNum(s.percentual_meta, 0),
            meta_mensal_usada: safeNum(s.meta_mensal, 0),

            num_faturas: safeNum(s.num_faturas, 0),
            clientes_unicos: safeNum(s.clientes_unicos, 0),
            frascos: safeNum(s.frascos, 0),
            faturas_pagas: safeNum(s.faturas_pagas, 0),
            faturas_pendentes: safeNum(s.faturas_pendentes, 0),
          };
        });

        setRows(out);
        return;
      }

      // 3) MÊS ABERTO: usa fonte única viva
      setMesFechado(false);
      setFechadoEm(null);

      const met: VendedorMetricasMes[] = await getVendedorMetricasMes(ano, mes);

      const out: RowUi[] = met.map((m) => {
        const v = vendById.get(m.vendedor_id);
        return {
          vendedor_id: m.vendedor_id,
          vendedor_nome: v?.nome ?? 'Vendedor não encontrado',
          vendedor_email: v?.email ?? null,
          ativo: !!v?.ativo,

          base_sem_iva: safeNum(m.base_sem_iva ?? 0),
          comissao_calculada: safeNum(m.comissao_calculada ?? 0),
          faixa_atual: String(m.faixa_atual ?? 'FAIXA_1'),
          percentual_meta: safeNum(m.percentual_meta ?? 0),
          meta_mensal_usada: safeNum(m.meta_mensal_usada ?? 0),

          num_faturas: safeNum(m.num_faturas ?? 0),
          clientes_unicos: safeNum(m.clientes_unicos ?? 0),
          frascos: safeNum(m.frascos ?? 0),
          faturas_pagas: safeNum(m.faturas_pagas ?? 0),
          faturas_pendentes: safeNum(m.faturas_pendentes ?? 0),
        };
      });

      setRows(out);
    } catch (e: any) {
      console.error(e);
      setErro(e?.message || 'Erro ao carregar comissões');
    } finally {
      setLoading(false);
    }
  }

  async function fecharMes() {
    if (mesFechado) return;

    const ok = window.confirm(
      `Fechar comissões do mês ${ano}-${String(mes).padStart(2, '0')}?\n\nIsso cria snapshot em comissoes_mensais e congela o período.`,
    );
    if (!ok) return;

    try {
      setLoading(true);
      setErro(null);

      // RPC oficial
      const { error } = await supabase.rpc('fechar_comissoes_mes', {
        ano,
        mes,
      });

      if (error) throw error;

      await carregarTudo();
    } catch (e: any) {
      console.error(e);
      setErro(e?.message || 'Erro ao fechar mês');
    } finally {
      setLoading(false);
    }
  }

  const rowsFiltradasOrdenadas = useMemo(() => {
    const q = busca.trim().toLowerCase();

    let out = rows;
    if (q) {
      out = out.filter((r) => {
        const nome = (r.vendedor_nome || '').toLowerCase();
        const email = (r.vendedor_email || '').toLowerCase();
        return nome.includes(q) || email.includes(q);
      });
    }

    const sorted = [...out].sort((a, b) => {
      if (sortBy === 'COMISSAO') return b.comissao_calculada - a.comissao_calculada;
      if (sortBy === 'PERCENTUAL_META') return b.percentual_meta - a.percentual_meta;
      return b.base_sem_iva - a.base_sem_iva; // BASE
    });

    return sorted;
  }, [rows, busca, sortBy]);

  const totais = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.base += r.base_sem_iva;
        acc.comissao += r.comissao_calculada;
        acc.frascos += r.frascos;
        acc.faturas += r.num_faturas;
        return acc;
      },
      { base: 0, comissao: 0, frascos: 0, faturas: 0 },
    );
  }, [rows]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />
            <p className="text-gray-600">Carregando comissões...</p>
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
              <h3 className="text-lg font-semibold text-red-900 mb-2">Erro ao carregar comissões</h3>
              <div className="text-red-700 mb-4 whitespace-pre-line">{erro}</div>
              <div className="flex gap-3">
                <button
                  onClick={carregarTudo}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors inline-flex items-center gap-2"
                >
                  <RefreshCcw className="w-4 h-4" />
                  Tentar novamente
                </button>
                <button
                  onClick={() => (window.location.href = '/')}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Voltar ao início
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Comissões</h1>

              <span
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${
                  mesFechado ? 'bg-gray-900 text-white' : 'bg-green-100 text-green-800'
                }`}
                title={mesFechado ? 'Lendo comissoes_mensais (snapshot)' : 'Lendo getVendedorMetricasMes (aberto)'}
              >
                {mesFechado ? (
                  <>
                    <Lock className="w-4 h-4" /> MÊS FECHADO
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" /> MÊS ABERTO
                  </>
                )}
              </span>

              {mesFechado && fechadoEm && (
                <span className="text-xs text-gray-500">
                  Fechado em {new Date(fechadoEm).toLocaleString('pt-PT')}
                </span>
              )}
            </div>

            <p className="text-gray-600">
              Ranking por vendedor — base: <b>€ sem IVA</b> (faturas emitidas).{' '}
              {mesFechado ? 'Fonte: comissoes_mensais.' : 'Fonte: getVendedorMetricasMes.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <PeriodoMesPicker />

            {!mesFechado && (
              <button
                onClick={fecharMes}
                className="inline-flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-3 rounded-xl font-semibold hover:bg-red-700 transition"
                title="Cria snapshot (comissoes_mensais) e congela o mês"
              >
                <Lock className="w-5 h-5" />
                Fechar mês
              </button>
            )}

            <button
              onClick={carregarTudo}
              className="inline-flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-4 py-3 rounded-xl font-semibold hover:bg-gray-200 transition"
              title="Recarregar"
            >
              <RefreshCcw className="w-4 h-4" />
              Atualizar
            </button>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Faturação (sem IVA)</span>
            <TrendingUp className="w-5 h-5 text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{fmtEuro(totais.base)}</div>
          <div className="text-xs text-gray-500 mt-1">
            Período: {ano}-{String(mes).padStart(2, '0')}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Total de comissões</span>
            <DollarSign className="w-5 h-5 text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{fmtEuro(totais.comissao)}</div>
          <div className="text-xs text-gray-500 mt-1">Conforme fonte do período</div>
        </div>

        <div className="bg-white rounded-2xl shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Frascos</span>
            <Trophy className="w-5 h-5 text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{totais.frascos}</div>
          <div className="text-xs text-gray-500 mt-1">Somatório por vendedor</div>
        </div>

        <div className="bg-white rounded-2xl shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Faturas emitidas</span>
            <Target className="w-5 h-5 text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{totais.faturas}</div>
          <div className="text-xs text-gray-500 mt-1">Quantidade no mês</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nome ou email..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSortBy('BASE')}
              className={`px-4 py-3 rounded-xl font-semibold transition ${
                sortBy === 'BASE' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Ordenar: Base
            </button>
            <button
              type="button"
              onClick={() => setSortBy('COMISSAO')}
              className={`px-4 py-3 rounded-xl font-semibold transition ${
                sortBy === 'COMISSAO' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Ordenar: Comissão
            </button>
            <button
              type="button"
              onClick={() => setSortBy('PERCENTUAL_META')}
              className={`px-4 py-3 rounded-xl font-semibold transition ${
                sortBy === 'PERCENTUAL_META' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Ordenar: % Meta
            </button>
          </div>
        </div>
      </div>

      {/* Tabela */}
      {rowsFiltradasOrdenadas.length === 0 ? (
        <div className="text-center py-12">
          <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Sem dados</h3>
          <p className="text-gray-600">Não há comissões para o período selecionado.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">#</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Vendedor</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">Base (sem IVA)</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">Comissão</th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-gray-700">Faixa</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">% Meta</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">Frascos</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">Faturas</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {rowsFiltradasOrdenadas.map((r, idx) => (
                  <tr key={r.vendedor_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-700 font-semibold">{idx + 1}</td>

                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{r.vendedor_nome}</div>
                      <div className="text-xs text-gray-500">{r.vendedor_email || '—'}</div>
                      <div className="text-xs text-gray-500">{r.ativo ? 'Ativo' : 'Inativo'}</div>
                    </td>

                    <td className="px-6 py-4 text-right font-semibold text-gray-900">{fmtEuro(r.base_sem_iva)}</td>

                    <td className="px-6 py-4 text-right font-bold text-green-700">{fmtEuro(r.comissao_calculada)}</td>

                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                        {r.faixa_atual}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right font-semibold text-gray-900">
                      {Math.round(r.percentual_meta)}%
                      <div className="text-xs text-gray-500">meta: {fmtEuro(r.meta_mensal_usada)}</div>
                    </td>

                    <td className="px-6 py-4 text-right text-gray-900 font-semibold">{r.frascos}</td>

                    <td className="px-6 py-4 text-right text-gray-900">
                      <div className="font-semibold">{r.num_faturas}</div>
                      <div className="text-xs text-gray-500">
                        {r.faturas_pagas} pagas • {r.faturas_pendentes} pend.
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t bg-gray-50 px-6 py-4 text-xs text-gray-600">
            Consistência: valores exibidos vêm <b>exclusivamente</b> de{' '}
            {mesFechado ? <b>comissoes_mensais</b> : <b>getVendedorMetricasMes</b>}. Base = <b>€ sem IVA</b>.
          </div>
        </div>
      )}
    </div>
  );
}


function ThCenter({ children }: { children: ReactNode }) {
  return <th className="text-center py-4 px-4 text-sm font-semibold text-gray-700">{children}</th>;
}
