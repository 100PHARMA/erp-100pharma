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
  FileText,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  buscarConfiguracaoFinanceira,
  calcularComissaoProgressiva,
  type ConfiguracaoFinanceira,
} from '@/lib/configuracoes-financeiras';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ======================================================================
// TIPOS E INTERFACES
// ======================================================================

interface Venda {
  id: string;
  vendedor_id: string;
  cliente_id: string;
  data: string;
  total_com_iva: number;
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

  // Seletor de mês/ano (padrão: mês atual)
  const hoje = new Date();
  const [mesSelecionado, setMesSelecionado] = useState(hoje.getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = useState(hoje.getFullYear());

  // Estado do fechamento de mês
  const [mesFechado, setMesFechado] = useState(false);
  const [resumoMensal, setResumoMensal] = useState<ResumoMensal | null>(null);

  // Modal de fechamento
  const [modalAberto, setModalAberto] = useState(false);
  const [custosFixosInput, setCustosFixosInput] = useState('');
  const [observacoesInput, setObservacoesInput] = useState('');
  const [processandoFechamento, setProcessandoFechamento] = useState(false);

  // Histórico de meses fechados
  const [historicoMeses, setHistoricoMeses] = useState<ResumoMensal[]>([]);

  // Estado de geração de PDF
  const [gerandoPDF, setGerandoPDF] = useState(false);

  // ======================================================================
  // CARREGAMENTO DE DADOS
  // ======================================================================

  useEffect(() => {
    carregarDadosFinanceiros();
    carregarHistoricoMeses();
  }, [mesSelecionado, anoSelecionado]);

  const carregarDadosFinanceiros = async () => {
    try {
      setCarregando(true);
      setErro(null);

      // 1. Verificar se o mês está fechado
      const { data: resumoData, error: resumoError } = await supabase
        .from('resumo_financeiro_mensal')
        .select('*')
        .eq('ano', anoSelecionado)
        .eq('mes', mesSelecionado)
        .single();

      if (resumoError && resumoError.code !== 'PGRST116') {
        throw resumoError;
      }

      if (resumoData) {
        // Mês está fechado - usar snapshot
        setMesFechado(true);
        setResumoMensal(resumoData);
        setDados({
          faturacaoBruta: resumoData.faturacao_bruta,
          frascosVendidos: resumoData.frascos_vendidos,
          comissaoTotal: resumoData.comissao_total,
          custoKmTotal: resumoData.custo_km_total,
          incentivoPodologista: resumoData.incentivo_podologista_total,
          fundoFarmaceutico: resumoData.fundo_farmaceutico_total,
          resultadoOperacional: resumoData.resultado_operacional,
          custosFixos: resumoData.custos_fixos,
          resultadoLiquido: resumoData.resultado_liquido,
          pontoEquilibrioFrascos: resumoData.ponto_equilibrio_frascos || undefined,
          pontoEquilibrioFaturacao: resumoData.ponto_equilibrio_faturacao || undefined,
          observacoes: resumoData.observacoes || undefined,
        });
        setCarregando(false);
        return;
      }

      // Mês em aberto - calcular dinamicamente
      setMesFechado(false);
      setResumoMensal(null);

      // 2. Buscar configuração financeira
      const config = await buscarConfiguracaoFinanceira();

      // 3. Calcular período do mês selecionado
      const primeiroDiaMes = new Date(anoSelecionado, mesSelecionado - 1, 1);
      const ultimoDiaMes = new Date(anoSelecionado, mesSelecionado, 0);

      const dataInicio = primeiroDiaMes.toISOString().split('T')[0];
      const dataFim = ultimoDiaMes.toISOString().split('T')[0];

      // 4. Buscar vendas do mês
      const { data: vendasData, error: vendasError } = await supabase
        .from('vendas')
        .select('*')
        .gte('data', dataInicio)
        .lte('data', dataFim);

      if (vendasError) throw vendasError;

      // 5. Buscar itens de vendas
      const vendasIds = (vendasData || []).map((v) => v.id);
      let vendaItensData: VendaItem[] = [];

      if (vendasIds.length > 0) {
        const { data: itensData, error: itensError } = await supabase
          .from('venda_itens')
          .select('*')
          .in('venda_id', vendasIds);

        if (itensError) throw itensError;
        vendaItensData = itensData || [];
      }

      // 6. Buscar quilometragem do mês
      const { data: kmData, error: kmError } = await supabase
        .from('vendedor_km')
        .select('*')
        .gte('data', dataInicio)
        .lte('data', dataFim);

      if (kmError) throw kmError;

      // 7. CALCULAR MÉTRICAS

      // Faturação bruta do mês
      const faturacaoBruta = (vendasData || []).reduce(
        (total, venda) => total + (venda.total_com_iva || 0),
        0
      );

      // Frascos vendidos no mês
      const frascosVendidos = vendaItensData.reduce(
        (total, item) => total + (item.quantidade || 0),
        0
      );

      // Custo total de quilometragem
      const custoKmTotal = (kmData || []).reduce(
        (total, km) => total + (km.valor || 0),
        0
      );

      // Incentivo podologista
      const incentivoPodologista =
        frascosVendidos * config.incentivo_podologista_por_frasco;

      // Fundo farmacêutico
      const fundoFarmaceutico =
        frascosVendidos * config.fundo_farmaceutico_por_frasco;

      // Comissão total (calcular por vendedor e somar)
      const vendedoresUnicos = Array.from(
        new Set((vendasData || []).map((v) => v.vendedor_id))
      );

      let comissaoTotal = 0;
      for (const vendedorId of vendedoresUnicos) {
        const vendasDoVendedor = (vendasData || []).filter(
          (v) => v.vendedor_id === vendedorId
        );
        const totalVendasVendedor = vendasDoVendedor.reduce(
          (sum, v) => sum + (v.total_com_iva || 0),
          0
        );
        const comissaoVendedor = calcularComissaoProgressiva(
          totalVendasVendedor,
          config
        );
        comissaoTotal += comissaoVendedor;
      }

      // Resultado operacional
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
      setErro(error.message || 'Erro ao carregar dados financeiros');
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

      // Validar custos fixos
      const custosFixos = parseFloat(custosFixosInput);
      if (isNaN(custosFixos) || custosFixos < 0) {
        alert('Por favor, insira um valor válido para os custos fixos.');
        return;
      }

      // Calcular resultado líquido
      const resultadoLiquido = dados.resultadoOperacional - custosFixos;

      // Calcular ponto de equilíbrio
      let pontoEquilibrioFrascos: number | null = null;
      let pontoEquilibrioFaturacao: number | null = null;

      if (dados.frascosVendidos > 0 && dados.resultadoOperacional > 0) {
        const margemContribuicaoPorFrasco =
          dados.resultadoOperacional / dados.frascosVendidos;
        pontoEquilibrioFrascos = custosFixos / margemContribuicaoPorFrasco;

        const precoMedioPorFrasco =
          dados.faturacaoBruta / dados.frascosVendidos;
        pontoEquilibrioFaturacao =
          pontoEquilibrioFrascos * precoMedioPorFrasco;
      }

      // Inserir registro na tabela
      const { error } = await supabase
        .from('resumo_financeiro_mensal')
        .insert({
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
          alert(
            'Este mês já foi fechado. Para alterar os dados, é necessário ajustar o registo em resumo_financeiro_mensal.'
          );
        } else {
          throw error;
        }
        return;
      }

      // Sucesso - recarregar dados
      fecharModal();
      await carregarDadosFinanceiros();
      await carregarHistoricoMeses();
      alert('Mês fechado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao fechar mês:', error);
      alert('Erro ao fechar mês: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setProcessandoFechamento(false);
    }
  };

  const visualizarMesFechado = (ano: number, mes: number) => {
    setAnoSelecionado(ano);
    setMesSelecionado(mes);
  };

  // ======================================================================
  // GERAÇÃO DE RELATÓRIO PDF - VERSÃO DE TESTE SIMPLIFICADA
  // ======================================================================

  const handleGerarRelatorioPdf = () => {
    alert("Gerar Relatório (PDF) - clique recebido");
    console.log("DEBUG: clique em Gerar Relatório (PDF)");
  };

  // ======================================================================
  // HELPERS
  // ======================================================================

  const formatarMoeda = (valor: number) => {
    return valor.toLocaleString('pt-PT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

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
              <h3 className="text-lg font-semibold text-red-900 mb-2">
                Erro ao carregar dados
              </h3>
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
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
              Fluxo Financeiro Mensal
            </h1>
            <p className="text-gray-600">
              Visão consolidada de faturação, comissões e custos
            </p>
          </div>

          {/* Seletor de Período e Botões */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Badge de Status */}
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

            {/* Seletor de Período */}
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

            {/* Botão Fechar Mês */}
            {!mesFechado && (
              <button
                onClick={abrirModalFechamento}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-md flex items-center gap-2 justify-center"
              >
                <Lock className="w-5 h-5" />
                Fechar Mês
              </button>
            )}

            {/* Botão Gerar Relatório PDF */}
            {mesFechado && (
              <button
                onClick={handleGerarRelatorioPdf}
                disabled={!mesFechado}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors font-semibold shadow-md flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileText className="w-5 h-5" />
                Gerar Relatório (PDF)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mensagem se não houver dados */}
      {semDados && !mesFechado && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-600" />
            <div>
              <h3 className="text-lg font-semibold text-yellow-900">
                Nenhuma venda registada para este mês
              </h3>
              <p className="text-yellow-700 text-sm">
                Selecione outro período ou aguarde novas vendas.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Primeira Linha de Cartões */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Faturação Bruta */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-blue-600 font-semibold">
              Faturação Bruta
            </span>
            <TrendingUp className="w-6 h-6 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-blue-900">
            {formatarMoeda(dados.faturacaoBruta)}€
          </p>
          <p className="text-xs text-blue-600 mt-2">Total com IVA</p>
        </div>

        {/* Frascos Vendidos */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-green-600 font-semibold">
              Frascos Vendidos
            </span>
            <Package className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-green-900">
            {dados.frascosVendidos}
          </p>
          <p className="text-xs text-green-600 mt-2">Unidades totais</p>
        </div>

        {/* Resultado Operacional */}
        <div
          className={`bg-gradient-to-br p-6 rounded-2xl shadow-lg ${
            dados.resultadoOperacional >= 0
              ? 'from-purple-50 to-purple-100'
              : 'from-red-50 to-red-100'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <span
              className={`text-sm font-semibold ${
                dados.resultadoOperacional >= 0
                  ? 'text-purple-600'
                  : 'text-red-600'
              }`}
            >
              Resultado Operacional
            </span>
            <Calculator
              className={`w-6 h-6 ${
                dados.resultadoOperacional >= 0
                  ? 'text-purple-600'
                  : 'text-red-600'
              }`}
            />
          </div>
          <p
            className={`text-3xl font-bold ${
              dados.resultadoOperacional >= 0
                ? 'text-purple-900'
                : 'text-red-900'
            }`}
          >
            {formatarMoeda(dados.resultadoOperacional)}€
          </p>
          <p
            className={`text-xs mt-2 ${
              dados.resultadoOperacional >= 0
                ? 'text-purple-600'
                : 'text-red-600'
            }`}
          >
            Antes de custos fixos
          </p>
        </div>
      </div>

      {/* Segunda Linha de Cartões */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* Comissão Total */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-emerald-600 font-semibold">
              Comissão Total
            </span>
            <DollarSign className="w-6 h-6 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-900">
            {formatarMoeda(dados.comissaoTotal)}€
          </p>
          <p className="text-xs text-emerald-600 mt-2">Vendedores</p>
        </div>

        {/* Custo de KM */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-orange-600 font-semibold">
              Custo de KM
            </span>
            <MapPin className="w-6 h-6 text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-orange-900">
            {formatarMoeda(dados.custoKmTotal)}€
          </p>
          <p className="text-xs text-orange-600 mt-2">Quilometragem</p>
        </div>

        {/* Incentivo Podologista */}
        <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-6 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-pink-600 font-semibold">
              Incentivo Podologista
            </span>
            <Award className="w-6 h-6 text-pink-600" />
          </div>
          <p className="text-2xl font-bold text-pink-900">
            {formatarMoeda(dados.incentivoPodologista)}€
          </p>
          <p className="text-xs text-pink-600 mt-2">
            {dados.frascosVendidos} frascos
          </p>
        </div>

        {/* Fundo Farmacêutico */}
        <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 p-6 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-cyan-600 font-semibold">
              Fundo Farmacêutico
            </span>
            <Trophy className="w-6 h-6 text-cyan-600" />
          </div>
          <p className="text-2xl font-bold text-cyan-900">
            {formatarMoeda(dados.fundoFarmaceutico)}€
          </p>
          <p className="text-xs text-cyan-600 mt-2">Farmácia Campeã</p>
        </div>
      </div>

      {/* Cartões Adicionais para Mês Fechado */}
      {mesFechado && dados.custosFixos !== undefined && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Custos Fixos */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-600 font-semibold">
                Custos Fixos
              </span>
              <Calculator className="w-6 h-6 text-gray-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatarMoeda(dados.custosFixos)}€
            </p>
            <p className="text-xs text-gray-600 mt-2">Mês fechado</p>
          </div>

          {/* Resultado Líquido */}
          <div
            className={`bg-gradient-to-br p-6 rounded-2xl shadow-lg ${
              (dados.resultadoLiquido || 0) >= 0
                ? 'from-green-50 to-green-100'
                : 'from-red-50 to-red-100'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <span
                className={`text-sm font-semibold ${
                  (dados.resultadoLiquido || 0) >= 0
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}
              >
                Resultado Líquido
              </span>
              <TrendingUp
                className={`w-6 h-6 ${
                  (dados.resultadoLiquido || 0) >= 0
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}
              />
            </div>
            <p
              className={`text-2xl font-bold ${
                (dados.resultadoLiquido || 0) >= 0
                  ? 'text-green-900'
                  : 'text-red-900'
              }`}
            >
              {formatarMoeda(dados.resultadoLiquido || 0)}€
            </p>
            <p
              className={`text-xs mt-2 ${
                (dados.resultadoLiquido || 0) >= 0
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}
            >
              Após custos fixos
            </p>
          </div>

          {/* Ponto de Equilíbrio */}
          {dados.pontoEquilibrioFrascos && dados.pontoEquilibrioFaturacao && (
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 rounded-2xl shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-indigo-600 font-semibold">
                  Ponto de Equilíbrio
                </span>
                <Calculator className="w-6 h-6 text-indigo-600" />
              </div>
              <p className="text-xl font-bold text-indigo-900">
                {Math.round(dados.pontoEquilibrioFrascos)} frascos
              </p>
              <p className="text-sm text-indigo-700 mt-1">
                {formatarMoeda(dados.pontoEquilibrioFaturacao)}€
              </p>
            </div>
          )}
        </div>
      )}

      {/* Observações (se houver) */}
      {mesFechado && dados.observacoes && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-bold text-blue-900 mb-2">Observações</h3>
          <p className="text-blue-800 text-sm whitespace-pre-wrap">
            {dados.observacoes}
          </p>
        </div>
      )}

      {/* Informação Adicional */}
      <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-200 mb-8">
        <h3 className="text-lg font-bold text-gray-900 mb-3">
          Sobre o Resultado Operacional
        </h3>
        <p className="text-gray-700 text-sm leading-relaxed">
          O <strong>Resultado Operacional</strong> representa o lucro após
          deduzir comissões de vendedores, custos de quilometragem, incentivos
          a podologistas e fundo farmacêutico. Este valor{' '}
          <strong>não inclui custos fixos</strong> como salários base, aluguel,
          utilidades e outros custos operacionais mensais.
        </p>
      </div>

      {/* Histórico de Meses Fechados */}
      {historicoMeses.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Histórico de Meses Fechados
          </h2>
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Mês/Ano
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Faturação Bruta
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Resultado Líquido
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Frascos Vendidos
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {historicoMeses.map((resumo) => (
                    <tr
                      key={resumo.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {meses[resumo.mes - 1]} {resumo.ano}
                        </div>
                        <div className="text-xs text-gray-500">
                          Fechado em{' '}
                          {new Date(resumo.data_fechamento).toLocaleDateString(
                            'pt-PT'
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-semibold text-gray-900">
                          {formatarMoeda(resumo.faturacao_bruta)}€
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div
                          className={`text-sm font-semibold ${
                            resumo.resultado_liquido >= 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {formatarMoeda(resumo.resultado_liquido)}€
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-gray-900">
                          {resumo.frascos_vendidos}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() =>
                            visualizarMesFechado(resumo.ano, resumo.mes)
                          }
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

      {/* Modal de Fechamento de Mês */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header do Modal */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">
                  Fechar mês {meses[mesSelecionado - 1]} de {anoSelecionado}
                </h2>
                <button
                  onClick={fecharModal}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6">
              {/* Resumo dos Valores Calculados */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  Resumo do Mês (valores calculados)
                </h3>
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">
                      Faturação Bruta
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {formatarMoeda(dados.faturacaoBruta)}€
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">
                      Frascos Vendidos
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {dados.frascosVendidos}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">
                      Comissão Total
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {formatarMoeda(dados.comissaoTotal)}€
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Custo de KM</p>
                    <p className="text-lg font-bold text-gray-900">
                      {formatarMoeda(dados.custoKmTotal)}€
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">
                      Incentivo Podologista
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {formatarMoeda(dados.incentivoPodologista)}€
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">
                      Fundo Farmacêutico
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {formatarMoeda(dados.fundoFarmaceutico)}€
                    </p>
                  </div>
                  <div className="col-span-2 pt-4 border-t border-gray-300">
                    <p className="text-xs text-gray-600 mb-1">
                      Resultado Operacional
                    </p>
                    <p
                      className={`text-xl font-bold ${
                        dados.resultadoOperacional >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {formatarMoeda(dados.resultadoOperacional)}€
                    </p>
                  </div>
                </div>
              </div>

              {/* Campos de Entrada */}
              <div className="space-y-4 mb-6">
                {/* Custos Fixos */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Custos Fixos deste mês (€) *
                  </label>
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
                  <p className="text-xs text-gray-500 mt-1">
                    Inclui salários, aluguel, utilidades, etc.
                  </p>
                </div>

                {/* Observações */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Observações (opcional)
                  </label>
                  <textarea
                    value={observacoesInput}
                    onChange={(e) => setObservacoesInput(e.target.value)}
                    placeholder="Adicione notas ou comentários sobre este mês..."
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>

              {/* Aviso */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-semibold mb-1">Atenção</p>
                    <p>
                      Ao confirmar o fechamento, os valores serão gravados
                      permanentemente. Este mês não poderá ser fechado novamente
                      sem ajustes diretos na base de dados.
                    </p>
                  </div>
                </div>
              </div>

              {/* Botões de Ação */}
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
