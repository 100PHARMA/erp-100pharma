"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  buscarConfiguracaoFinanceira,
  calcularComissaoProgressiva,
  type ConfiguracaoFinanceira,
} from "@/lib/configuracoes-financeiras";
import { RelatorioFinanceiroPdfButton } from "./RelatorioFinanceiroPdfButton";

// ======================================================================
// TIPOS E INTERFACES
// ======================================================================

interface Fatura {
  id: string;
  venda_id: string;
  estado: string; // PENDENTE | PAGA | CANCELADA ...
  data_emissao: string; // timestamp
  total?: number | null;
  subtotal?: number | null;
  total_sem_iva?: number | null;
  total_com_iva?: number | null;
}

interface Venda {
  id: string;
  vendedor_id: string | null;
  subtotal: number | null;
  iva: number | null;
  total_com_iva: number | null;
}

interface VendaItem {
  id: string;
  venda_id: string;
  quantidade: number;
  incentivo_podologista: number | null; // normalmente por frasco (congelado)
  incentivo_farmacia: number | null; // normalmente por frasco (congelado)
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

  const hoje = new Date();
  const [mesSelecionado, setMesSelecionado] = useState(hoje.getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = useState(hoje.getFullYear());

  const [mesFechado, setMesFechado] = useState(false);
  const [resumoMensal, setResumoMensal] = useState<ResumoMensal | null>(null);

  const [modalAberto, setModalAberto] = useState(false);
  const [custosFixosInput, setCustosFixosInput] = useState("");
  const [observacoesInput, setObservacoesInput] = useState("");
  const [processandoFechamento, setProcessandoFechamento] = useState(false);

  const [historicoMeses, setHistoricoMeses] = useState<ResumoMensal[]>([]);

  useEffect(() => {
    carregarDadosFinanceiros();
    carregarHistoricoMeses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesSelecionado, anoSelecionado]);

  // ======================================================================
  // HELPERS DE DATA (intervalo mensal)
  // ======================================================================

  const getMonthRangeUTC = (ano: number, mes: number) => {
    // range [start, endExclusive)
    const start = new Date(Date.UTC(ano, mes - 1, 1, 0, 0, 0));
    const endExclusive = new Date(Date.UTC(ano, mes, 1, 0, 0, 0));
    return {
      startISO: start.toISOString(),
      endExclusiveISO: endExclusive.toISOString(),
      startDateOnly: start.toISOString().slice(0, 10),
      endDateOnlyExclusive: endExclusive.toISOString().slice(0, 10),
    };
  };

  // ======================================================================
  // CARREGAMENTO DE DADOS
  // ======================================================================

  const carregarDadosFinanceiros = async () => {
    try {
      setCarregando(true);
      setErro(null);

      // 1) Verificar snapshot (mês fechado)
      const { data: resumoData, error: resumoError } = await supabase
        .from("resumo_financeiro_mensal")
        .select("*")
        .eq("ano", anoSelecionado)
        .eq("mes", mesSelecionado)
        .single();

      if (resumoError && resumoError.code !== "PGRST116") {
        throw resumoError;
      }

      if (resumoData) {
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

      // 2) Mês em aberto — calcular dinamicamente
      setMesFechado(false);
      setResumoMensal(null);

      const config: ConfiguracaoFinanceira = await buscarConfiguracaoFinanceira();

      // Regra: comissão mensal baseada em FATURAS EMITIDAS no mês (data_emissao)
      // e calculada SEM IVA.
      const { startISO, endExclusiveISO, startDateOnly, endDateOnlyExclusive } =
        getMonthRangeUTC(anoSelecionado, mesSelecionado);

      // 3) Buscar faturas EMITIDAS do mês (PENDENTE + PAGA). Ignorar CANCELADA.
      const { data: faturasData, error: faturasError } = await supabase
        .from("faturas")
        .select("id, venda_id, estado, data_emissao, total, subtotal, total_sem_iva, total_com_iva")
        .in("estado", ["PENDENTE", "PAGA"])
        .gte("data_emissao", startISO)
        .lt("data_emissao", endExclusiveISO);

      if (faturasError) throw faturasError;

      const faturas = (faturasData || []) as Fatura[];
      const vendasIds = Array.from(new Set(faturas.map((f) => f.venda_id))).filter(Boolean);

      // 4) Buscar vendas associadas (para vendedor_id e fallback de subtotal)
      let vendas: Venda[] = [];
      if (vendasIds.length > 0) {
        const { data: vendasData, error: vendasError } = await supabase
          .from("vendas")
          .select("id, vendedor_id, subtotal, iva, total_com_iva")
          .in("id", vendasIds);

        if (vendasError) throw vendasError;
        vendas = (vendasData || []) as Venda[];
      }

      const vendaById = new Map<string, Venda>();
      for (const v of vendas) vendaById.set(v.id, v);

      // 5) Buscar itens das vendas (para frascos e incentivos congelados)
      let itens: VendaItem[] = [];
      if (vendasIds.length > 0) {
        const { data: itensData, error: itensError } = await supabase
          .from("venda_itens")
          .select("id, venda_id, quantidade, incentivo_podologista, incentivo_farmacia")
          .in("venda_id", vendasIds);

        if (itensError) throw itensError;
        itens = (itensData || []) as VendaItem[];
      }

      // 6) Buscar quilometragem do mês (continua por data — base caixa/despesa)
      const { data: kmData, error: kmError } = await supabase
        .from("vendedor_km")
        .select("*")
        .gte("data", startDateOnly)
        .lt("data", endDateOnlyExclusive);

      if (kmError) throw kmError;

      const kms = (kmData || []) as Quilometragem[];

      // ======================================================================
      // CÁLCULOS
      // ======================================================================

      // A) Faturação bruta (mantemos COM IVA para o indicador macro)
      // Preferir total_com_iva da fatura; fallback para venda.total_com_iva
      const faturacaoBruta = faturas.reduce((acc, f) => {
        const venda = vendaById.get(f.venda_id);
        const totalComIva =
          (f.total_com_iva ?? f.total ?? null) ??
          (venda?.total_com_iva ?? 0);
        return acc + (Number(totalComIva) || 0);
      }, 0);

      // B) Frascos vendidos (quantidades dos itens)
      const frascosVendidos = itens.reduce((acc, it) => acc + (Number(it.quantidade) || 0), 0);

      // C) Incentivos (congelados nos itens) — respeita histórico
      // Assumindo que incentivo_* em venda_itens é valor por frasco no momento da venda.
      const incentivoPodologista = itens.reduce((acc, it) => {
        const rate = Number(it.incentivo_podologista ?? 0);
        return acc + (Number(it.quantidade) || 0) * rate;
      }, 0);

      const fundoFarmaceutico = itens.reduce((acc, it) => {
        const rate = Number(it.incentivo_farmacia ?? 0);
        return acc + (Number(it.quantidade) || 0) * rate;
      }, 0);

      // D) Custo km total
      const custoKmTotal = kms.reduce((acc, km) => acc + (Number(km.valor) || 0), 0);

      // E) Comissão total: progressiva por vendedor com base no SEM IVA (emitido no mês)
      // baseSemIva = COALESCE(faturas.total_sem_iva, faturas.subtotal, vendas.subtotal)
      const totalSemIvaPorVendedor = new Map<string, number>();

      for (const f of faturas) {
        const venda = vendaById.get(f.venda_id);
        const vendedorId = venda?.vendedor_id;

        if (!vendedorId) continue;

        const baseSemIva =
          (f.total_sem_iva ?? f.subtotal ?? null) ??
          (venda?.subtotal ?? 0);

        const atual = totalSemIvaPorVendedor.get(vendedorId) || 0;
        totalSemIvaPorVendedor.set(vendedorId, atual + (Number(baseSemIva) || 0));
      }

      let comissaoTotal = 0;
      for (const [vendedorId, totalSemIva] of totalSemIvaPorVendedor.entries()) {
        // cálculo progressivo (5/8/10) em cima do SEM IVA
        comissaoTotal += calcularComissaoProgressiva(totalSemIva, config);
      }

      // F) Resultado operacional (modelo: faturação bruta - comissões - km - incentivos)
      const resultadoOperacional =
        faturacaoBruta - comissaoTotal - custoKmTotal - incentivoPodologista - fundoFarmaceutico;

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
      console.error("Erro ao carregar dados financeiros:", error);
      setErro(error.message || "Erro ao carregar dados financeiros");
    } finally {
      setCarregando(false);
    }
  };

  const carregarHistoricoMeses = async () => {
    try {
      const { data, error } = await supabase
        .from("resumo_financeiro_mensal")
        .select("*")
        .order("ano", { ascending: false })
        .order("mes", { ascending: false });

      if (error) throw error;
      setHistoricoMeses((data || []) as ResumoMensal[]);
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
    }
  };

  // ======================================================================
  // FECHAMENTO DE MÊS
  // ======================================================================

  const abrirModalFechamento = () => {
    setCustosFixosInput("");
    setObservacoesInput("");
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setCustosFixosInput("");
    setObservacoesInput("");
  };

  const confirmarFechamento = async () => {
    try {
      setProcessandoFechamento(true);

      const custosFixos = parseFloat(custosFixosInput);
      if (isNaN(custosFixos) || custosFixos < 0) {
        alert("Por favor, insira um valor válido para os custos fixos.");
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

      const { error } = await supabase.from("resumo_financeiro_mensal").insert({
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
        status: "FECHADO",
        observacoes: observacoesInput || null,
      });

      if (error) {
        if (error.code === "23505") {
          alert(
            "Este mês já foi fechado. Para alterar os dados, é necessário ajustar o registo em resumo_financeiro_mensal."
          );
        } else {
          throw error;
        }
        return;
      }

      fecharModal();
      await carregarDadosFinanceiros();
      await carregarHistoricoMeses();
      alert("Mês fechado com sucesso!");
    } catch (error: any) {
      console.error("Erro ao fechar mês:", error);
      alert("Erro ao fechar mês: " + (error.message || "Erro desconhecido"));
    } finally {
      setProcessandoFechamento(false);
    }
  };

  const visualizarMesFechado = (ano: number, mes: number) => {
    setAnoSelecionado(ano);
    setMesSelecionado(mes);
  };

  // ======================================================================
  // HELPERS
  // ======================================================================

  const formatarMoeda = (valor: number) => {
    return valor.toLocaleString("pt-PT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const meses = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  const anos = Array.from({ length: 5 }, (_, i) => hoje.getFullYear() - i);

  const semDados =
    dados.faturacaoBruta === 0 &&
    dados.frascosVendidos === 0 &&
    dados.comissaoTotal === 0 &&
    dados.custoKmTotal === 0;

  // ======================================================================
  // RENDER
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

          {/* Seletor + botões */}
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
              <h3 className="text-lg font-semibold text-yellow-900">
                Nenhuma fatura emitida registada para este mês
              </h3>
              <p className="text-yellow-700 text-sm">
                Selecione outro período ou verifique emissões de faturas.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Primeira Linha de Cartões */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
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
          <p className="text-xs text-blue-600 mt-2">Faturas emitidas no mês</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-green-600 font-semibold">
              Frascos Vendidos
            </span>
            <Package className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-green-900">{dados.frascosVendidos}</p>
          <p className="text-xs text-green-600 mt-2">Unidades totais</p>
        </div>

        <div
          className={`bg-gradient-to-br p-6 rounded-2xl shadow-lg ${
            dados.resultadoOperacional >= 0
              ? "from-purple-50 to-purple-100"
              : "from-red-50 to-red-100"
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <span
              className={`text-sm font-semibold ${
                dados.resultadoOperacional >= 0 ? "text-purple-600" : "text-red-600"
              }`}
            >
              Resultado Operacional
            </span>
            <Calculator
              className={`w-6 h-6 ${
                dados.resultadoOperacional >= 0 ? "text-purple-600" : "text-red-600"
              }`}
            />
          </div>
          <p
            className={`text-3xl font-bold ${
              dados.resultadoOperacional >= 0 ? "text-purple-900" : "text-red-900"
            }`}
          >
            {formatarMoeda(dados.resultadoOperacional)}€
          </p>
          <p
            className={`text-xs mt-2 ${
              dados.resultadoOperacional >= 0 ? "text-purple-600" : "text-red-600"
            }`}
          >
            Antes de custos fixos
          </p>
        </div>
      </div>

      {/* Segunda Linha */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
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
          <p className="text-xs text-emerald-600 mt-2">
            Progressiva, sem IVA, por emissão
          </p>
        </div>

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
          <p className="text-xs text-pink-600 mt-2">Baseado nos itens (congelado)</p>
        </div>

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
          <p className="text-xs text-cyan-600 mt-2">Baseado nos itens (congelado)</p>
        </div>
      </div>

      {/* Cartões adicionais mês fechado */}
      {mesFechado && dados.custosFixos !== undefined && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-600 font-semibold">Custos Fixos</span>
              <Calculator className="w-6 h-6 text-gray-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatarMoeda(dados.custosFixos)}€
            </p>
            <p className="text-xs text-gray-600 mt-2">Mês fechado</p>
          </div>

          <div
            className={`bg-gradient-to-br p-6 rounded-2xl shadow-lg ${
              (dados.resultadoLiquido || 0) >= 0
                ? "from-green-50 to-green-100"
                : "from-red-50 to-red-100"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <span
                className={`text-sm font-semibold ${
                  (dados.resultadoLiquido || 0) >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                Resultado Líquido
              </span>
              <TrendingUp
                className={`w-6 h-6 ${
                  (dados.resultadoLiquido || 0) >= 0 ? "text-green-600" : "text-red-600"
                }`}
              />
            </div>
            <p
              className={`text-2xl font-bold ${
                (dados.resultadoLiquido || 0) >= 0 ? "text-green-900" : "text-red-900"
              }`}
            >
              {formatarMoeda(dados.resultadoLiquido || 0)}€
            </p>
            <p
              className={`text-xs mt-2 ${
                (dados.resultadoLiquido || 0) >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              Após custos fixos
            </p>
          </div>

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

      {mesFechado && dados.observacoes && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-bold text-blue-900 mb-2">Observações</h3>
          <p className="text-blue-800 text-sm whitespace-pre-wrap">
            {dados.observacoes}
          </p>
        </div>
      )}

      {/* Histórico */}
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
                    <tr key={resumo.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {meses[resumo.mes - 1]} {resumo.ano}
                        </div>
                        <div className="text-xs text-gray-500">
                          Fechado em{" "}
                          {new Date(resumo.data_fechamento).toLocaleDateString("pt-PT")}
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
                            resumo.resultado_liquido >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
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

      {/* Modal Fechamento */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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

            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  Resumo do Mês (valores calculados)
                </h3>
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Faturação Bruta</p>
                    <p className="text-lg font-bold text-gray-900">
                      {formatarMoeda(dados.faturacaoBruta)}€
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Frascos Vendidos</p>
                    <p className="text-lg font-bold text-gray-900">{dados.frascosVendidos}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Comissão Total</p>
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
                    <p className="text-xs text-gray-600 mb-1">Incentivo Podologista</p>
                    <p className="text-lg font-bold text-gray-900">
                      {formatarMoeda(dados.incentivoPodologista)}€
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Fundo Farmacêutico</p>
                    <p className="text-lg font-bold text-gray-900">
                      {formatarMoeda(dados.fundoFarmaceutico)}€
                    </p>
                  </div>
                  <div className="col-span-2 pt-4 border-t border-gray-300">
                    <p className="text-xs text-gray-600 mb-1">Resultado Operacional</p>
                    <p
                      className={`text-xl font-bold ${
                        dados.resultadoOperacional >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {formatarMoeda(dados.resultadoOperacional)}€
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 mb-6">
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

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-semibold mb-1">Atenção</p>
                    <p>
                      Ao confirmar o fechamento, os valores serão gravados permanentemente.
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
