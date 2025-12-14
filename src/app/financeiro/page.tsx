'use client';

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  Package,
  DollarSign,
  MapPin,
  Award,
  Trophy,
  Calculator,
  Calendar,
  AlertCircle,
  Lock,
  Unlock,
  Eye,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  buscarConfiguracaoFinanceira,
  calcularComissaoProgressiva,
  type ConfiguracaoFinanceira,
} from '@/lib/configuracoes-financeiras';
import { RelatorioFinanceiroPdfButton } from './RelatorioFinanceiroPdfButton';

// ======================================================================
// TIPOS E INTERFACES
// ======================================================================

interface FaturaRow {
  id: string;
  venda_id: string;
  estado: string;
  tipo: string | null;
  data_emissao: string; // timestamptz
  created_at: string; // timestamptz
  // valores (podem estar incompletos no teu banco, então faremos fallback)
  subtotal: number | null;
  total_sem_iva: number | null;
  total_com_iva: number | null;
}

interface VendaRow {
  id: string;
  vendedor_id: string | null;
  subtotal: number | null;
}

interface VendaItem {
  id: string;
  venda_id: string;
  produto_id: string;
  quantidade: number;
  preco_unitario: number;
}

interface Quilometragem {
  id: string;
  vendedor_id: string;
  data: string;
  km: number;
  valor: number;
}

interface DadosFinanceiros {
  faturacaoBruta: number;
  frascosVendidos: number;
  comissaoTotal: number;
  custoKmTotal: number;
  incentivoPodologista: number;
  fundoFarmaceutico: number;
  resultadoOperacional: number;
  custosFixos?: number;
  resultadoLiquido?: number;
  pontoEquilibrioFrascos?: number;
  pontoEquilibrioFaturacao?: number;
  observacoes?: string;
}

interface ResumoMensal {
  id: string;
  ano: number;
  mes: number;
  data_fechamento: string;
  faturacao_bruta: number;
  frascos_vendidos: number;
  comissao_total: number;
  custo_km_total: number;
  incentivo_podologista_total: number;
  fundo_farmaceutico_total: number;
  resultado_operacional: number;
  custos_fixos: number;
  resultado_liquido: number;
  ponto_equilibrio_frascos: number | null;
  ponto_equilibrio_faturacao: number | null;
  status: string;
  observacoes: string | null;
  created_at: string;
}

// ======================================================================
// HELPERS
// ======================================================================

function safeNumber(n: any): number {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? v : 0;
}

function startOfMonthISO(ano: number, mes: number): string {
  // mes: 1-12
  const d = new Date(Date.UTC(ano, mes - 1, 1, 0, 0, 0));
  return d.toISOString();
}

function endOfMonthISO(ano: number, mes: number): string {
  // ultimo dia do mes, 23:59:59.999 UTC
  const d = new Date(Date.UTC(ano, mes, 0, 23, 59, 59, 999));
  return d.toISOString();
}

/**
 * Regra defensiva:
 * - Para cada venda_id, manter apenas 1 fatura do tipo "FATURA" (a mais recente por created_at)
 * - Para outros tipos (ex: NOTA_CREDITO), manter todas
 * - Excluir CANCELADA sempre
 */
function normalizarFaturas(faturas: FaturaRow[]): FaturaRow[] {
  const validas = faturas.filter((f) => f.estado !== 'CANCELADA');

  const porVendaFat: Record<string, FaturaRow> = {};
  const outras: FaturaRow[] = [];

  for (const f of validas) {
    const tipo = (f.tipo || 'FATURA').toUpperCase();
    if (tipo === 'FATURA') {
      const key = f.venda_id;
      const atual = porVendaFat[key];
      if (!atual) {
        porVendaFat[key] = f;
      } else {
        // manter a mais recente
        const tAtual = new Date(atual.created_at).getTime();
        const tNova = new Date(f.created_at).getTime();
        if (tNova > tAtual) porVendaFat[key] = f;
      }
    } else {
      outras.push(f);
    }
  }

  return [...Object.values(porVendaFat), ...outras];
}

// ======================================================================
// COMPONENTE PRINCIPAL
// ======================================================================

export default function FinanceiroPage() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<DadosFinanceiros>({
    faturacaoBruta: 0,
    frascosVendidos: 0,
    comissaoTotal: 0,
    custoKmTotal: 0,
    incentivoPodologista: 0,
    fundoFarmaceutico: 0,
    resultadoOperacional: 0,
  });

  const hoje = new Date();
  const [mesSelecionado, setMesSelecionado] = useState(hoje.getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = useState(hoje.getFullYear());

  const [mesFechado, setMesFechado] = useState(false);
  const [resumoMensal, setResumoMensal] = useState<ResumoMensal | null>(null);

  const [modalAberto, setModalAberto] = useState(false);
  const [custosFixosInput, setCustosFixosInput] = useState('');
  const [observacoesInput, setObservacoesInput] = useState('');
  const [processandoFechamento, setProcessandoFechamento] = useState(false);

  const [historicoMeses, setHistoricoMeses] = useState<ResumoMensal[]>([]);

  useEffect(() => {
    carregarDadosFinanceiros();
    carregarHistoricoMeses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesSelecionado, anoSelecionado]);

  const carregarDadosFinanceiros = async () => {
    try {
      setCarregando(true);
      setErro(null);

      // 1) Verificar snapshot de mês fechado
      const { data: resumoData, error: resumoError } = await supabase
        .from('resumo_financeiro_mensal')
        .select('*')
        .eq('ano', anoSelecionado)
        .eq('mes', mesSelecionado)
        .single();

      if (resumoError && resumoError.code !== 'PGRST116') throw resumoError;

      if (resumoData) {
        setMesFechado(true);
        setResumoMensal(resumoData);
        setDados({
          faturacaoBruta: safeNumber(resumoData.faturacao_bruta),
          frascosVendidos: safeNumber(resumoData.frascos_vendidos),
          comissaoTotal: safeNumber(resumoData.comissao_total),
          custoKmTotal: safeNumber(resumoData.custo_km_total),
          incentivoPodologista: safeNumber(resumoData.incentivo_podologista_total),
          fundoFarmaceutico: safeNumber(resumoData.fundo_farmaceutico_total),
          resultadoOperacional: safeNumber(resumoData.resultado_operacional),
          custosFixos: safeNumber(resumoData.custos_fixos),
          resultadoLiquido: safeNumber(resumoData.resultado_liquido),
          pontoEquilibrioFrascos: resumoData.ponto_equilibrio_frascos ?? undefined,
          pontoEquilibrioFaturacao: resumoData.ponto_equilibrio_faturacao ?? undefined,
          observacoes: resumoData.observacoes || undefined,
        });
        return;
      }

      // 2) Mês em aberto: calcular dinamicamente (POR EMISSÃO)
      setMesFechado(false);
      setResumoMensal(null);

      const config: ConfiguracaoFinanceira = await buscarConfiguracaoFinanceira();

      const inicioISO = startOfMonthISO(anoSelecionado, mesSelecionado);
      const fimISO = endOfMonthISO(anoSelecionado, mesSelecionado);

      // 3) Buscar faturas emitidas no mês (exclui canceladas depois via normalizar)
      const { data: faturasRaw, error: faturasError } = await supabase
        .from('faturas')
        .select('id, venda_id, estado, tipo, data_emissao, created_at, subtotal, total_sem_iva, total_com_iva')
        .gte('data_emissao', inicioISO)
        .lte('data_emissao', fimISO);

      if (faturasError) throw faturasError;

      const faturasNormalizadas = normalizarFaturas((faturasRaw || []) as FaturaRow[]);

      const vendasIds = Array.from(new Set(faturasNormalizadas.map((f) => f.venda_id).filter(Boolean)));

      // 4) Buscar vendas (para vendedor_id e fallback de subtotal)
      let vendasData: VendaRow[] = [];
      if (vendasIds.length > 0) {
        const { data, error } = await supabase
          .from('vendas')
          .select('id, vendedor_id, subtotal')
          .in('id', vendasIds);

        if (error) throw error;
        vendasData = (data || []) as VendaRow[];
      }

      const vendaById = new Map<string, VendaRow>();
      for (const v of vendasData) vendaById.set(v.id, v);

      // 5) Buscar itens das vendas (para frascos)
      let vendaItensData: VendaItem[] = [];
      if (vendasIds.length > 0) {
        const { data, error } = await supabase
          .from('venda_itens')
          .select('*')
          .in('venda_id', vendasIds);

        if (error) throw error;
        vendaItensData = (data || []) as VendaItem[];
      }

      // 6) Quilometragem do mês (mantém como está: por campo "data" date)
      const dataInicio = new Date(Date.UTC(anoSelecionado, mesSelecionado - 1, 1)).toISOString().split('T')[0];
      const dataFim = new Date(Date.UTC(anoSelecionado, mesSelecionado, 0)).toISOString().split('T')[0];

      const { data: kmData, error: kmError } = await supabase
        .from('vendedor_km')
        .select('*')
        .gte('data', dataInicio)
        .lte('data', dataFim);

      if (kmError) throw kmError;

      // ======================================================================
      // 7) CÁLCULOS
      // ======================================================================

      // Faturação Bruta (emitida) = soma total_com_iva (fallback: 0)
      const faturacaoBruta = faturasNormalizadas.reduce((sum, f) => {
        return sum + safeNumber(f.total_com_iva);
      }, 0);

      // Frascos vendidos = soma quantidade dos itens (das vendas ligadas às faturas)
      // Nota: se existir nota de crédito, isso não "devolve" frascos automaticamente.
      // Se quiseres ajustar frascos por devolução, precisas modelar isso no stock/movimentos.
      const frascosVendidos = vendaItensData.reduce((sum, it) => sum + safeNumber(it.quantidade), 0);

      // Custo KM total
      const custoKmTotal = (kmData || []).reduce((sum: number, km: Quilometragem) => sum + safeNumber(km.valor), 0);

      // Incentivos (corrigido: nomes certos)
      const incentivoPodologista = frascosVendidos * safeNumber(config.incentivo_podologista);
      const fundoFarmaceutico = frascosVendidos * safeNumber(config.fundo_farmaceutico);

      // Comissão progressiva por vendedor usando base SEM IVA emitida no mês
      // Base sem IVA por fatura:
      // - prioridade: total_sem_iva
      // - fallback: subtotal
      // - fallback: vendas.subtotal
      // Se nota de crédito vier negativa, ela reduz base e reduz comissão (clawback).
      const baseSemIvaPorVendedor = new Map<string, number>();

      for (const f of faturasNormalizadas) {
        const venda = vendaById.get(f.venda_id);
        const vendedorId = venda?.vendedor_id;
        if (!vendedorId) continue;

        const baseSemIva =
          (f.total_sem_iva !== null && f.total_sem_iva !== undefined)
            ? safeNumber(f.total_sem_iva)
            : (f.subtotal !== null && f.subtotal !== undefined)
              ? safeNumber(f.subtotal)
              : safeNumber(venda?.subtotal);

        const atual = baseSemIvaPorVendedor.get(vendedorId) || 0;
        baseSemIvaPorVendedor.set(vendedorId, atual + baseSemIva);
      }

      let comissaoTotal = 0;
      for (const [, totalSemIvaVendedor] of baseSemIvaPorVendedor.entries()) {
        comissaoTotal += calcularComissaoProgressiva(safeNumber(totalSemIvaVendedor), config);
      }

      const resultadoOperacional =
        faturacaoBruta -
        comissaoTotal -
        custoKmTotal -
        incentivoPodologista -
        fundoFarmaceutico;

      setDados({
        faturacaoBruta,
        frascosVendidos,
        comissaoTotal,
        custoKmTotal,
        incentivoPodologista,
        fundoFarmaceutico,
        resultadoOperacional,
      });
    } catch (error: any) {
      console.error('Erro ao carregar dados financeiros:', error);
      setErro(error?.message || 'Erro ao carregar dados financeiros');
    } finally {
      setCarregando(false);
    }
  };

  const carregarHistoricoMeses = async () => {
    try {
      const { data, error } = await supabase
        .from('resumo_financeiro_mensal')
        .select('*')
        .order('ano', { ascending: false })
        .order('mes', { ascending: false });

      if (error) throw error;
      setHistoricoMeses(data || []);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    }
  };

  // ======================================================================
  // FECHAMENTO DE MÊS
  // ======================================================================

  const abrirModalFechamento = () => {
    setCustosFixosInput('');
    setObservacoesInput('');
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setCustosFixosInput('');
    setObservacoesInput('');
  };

  const confirmarFechamento = async () => {
    try {
      setProcessandoFechamento(true);

      const custosFixos = parseFloat(custosFixosInput);
      if (Number.isNaN(custosFixos) || custosFixos < 0) {
        alert('Por favor, insira um valor válido para os custos fixos.');
        return;
      }

      const resultadoLiquido = dados.resultadoOperacional - custosFixos;

      let pontoEquilibrioFrascos: number | null = null;
      let pontoEquilibrioFaturacao: number | null = null;

      if (dados.frascosVendidos > 0 && dados.resultadoOperacional > 0) {
        const margemContribuicaoPorFrasco = dados.resultadoOperacional / dados.frascosVendidos;
        pontoEquilibrioFrascos = custosFixos / margemContribuicaoPorFrasco;

        const precoMedioPorFrasco = dados.faturacaoBruta / dados.frascosVendidos;
        pontoEquilibrioFaturacao = pontoEquilibrioFrascos * precoMedioPorFrasco;
      }

      const { error } = await supabase.from('resumo_financeiro_mensal').insert({
        ano: anoSelecionado,
        mes: mesSelecionado,
        faturacao_bruta: dados.faturacaoBruta,
        frascos_vendidos: dados.frascosVendidos,
        comissao_total: dados.comissaoTotal,
        custo_km_total: dados.custoKmTotal,
        incentivo_podologista_total: dados.incentivoPodologista,
        fundo_farmaceutico_total: dados.fundoFarmaceutico,
        resultado_operacional: dados.resultadoOperacional,
        custos_fixos: custosFixos,
        resultado_liquido: resultadoLiquido,
        ponto_equilibrio_frascos: pontoEquilibrioFrascos,
        ponto_equilibrio_faturacao: pontoEquilibrioFaturacao,
        status: 'FECHADO',
        observacoes: observacoesInput || null,
      });

      if (error) {
        if (error.code === '23505') {
          alert('Este mês já foi fechado. Para alterar, ajuste o registo em resumo_financeiro_mensal.');
        } else {
          throw error;
        }
        return;
      }

      fecharModal();
      await carregarDadosFinanceiros();
      await carregarHistoricoMeses();
      alert('Mês fechado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao fechar mês:', error);
      alert('Erro ao fechar mês: ' + (error?.message || 'Erro desconhecido'));
    } finally {
      setProcessandoFechamento(false);
    }
  };

  const visualizarMesFechado = (ano: number, mes: number) => {
    setAnoSelecionado(ano);
    setMesSelecionado(mes);
  };

  const formatarMoeda = (valor: number) =>
    safeNumber(valor).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  const anos = Array.from({ length: 5 }, (_, i) => hoje.getFullYear() - i);

  const semDados =
    dados.faturacaoBruta === 0 &&
    dados.frascosVendidos === 0 &&
    dados.comissaoTotal === 0 &&
    dados.custoKmTotal === 0;

  // ======================================================================
  // RENDERIZAÇÃO
  // ======================================================================

  if (carregando) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando dados financeiros...</p>
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
              <h3 className="text-lg font-semibold text-red-900 mb-2">Erro ao carregar dados</h3>
              <div className="text-red-700 mb-4">{erro}</div>
              <button
                onClick={carregarDadosFinanceiros}
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
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Fluxo Financeiro Mensal</h1>
            <p className="text-gray-600">Visão consolidada de faturação, comissões e custos</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {mesFechado ? (
              <div className="flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-lg font-semibold">
                <Lock className="w-4 h-4" />
                Mês fechado
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg font-semibold">
                <Unlock className="w-4 h-4" />
                Mês em aberto
              </div>
            )}

            <div className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-md">
              <Calendar className="w-5 h-5 text-blue-600" />
              <select
                value={mesSelecionado}
                onChange={(e) => setMesSelecionado(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {meses.map((mes, index) => (
                  <option key={index} value={index + 1}>
                    {mes}
                  </option>
                ))}
              </select>
              <select
                value={anoSelecionado}
                onChange={(e) => setAnoSelecionado(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {anos.map((ano) => (
                  <option key={ano} value={ano}>
                    {ano}
                  </option>
                ))}
              </select>
            </div>

            {!mesFechado && (
              <button
                onClick={abrirModalFechamento}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-md flex items-center gap-2 justify-center"
              >
                <Lock className="w-5 h-5" />
                Fechar Mês
              </button>
            )}

            {mesFechado && (
              <RelatorioFinanceiroPdfButton
                dados={{
                  ano: anoSelecionado,
                  mesNumero: mesSelecionado,
                  mesNome: meses[mesSelecionado - 1],
                  faturacaoBruta: dados.faturacaoBruta,
                  frascosVendidos: dados.frascosVendidos,
                  comissaoTotal: dados.comissaoTotal,
                  custoKm: dados.custoKmTotal,
                  incentivoPodologista: dados.incentivoPodologista,
                  fundoFarmaceutico: dados.fundoFarmaceutico,
                  custoFixo: dados.custosFixos || 0,
                  resultadoOperacional: dados.resultadoOperacional,
                  resultadoLiquido: dados.resultadoLiquido || 0,
                }}
              />
            )}
          </div>
        </div>
      </div>

      {semDados && !mesFechado && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-600" />
            <div>
              <h3 className="text-lg font-semibold text-yellow-900">Nenhuma fatura emitida registada para este mês</h3>
              <p className="text-yellow-700 text-sm">Selecione outro período ou emita faturas.</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-blue-600 font-semibold">Faturação Bruta</span>
            <TrendingUp className="w-6 h-6 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-blue-900">{formatarMoeda(dados.faturacaoBruta)}€</p>
          <p className="text-xs text-blue-600 mt-2">Faturas emitidas no mês</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-green-600 font-semibold">Frascos Vendidos</span>
            <Package className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-green-900">{dados.frascosVendidos}</p>
          <p className="text-xs text-green-600 mt-2">Unidades totais</p>
        </div>

        <div
          className={`bg-gradient-to-br p-6 rounded-2xl shadow-lg ${
            dados.resultadoOperacional >= 0 ? 'from-purple-50 to-purple-100' : 'from-red-50 to-red-100'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <span className={`text-sm font-semibold ${dados.resultadoOperacional >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
              Resultado Operacional
            </span>
            <Calculator className={`w-6 h-6 ${dados.resultadoOperacional >= 0 ? 'text-purple-600' : 'text-red-600'}`} />
          </div>
          <p className={`text-3xl font-bold ${dados.resultadoOperacional >= 0 ? 'text-purple-900' : 'text-red-900'}`}>
            {formatarMoeda(dados.resultadoOperacional)}€
          </p>
          <p className={`text-xs mt-2 ${dados.resultadoOperacional >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
            Antes de custos fixos
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-emerald-600 font-semibold">Comissão Total</span>
            <DollarSign className="w-6 h-6 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-900">{formatarMoeda(dados.comissaoTotal)}€</p>
          <p className="text-xs text-emerald-600 mt-2">Vendedores</p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-orange-600 font-semibold">Custo de KM</span>
            <MapPin className="w-6 h-6 text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-orange-900">{formatarMoeda(dados.custoKmTotal)}€</p>
          <p className="text-xs text-orange-600 mt-2">Quilometragem</p>
        </div>

        <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-6 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-pink-600 font-semibold">Incentivo Podologista</span>
            <Award className="w-6 h-6 text-pink-600" />
          </div>
          <p className="text-2xl font-bold text-pink-900">{formatarMoeda(dados.incentivoPodologista)}€</p>
          <p className="text-xs text-pink-600 mt-2">{dados.frascosVendidos} frascos</p>
        </div>

        <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 p-6 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-cyan-600 font-semibold">Fundo Farmacêutico</span>
            <Trophy className="w-6 h-6 text-cyan-600" />
          </div>
          <p className="text-2xl font-bold text-cyan-900">{formatarMoeda(dados.fundoFarmaceutico)}€</p>
          <p className="text-xs text-cyan-600 mt-2">Farmácia Campeã</p>
        </div>
      </div>

      {mesFechado && dados.custosFixos !== undefined && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-600 font-semibold">Custos Fixos</span>
              <Calculator className="w-6 h-6 text-gray-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatarMoeda(dados.custosFixos)}€</p>
            <p className="text-xs text-gray-600 mt-2">Mês fechado</p>
          </div>

          <div
            className={`bg-gradient-to-br p-6 rounded-2xl shadow-lg ${
              (dados.resultadoLiquido || 0) >= 0 ? 'from-green-50 to-green-100' : 'from-red-50 to-red-100'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className={`text-sm font-semibold ${(dados.resultadoLiquido || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                Resultado Líquido
              </span>
              <TrendingUp className={`w-6 h-6 ${(dados.resultadoLiquido || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`} />
            </div>
            <p className={`text-2xl font-bold ${(dados.resultadoLiquido || 0) >= 0 ? 'text-green-900' : 'text-red-900'}`}>
              {formatarMoeda(dados.resultadoLiquido || 0)}€
            </p>
            <p className={`text-xs mt-2 ${(dados.resultadoLiquido || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              Após custos fixos
            </p>
          </div>

          {dados.pontoEquilibrioFrascos && dados.pontoEquilibrioFaturacao && (
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 rounded-2xl shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-indigo-600 font-semibold">Ponto de Equilíbrio</span>
                <Calculator className="w-6 h-6 text-indigo-600" />
              </div>
              <p className="text-xl font-bold text-indigo-900">{Math.round(dados.pontoEquilibrioFrascos)} frascos</p>
              <p className="text-sm text-indigo-700 mt-1">{formatarMoeda(dados.pontoEquilibrioFaturacao)}€</p>
            </div>
          )}
        </div>
      )}

      {mesFechado && dados.observacoes && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-bold text-blue-900 mb-2">Observações</h3>
          <p className="text-blue-800 text-sm whitespace-pre-wrap">{dados.observacoes}</p>
        </div>
      )}

      <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-200 mb-8">
        <h3 className="text-lg font-bold text-gray-900 mb-3">Sobre o Resultado Operacional</h3>
        <p className="text-gray-700 text-sm leading-relaxed">
          O <strong>Resultado Operacional</strong> representa o lucro após deduzir comissões de vendedores, custos de quilometragem,
          incentivos a podologistas e fundo farmacêutico. Este valor <strong>não inclui custos fixos</strong>.
        </p>
        <p className="text-gray-700 text-sm leading-relaxed mt-2">
          <strong>Nota:</strong> Os valores são calculados com base em <strong>faturas emitidas</strong>, usando a <strong>data de emissão</strong>.
        </p>
      </div>

      {historicoMeses.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Histórico de Meses Fechados</h2>
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Mês/Ano</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Faturação Bruta</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Resultado Líquido</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Frascos Vendidos</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {historicoMeses.map((resumo) => (
                    <tr key={resumo.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {meses[resumo.mes - 1]} {resumo.ano}
                        </div>
                        <div className="text-xs text-gray-500">
                          Fechado em {new Date(resumo.data_fechamento).toLocaleDateString('pt-PT')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-semibold text-gray-900">{formatarMoeda(resumo.faturacao_bruta)}€</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className={`text-sm font-semibold ${resumo.resultado_liquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatarMoeda(resumo.resultado_liquido)}€
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-gray-900">{resumo.frascos_vendidos}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => visualizarMesFechado(resumo.ano, resumo.mes)}
                          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
                        >
                          <Eye className="w-4 h-4" />
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">
                  Fechar mês {meses[mesSelecionado - 1]} de {anoSelecionado}
                </h2>
                <button onClick={fecharModal} className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Resumo do Mês (valores calculados)</h3>
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Faturação Bruta</p>
                    <p className="text-lg font-bold text-gray-900">{formatarMoeda(dados.faturacaoBruta)}€</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Frascos Vendidos</p>
                    <p className="text-lg font-bold text-gray-900">{dados.frascosVendidos}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Comissão Total</p>
                    <p className="text-lg font-bold text-gray-900">{formatarMoeda(dados.comissaoTotal)}€</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Custo de KM</p>
                    <p className="text-lg font-bold text-gray-900">{formatarMoeda(dados.custoKmTotal)}€</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Incentivo Podologista</p>
                    <p className="text-lg font-bold text-gray-900">{formatarMoeda(dados.incentivoPodologista)}€</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Fundo Farmacêutico</p>
                    <p className="text-lg font-bold text-gray-900">{formatarMoeda(dados.fundoFarmaceutico)}€</p>
                  </div>
                  <div className="col-span-2 pt-4 border-t border-gray-300">
                    <p className="text-xs text-gray-600 mb-1">Resultado Operacional</p>
                    <p className={`text-xl font-bold ${dados.resultadoOperacional >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatarMoeda(dados.resultadoOperacional)}€
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Custos Fixos deste mês (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={custosFixosInput}
                    onChange={(e) => setCustosFixosInput(e.target.value)}
                    placeholder="Ex: 5000.00"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Inclui salários, aluguel, utilidades, etc.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Observações (opcional)</label>
                  <textarea
                    value={observacoesInput}
                    onChange={(e) => setObservacoesInput(e.target.value)}
                    placeholder="Adicione notas ou comentários sobre este mês..."
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-semibold mb-1">Atenção</p>
                    <p>
                      Ao confirmar o fechamento, os valores serão gravados permanentemente. Este mês não poderá ser fechado novamente sem
                      ajustes diretos na base de dados.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={fecharModal}
                  className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
                  disabled={processandoFechamento}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarFechamento}
                  disabled={processandoFechamento || !custosFixosInput}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {processandoFechamento ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Processando...
                    </>
                  ) : (
                    <>
                      <Lock className="w-5 h-5" />
                      Confirmar Fechamento
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
