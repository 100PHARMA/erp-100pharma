'use client';

import { useState, useEffect } from 'react';
import { 
  UserCircle, Plus, Search, Edit, Trash2, Eye, Phone, Mail, 
  TrendingUp, Target, Users, Package, FileText, MapPin, Calendar,
  DollarSign, Award, Building2, CheckCircle, XCircle, Download, AlertCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  buscarConfiguracaoFinanceira,
  calcularComissaoProgressiva,
  calcularPercentualMeta,
  type ConfiguracaoFinanceira,
} from '@/lib/configuracoes-financeiras';
import { gerarRelatorioVendedorPdf } from '@/lib/relatorio-vendedor-pdf';


// ======================================================================
// TIPOS E INTERFACES
// ======================================================================

type ModoComissao = 'FASE1' | 'FASE2';
type StatusVendedor = 'ATIVO' | 'INATIVO';
type StatusVisita = 'REALIZADA' | 'PENDENTE' | 'CANCELADA';

interface Vendedor {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  salario_base: number;
  custo_km: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  // Dados calculados
  vendasMes: number;
  comissaoMes: number;
  frascosMes: number;
  percentualMeta: number;
  clientesAtivos: number;
  kmRodadosMes: number;
  custoKmMes: number;
}

interface Cliente {
  id: string;
  nome: string;
  localidade: string;
  ativo: boolean;
}

interface VendedorCliente {
  id: string;
  vendedor_id: string;
  cliente_id: string;
  ativo: boolean;
  created_at: string;
}

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

interface Visita {
  id: string;
  vendedor_id: string;
  cliente_id: string;
  data_visita: string;
  estado: string;
  notas: string;
}

// Funções de cálculo agora importadas de configuracoes-financeiras.ts

// ======================================================================
// COMPONENTE PRINCIPAL
// ======================================================================

export default function VendedoresPage() {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vendedorClientes, setVendedorClientes] = useState<VendedorCliente[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [vendaItens, setVendaItens] = useState<VendaItem[]>([]);
  const [quilometragens, setQuilometragens] = useState<Quilometragem[]>([]);
  const [visitas, setVisitas] = useState<Visita[]>([]);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [busca, setBusca] = useState('');
  const [modalNovo, setModalNovo] = useState(false);
  const [modalDetalhes, setModalDetalhes] = useState(false);
  const [modalAdicionarCliente, setModalAdicionarCliente] = useState(false);
  const [modalAdicionarKm, setModalAdicionarKm] = useState(false);
  const [modalAdicionarVisita, setModalAdicionarVisita] = useState(false);
  const [modalEditarKm, setModalEditarKm] = useState(false);
  const [modalEditarVisita, setModalEditarVisita] = useState(false);
  const [vendedorSelecionado, setVendedorSelecionado] = useState<Vendedor | null>(null);
  const [kmSelecionada, setKmSelecionada] = useState<Quilometragem | null>(null);
  const [visitaSelecionada, setVisitaSelecionada] = useState<Visita | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<'resumo' | 'carteira' | 'vendas' | 'km'>('resumo');
  const [buscaCliente, setBuscaCliente] = useState('');

  // Período do relatório do vendedor
  const [tipoPeriodoRelatorio, setTipoPeriodoRelatorio] = useState<
    'MES_ATUAL' | 'ULTIMOS_30' | 'MES_ANTERIOR' | 'PERSONALIZADO'
  >('MES_ATUAL');

  const [dataInicioRelatorio, setDataInicioRelatorio] = useState<string>('');
  const [dataFimRelatorio, setDataFimRelatorio] = useState<string>('');
  const [mostrarModalPeriodo, setMostrarModalPeriodo] = useState(false);


  // Estados para formulários
  const [novoVendedor, setNovoVendedor] = useState({
    nome: '',
    email: '',
    telefone: '',
    salario_base: 0,
    custo_km: 0.40,
  });

  const [novaKm, setNovaKm] = useState({
    data: new Date().toISOString().split('T')[0],
    km: 0,
  });

  const [novaVisita, setNovaVisita] = useState({
    cliente_id: '',
    data_visita: new Date().toISOString().split('T')[0],
    estado: 'PENDENTE',
    notas: '',
  });

  // ======================================================================
  // CÁLCULO DO INTERVALO DO RELATÓRIO DO VENDEDOR
  // ======================================================================

  const calcularIntervaloRelatorio = () => {
    const hoje = new Date();

    // Se for personalizado e as duas datas estiverem preenchidas, usa-as diretamente
    if (
      tipoPeriodoRelatorio === 'PERSONALIZADO' &&
      dataInicioRelatorio &&
      dataFimRelatorio
    ) {
      return {
        dataInicio: dataInicioRelatorio,
        dataFim: dataFimRelatorio,
      };
    }

    let inicio: Date;
    let fim: Date;

    switch (tipoPeriodoRelatorio) {
      case 'ULTIMOS_30': {
        fim = hoje;
        inicio = new Date(hoje);
        inicio.setDate(inicio.getDate() - 29); // últimos 30 dias incluindo hoje
        break;
      }
      case 'MES_ANTERIOR': {
        const ano = hoje.getFullYear();
        const mesAnterior = hoje.getMonth() - 1; // 0–11
        inicio = new Date(ano, mesAnterior, 1);
        fim = new Date(ano, mesAnterior + 1, 0);
        break;
      }
      case 'MES_ATUAL':
      default: {
        const ano = hoje.getFullYear();
        const mes = hoje.getMonth();
        inicio = new Date(ano, mes, 1);
        fim = new Date(ano, mes + 1, 0);
        break;
      }
    }

    return {
      dataInicio: inicio.toISOString().split('T')[0],
      dataFim: fim.toISOString().split('T')[0],
    };
  };
  
  // ======================================================================
  // CARREGAMENTO DE DADOS DO SUPABASE
  // ======================================================================

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setCarregando(true);
      setErro(null);

      // Carregar configuração financeira
      const configFinanceira = await buscarConfiguracaoFinanceira();

      // Carregar vendedores
      const { data: vendedoresData, error: vendedoresError } = await supabase
        .from('vendedores')
        .select('*')
        .order('nome', { ascending: true });

      if (vendedoresError) throw vendedoresError;

      // Carregar clientes
      const { data: clientesData, error: clientesError } = await supabase
        .from('clientes')
        .select('*')
        .order('nome', { ascending: true });

      if (clientesError) throw clientesError;

      // Carregar vendedor_clientes
      const { data: vendedorClientesData, error: vendedorClientesError } = await supabase
        .from('vendedor_clientes')
        .select('*');

      if (vendedorClientesError) throw vendedorClientesError;

      // Carregar vendas do mês atual
      const hoje = new Date();
      const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

      const { data: vendasData, error: vendasError } = await supabase
        .from('vendas')
        .select('*')
        .gte('data', primeiroDiaMes.toISOString().split('T')[0])
        .lte('data', ultimoDiaMes.toISOString().split('T')[0]);

      if (vendasError) throw vendasError;

      // Carregar itens de vendas
      const { data: vendaItensData, error: vendaItensError } = await supabase
        .from('venda_itens')
        .select('*');

      if (vendaItensError) throw vendaItensError;

      // Carregar quilometragens
      const { data: quilometragensData, error: quilometragensError } = await supabase
        .from('vendedor_km')
        .select('*')
        .order('data', { ascending: false });

      if (quilometragensError) throw quilometragensError;

      // Carregar visitas
      const { data: visitasData, error: visitasError } = await supabase
        .from('vendedor_visitas')
        .select('*')
        .order('data_visita', { ascending: false });

      if (visitasError) throw visitasError;

      // Calcular métricas para cada vendedor
      const vendedoresComMetricas = (vendedoresData || []).map((vendedor) => {
        // Vendas do mês
        const vendasDoVendedor = (vendasData || []).filter(
          (v) => v.vendedor_id === vendedor.id
        );
        const vendasMes = vendasDoVendedor.reduce(
          (total, venda) => total + (venda.total_com_iva || 0),
          0
        );

        // Frascos vendidos no mês
        const vendasIds = vendasDoVendedor.map((v) => v.id);
        const frascosMes = (vendaItensData || [])
          .filter((item) => vendasIds.includes(item.venda_id))
          .reduce((total, item) => total + (item.quantidade || 0), 0);

        // Comissão progressiva (usando configuração dinâmica)
        const comissaoMes = calcularComissaoProgressiva(vendasMes, configFinanceira);

        // Percentual de meta (usando configuração dinâmica)
        const percentualMeta = calcularPercentualMeta(vendasMes, configFinanceira);

        // Clientes ativos
        const clientesAtivos = (vendedorClientesData || []).filter(
          (vc) => vc.vendedor_id === vendedor.id && vc.ativo
        ).length;

        // KM rodados no mês (soma de km da tabela vendedor_km)
        const kmDoMes = (quilometragensData || []).filter((km) => {
          if (km.vendedor_id !== vendedor.id) return false;
          const dataKm = new Date(km.data);
          return dataKm >= primeiroDiaMes && dataKm <= ultimoDiaMes;
        });
        const kmRodadosMes = kmDoMes.reduce((total, km) => total + (km.km || 0), 0);

        // Custo de km no mês (soma de valor da tabela vendedor_km)
        const custoKmMes = kmDoMes.reduce((total, km) => total + (km.valor || 0), 0);

        return {
          ...vendedor,
          vendasMes,
          comissaoMes,
          frascosMes,
          percentualMeta,
          clientesAtivos,
          kmRodadosMes,
          custoKmMes,
        };
      });

      setVendedores(vendedoresComMetricas);
      setClientes(clientesData || []);
      setVendedorClientes(vendedorClientesData || []);
      setVendas(vendasData || []);
      setVendaItens(vendaItensData || []);
      setQuilometragens(quilometragensData || []);
      setVisitas(visitasData || []);
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      
      // Mensagens de erro mais específicas
      let mensagemErro = 'Erro ao carregar dados do Supabase';
      
      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        mensagemErro = 'Não foi possível conectar ao Supabase. Verifique:\n\n' +
          '1. Sua conexão com a internet\n' +
          '2. Se as variáveis de ambiente estão configuradas corretamente\n' +
          '3. Se o projeto Supabase está ativo e acessível\n' +
          '4. Se as configurações de CORS estão corretas no Supabase';
      } else if (error.message?.includes('timeout')) {
        mensagemErro = 'Tempo limite de conexão excedido. O servidor Supabase pode estar lento ou indisponível.';
      } else {
        mensagemErro = error.message || 'Erro desconhecido ao carregar dados';
      }
      
      setErro(mensagemErro);
    } finally {
      setCarregando(false);
    }
  };

  // Filtros
  const vendedoresFiltrados = vendedores.filter(
    (v) =>
      v.nome.toLowerCase().includes(busca.toLowerCase()) ||
      v.email.toLowerCase().includes(busca.toLowerCase())
  );

  // ======================================================================
  // FUNÇÕES DE MANIPULAÇÃO
  // ======================================================================

  const salvarNovoVendedor = async () => {
    if (!novoVendedor.nome || !novoVendedor.email) {
      alert('Preencha nome e email obrigatórios!');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('vendedores')
        .insert([
          {
            nome: novoVendedor.nome,
            email: novoVendedor.email,
            telefone: novoVendedor.telefone,
            salario_base: novoVendedor.salario_base,
            custo_km: novoVendedor.custo_km,
            ativo: true,
          },
        ])
        .select();

      if (error) throw error;

      setModalNovo(false);
      setNovoVendedor({
        nome: '',
        email: '',
        telefone: '',
        salario_base: 0,
        custo_km: 0.40,
      });
      carregarDados();
      alert('Vendedor cadastrado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao cadastrar vendedor:', error);
      alert('Erro ao cadastrar vendedor: ' + error.message);
    }
  };

  const toggleStatus = async (id: string) => {
    try {
      const vendedor = vendedores.find((v) => v.id === id);
      if (!vendedor) return;

      const { error } = await supabase
        .from('vendedores')
        .update({ ativo: !vendedor.ativo })
        .eq('id', id);

      if (error) throw error;

      carregarDados();
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status: ' + error.message);
    }
  };

  const abrirDetalhes = (vendedor: Vendedor) => {
    setVendedorSelecionado(vendedor);
    setAbaAtiva('resumo');
    setModalDetalhes(true);
  };

  const abrirModalAdicionarKm = () => {
    setNovaKm({
      data: new Date().toISOString().split('T')[0],
      km: 0,
    });
    setModalAdicionarKm(true);
  };

  const adicionarKm = async () => {
    if (!vendedorSelecionado) return;

    if (!novaKm.km || novaKm.km <= 0) {
      alert('Preencha o campo KM com um valor válido!');
      return;
    }

    try {
      // Calcular valor automaticamente: km * custo_km do vendedor
      const valorCalculado = novaKm.km * vendedorSelecionado.custo_km;

      const { error } = await supabase.from('vendedor_km').insert([
        {
          vendedor_id: vendedorSelecionado.id,
          data: novaKm.data,
          km: novaKm.km,
          valor: valorCalculado,
        },
      ]);

      if (error) throw error;

      setModalAdicionarKm(false);
      setNovaKm({
        data: new Date().toISOString().split('T')[0],
        km: 0,
      });
      carregarDados();
      alert('Quilometragem adicionada com sucesso!');
    } catch (error: any) {
      console.error('Erro ao adicionar quilometragem:', error);
      alert('Erro ao adicionar quilometragem: ' + error.message);
    }
  };

  const abrirModalEditarKm = (km: Quilometragem) => {
    setKmSelecionada(km);
    setNovaKm({
      data: km.data,
      km: km.km,
    });
    setModalEditarKm(true);
  };

  const salvarEdicaoKm = async () => {
    if (!kmSelecionada || !vendedorSelecionado) return;

    if (!novaKm.km || novaKm.km <= 0) {
      alert('Preencha o campo KM com um valor válido!');
      return;
    }

    try {
      // Recalcular valor automaticamente: novo_km * custo_km atual do vendedor
      const valorCalculado = novaKm.km * vendedorSelecionado.custo_km;

      const { error } = await supabase
        .from('vendedor_km')
        .update({
          data: novaKm.data,
          km: novaKm.km,
          valor: valorCalculado,
        })
        .eq('id', kmSelecionada.id);

      if (error) throw error;

      setModalEditarKm(false);
      setKmSelecionada(null);
      carregarDados();
      alert('Quilometragem atualizada com sucesso!');
    } catch (error: any) {
      console.error('Erro ao atualizar quilometragem:', error);
      alert('Erro ao atualizar quilometragem: ' + error.message);
    }
  };

  const excluirKm = async (id: string) => {
    if (!confirm('Deseja realmente excluir este registro de quilometragem?')) return;

    try {
      const { error } = await supabase.from('vendedor_km').delete().eq('id', id);

      if (error) throw error;

      carregarDados();
      alert('Quilometragem excluída com sucesso!');
    } catch (error: any) {
      console.error('Erro ao excluir quilometragem:', error);
      alert('Erro ao excluir quilometragem: ' + error.message);
    }
  };

  const abrirModalAdicionarVisita = () => {
    setNovaVisita({
      cliente_id: '',
      data_visita: new Date().toISOString().split('T')[0],
      estado: 'PENDENTE',
      notas: '',
    });
    setModalAdicionarVisita(true);
  };

  const adicionarVisita = async () => {
    if (!vendedorSelecionado || !novaVisita.cliente_id) {
      alert('Selecione um cliente!');
      return;
    }

    try {
      const { error } = await supabase.from('vendedor_visitas').insert([
        {
          vendedor_id: vendedorSelecionado.id,
          cliente_id: novaVisita.cliente_id,
          data_visita: novaVisita.data_visita,
          estado: novaVisita.estado,
          notas: novaVisita.notas,
        },
      ]);

      if (error) throw error;

      setModalAdicionarVisita(false);
      setNovaVisita({
        cliente_id: '',
        data_visita: new Date().toISOString().split('T')[0],
        estado: 'PENDENTE',
        notas: '',
      });
      carregarDados();
      alert('Visita adicionada com sucesso!');
    } catch (error: any) {
      console.error('Erro ao adicionar visita:', error);
      alert('Erro ao adicionar visita: ' + error.message);
    }
  };

  const abrirModalEditarVisita = (visita: Visita) => {
    setVisitaSelecionada(visita);
    setNovaVisita({
      cliente_id: visita.cliente_id,
      data_visita: visita.data_visita,
      estado: visita.estado,
      notas: visita.notas,
    });
    setModalEditarVisita(true);
  };

  const salvarEdicaoVisita = async () => {
    if (!visitaSelecionada) return;

    try {
      const { error } = await supabase
        .from('vendedor_visitas')
        .update({
          cliente_id: novaVisita.cliente_id,
          data_visita: novaVisita.data_visita,
          estado: novaVisita.estado,
          notas: novaVisita.notas,
        })
        .eq('id', visitaSelecionada.id);

      if (error) throw error;

      setModalEditarVisita(false);
      setVisitaSelecionada(null);
      carregarDados();
      alert('Visita atualizada com sucesso!');
    } catch (error: any) {
      console.error('Erro ao atualizar visita:', error);
      alert('Erro ao atualizar visita: ' + error.message);
    }
  };

  const excluirVisita = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta visita?')) return;

    try {
      const { error } = await supabase.from('vendedor_visitas').delete().eq('id', id);

      if (error) throw error;

      carregarDados();
      alert('Visita excluída com sucesso!');
    } catch (error: any) {
      console.error('Erro ao excluir visita:', error);
      alert('Erro ao excluir visita: ' + error.message);
    }
  };

  const gerarRelatorioMensal = async () => {
  if (!vendedorSelecionado) return;

  try {
    const hoje = new Date();

    let dataInicio: string;
    let dataFim: string;

    // Define o intervalo de datas de acordo com a escolha do modal
    switch (tipoPeriodoRelatorio) {
      case 'MES_ATUAL': {
        const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
        dataInicio = primeiroDiaMes.toISOString().split('T')[0];
        dataFim = ultimoDiaMes.toISOString().split('T')[0];
        break;
      }

      case 'ULTIMOS_30': {
        const fim = new Date(hoje);
        const inicio = new Date(hoje);
        inicio.setDate(inicio.getDate() - 29); // 30 dias incluindo hoje
        dataInicio = inicio.toISOString().split('T')[0];
        dataFim = fim.toISOString().split('T')[0];
        break;
      }

      case 'MES_ANTERIOR': {
        const primeiroDiaMesAnterior = new Date(
          hoje.getFullYear(),
          hoje.getMonth() - 1,
          1
        );
        const ultimoDiaMesAnterior = new Date(
          hoje.getFullYear(),
          hoje.getMonth(),
          0
        );
        dataInicio = primeiroDiaMesAnterior.toISOString().split('T')[0];
        dataFim = ultimoDiaMesAnterior.toISOString().split('T')[0];
        break;
      }

      case 'PERSONALIZADO': {
        // Aqui usamos as datas escolhidas no modal
        if (!dataInicioRelatorio || !dataFimRelatorio) {
          alert('Preencha as datas de início e fim para o período personalizado.');
          return;
        }
        dataInicio = dataInicioRelatorio;
        dataFim = dataFimRelatorio;
        break;
      }

      default: {
        // fallback: mês atual
        const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
        dataInicio = primeiroDiaMes.toISOString().split('T')[0];
        dataFim = ultimoDiaMes.toISOString().split('T')[0];
      }
    }

    // ==========================
    // DADOS BÁSICOS DO VENDEDOR
    // ==========================
    const vendedorInfo = {
      nome: vendedorSelecionado.nome,
      email: vendedorSelecionado.email,
      telefone: vendedorSelecionado.telefone,
      ativo: vendedorSelecionado.ativo,
    };

    // ==========================
    // VENDAS DO PERÍODO
    // ==========================
    const vendasPeriodo = vendas
      .filter(
        (v) =>
          v.vendedor_id === vendedorSelecionado.id &&
          v.data >= dataInicio &&
          v.data <= dataFim
      )
      .map((venda) => {
        const cliente = clientes.find((c) => c.id === venda.cliente_id);
        const itens = vendaItens.filter((item) => item.venda_id === venda.id);
        const totalFrascos = itens.reduce(
          (sum, item) => sum + (item.quantidade || 0),
          0
        );

        return {
          id: venda.id,
          data: venda.data,
          cliente_nome: cliente?.nome || 'N/A',
          total_com_iva: venda.total_com_iva,
          frascos: totalFrascos,
        };
      });

    // ==========================
    // QUILOMETRAGEM DO PERÍODO
    // ==========================
    const quilometragensPeriodo = quilometragens.filter(
      (km) =>
        km.vendedor_id === vendedorSelecionado.id &&
        km.data >= dataInicio &&
        km.data <= dataFim
    );

    // ==========================
    // VISITAS DO PERÍODO
    // ==========================
    const visitasPeriodo = visitas
      .filter(
        (visita) =>
          visita.vendedor_id === vendedorSelecionado.id &&
          visita.data_visita >= dataInicio &&
          visita.data_visita <= dataFim
      )
      .map((visita) => {
        const cliente = clientes.find((c) => c.id === visita.cliente_id);
        return {
          id: visita.id,
          data_visita: visita.data_visita,
          estado: visita.estado,
          notas: visita.notas,
          cliente_nome: cliente?.nome || 'N/A',
        };
      });

    // ==========================
    // RESUMO DO PERÍODO
    // (recalculado com base no intervalo escolhido)
    // ==========================
    const faturacaoPeriodo = vendasPeriodo.reduce(
      (sum, v) => sum + (v.total_com_iva || 0),
      0
    );

    const frascosPeriodo = vendasPeriodo.reduce(
      (sum, v) => sum + (v.frascos || 0),
      0
    );

    const kmRodadosPeriodo = quilometragensPeriodo.reduce(
      (sum, km) => sum + (km.km || 0),
      0
    );

    const custoKmPeriodo = quilometragensPeriodo.reduce(
      (sum, km) => sum + (km.valor || 0),
      0
    );

    const resumo = {
      vendasMes: faturacaoPeriodo,
      frascosMes: frascosPeriodo,
      // por enquanto usa a comissão/meta do mês já calculadas,
      // se quiser com precisão por período depois recalculamos via config financeira
      comissaoMes: vendedorSelecionado.comissaoMes,
      percentualMeta: vendedorSelecionado.percentualMeta,
      clientesAtivos: vendedorSelecionado.clientesAtivos,
      kmRodadosMes: kmRodadosPeriodo,
      custoKmMes: custoKmPeriodo,
    };

    // ==========================
    // GERAR PDF
    // ==========================
    await gerarRelatorioVendedorPdf({
      vendedor: vendedorInfo,
      intervalo: { dataInicio, dataFim },
      resumo,
      vendas: vendasPeriodo,
      quilometragens: quilometragensPeriodo,
      visitas: visitasPeriodo,
    });
  } catch (error: any) {
    console.error('Erro ao gerar relatório do vendedor:', error);
    alert(
      'Erro ao gerar relatório do vendedor: ' +
        (error.message || 'Erro desconhecido')
    );
  }
};

  const abrirModalAdicionarCliente = () => {
    setBuscaCliente('');
    setModalAdicionarCliente(true);
  };

  const adicionarClienteAoVendedor = async (clienteId: string) => {
    if (!vendedorSelecionado) return;

    try {
      // Verificar se já existe relação
      const { data: existente } = await supabase
        .from('vendedor_clientes')
        .select('*')
        .eq('vendedor_id', vendedorSelecionado.id)
        .eq('cliente_id', clienteId)
        .single();

      if (existente) {
        // Reativar se existir
        const { error } = await supabase
          .from('vendedor_clientes')
          .update({ ativo: true })
          .eq('id', existente.id);

        if (error) throw error;
      } else {
        // Criar nova relação
        const { error } = await supabase.from('vendedor_clientes').insert([
          {
            vendedor_id: vendedorSelecionado.id,
            cliente_id: clienteId,
            ativo: true,
          },
        ]);

        if (error) throw error;
      }

      setModalAdicionarCliente(false);
      carregarDados();
      alert('Cliente adicionado à carteira com sucesso!');
    } catch (error: any) {
      console.error('Erro ao adicionar cliente:', error);
      alert('Erro ao adicionar cliente: ' + error.message);
    }
  };

  const removerClienteDoVendedor = async (clienteId: string) => {
    if (!vendedorSelecionado) return;

    if (!confirm('Deseja realmente remover este cliente da carteira?')) return;

    try {
      const { error } = await supabase
        .from('vendedor_clientes')
        .update({ ativo: false })
        .eq('vendedor_id', vendedorSelecionado.id)
        .eq('cliente_id', clienteId);

      if (error) throw error;

      carregarDados();
      alert('Cliente removido da carteira com sucesso!');
    } catch (error: any) {
      console.error('Erro ao remover cliente:', error);
      alert('Erro ao remover cliente: ' + error.message);
    }
  };

  // Filtrar dados do vendedor selecionado
  const clientesDoVendedor = vendedorSelecionado
    ? vendedorClientes
        .filter((vc) => vc.vendedor_id === vendedorSelecionado.id && vc.ativo)
        .map((vc) => clientes.find((c) => c.id === vc.cliente_id))
        .filter((c) => c !== undefined)
    : [];

  const vendasDoVendedor = vendedorSelecionado
    ? vendas.filter((v) => v.vendedor_id === vendedorSelecionado.id)
    : [];

  const kmDoVendedor = vendedorSelecionado
    ? quilometragens.filter((k) => k.vendedor_id === vendedorSelecionado.id)
    : [];

  const visitasDoVendedor = vendedorSelecionado
    ? visitas.filter((v) => v.vendedor_id === vendedorSelecionado.id)
    : [];

  // Clientes disponíveis para adicionar
  const clientesJaNaCarteira = vendedorSelecionado
    ? vendedorClientes
        .filter((vc) => vc.vendedor_id === vendedorSelecionado.id && vc.ativo)
        .map((vc) => vc.cliente_id)
    : [];

  const clientesDisponiveis = clientes
    .filter((c) => !clientesJaNaCarteira.includes(c.id))
    .filter(
      (c) =>
        c.nome.toLowerCase().includes(buscaCliente.toLowerCase()) ||
        (c.localidade && c.localidade.toLowerCase().includes(buscaCliente.toLowerCase()))
    );

  // Calcular valor total automaticamente quando KM mudar
  const valorCalculadoKm = vendedorSelecionado
    ? novaKm.km * vendedorSelecionado.custo_km
    : 0;

  // ======================================================================
  // RENDERIZAÇÃO
  // ======================================================================

  if (carregando) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando vendedores...</p>
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
              <div className="text-red-700 mb-4 whitespace-pre-line">{erro}</div>
              <div className="flex gap-3">
                <button
                  onClick={carregarDados}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Tentar Novamente
                </button>
                <button
                  onClick={() => window.location.href = '/'}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Voltar ao Início
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
              Vendedores
            </h1>
            <p className="text-gray-600">Gestão da equipa comercial</p>
          </div>
          <button
            onClick={() => setModalNovo(true)}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 hover:scale-105"
          >
            <Plus className="w-5 h-5" />
            Novo Vendedor
          </button>
        </div>
      </div>

      {/* Busca */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Cards de Vendedores */}
      {vendedoresFiltrados.length === 0 ? (
        <div className="text-center py-12">
          <UserCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Nenhum vendedor encontrado
          </h3>
          <p className="text-gray-600 mb-6">
            {busca
              ? 'Tente ajustar sua busca'
              : 'Comece adicionando um novo vendedor'}
          </p>
          {!busca && (
            <button
              onClick={() => setModalNovo(true)}
              className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Adicionar Vendedor
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vendedoresFiltrados.map((vendedor) => (
            <div
              key={vendedor.id}
              className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300"
            >
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-lg">
                      <UserCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">{vendedor.nome}</h3>
                      <p className="text-xs opacity-90">
                        {vendedor.ativo ? 'Ativo' : 'Inativo'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status</span>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                      vendedor.ativo
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {vendedor.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                {/* Contatos */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4" />
                    <span className="truncate">{vendedor.telefone || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{vendedor.email}</span>
                  </div>
                </div>

                {/* Métricas */}
                <div className="border-t pt-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Vendas do Mês</span>
                    <span className="font-bold text-purple-600">
                      {vendedor.vendasMes.toLocaleString('pt-PT', {
                        minimumFractionDigits: 2,
                      })}
                      €
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Frascos Vendidos</span>
                    <span className="font-bold text-blue-600">{vendedor.frascosMes}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Comissão Atual</span>
                    <span className="font-bold text-green-600">
                      {vendedor.comissaoMes.toLocaleString('pt-PT', {
                        minimumFractionDigits: 2,
                      })}
                      €
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-600">Meta Mensal</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {vendedor.percentualMeta.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(vendedor.percentualMeta, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Botões */}
                <div className="flex gap-2 pt-4">
                  <button
                    onClick={() => abrirDetalhes(vendedor)}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-50 text-blue-600 py-2 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    Detalhes
                  </button>
                  <button
                    onClick={() => toggleStatus(vendedor.id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-colors ${
                      vendedor.ativo
                        ? 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                        : 'bg-green-50 text-green-600 hover:bg-green-100'
                    }`}
                  >
                    {vendedor.ativo ? (
                      <XCircle className="w-4 h-4" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    {vendedor.ativo ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Novo Vendedor */}
      {modalNovo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold">Novo Vendedor</h2>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    value={novoVendedor.nome}
                    onChange={(e) =>
                      setNovoVendedor({ ...novoVendedor, nome: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="Nome do vendedor"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={novoVendedor.email}
                    onChange={(e) =>
                      setNovoVendedor({ ...novoVendedor, email: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="email@100pharma.pt"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Telefone
                  </label>
                  <input
                    type="text"
                    value={novoVendedor.telefone}
                    onChange={(e) =>
                      setNovoVendedor({ ...novoVendedor, telefone: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="+351 91 234 5678"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Salário Base (€)
                  </label>
                  <input
                    type="number"
                    value={novoVendedor.salario_base}
                    onChange={(e) =>
                      setNovoVendedor({
                        ...novoVendedor,
                        salario_base: Number(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="1200"
                    min="0"
                    step="50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Custo por KM (€)
                  </label>
                  <input
                    type="number"
                    value={novoVendedor.custo_km}
                    onChange={(e) =>
                      setNovoVendedor({
                        ...novoVendedor,
                        custo_km: Number(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="0.40"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={salvarNovoVendedor}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
                >
                  Cadastrar
                </button>
                <button
                  onClick={() => setModalNovo(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalhes do Vendedor */}
      {modalDetalhes && vendedorSelecionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{vendedorSelecionado.nome}</h2>
                  <p className="text-sm opacity-90">{vendedorSelecionado.email}</p>
                </div>
                <button
                  onClick={() => setModalDetalhes(false)}
                  className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Abas */}
            <div className="border-b">
              <div className="flex overflow-x-auto">
                {[
                  { id: 'resumo', label: 'Painel Resumo', icon: TrendingUp },
                  { id: 'carteira', label: 'Carteira de Clientes', icon: Users },
                  { id: 'vendas', label: 'Vendas & Comissões', icon: DollarSign },
                  { id: 'km', label: 'Quilometragem & Visitas', icon: MapPin },
                ].map((aba) => (
                  <button
                    key={aba.id}
                    onClick={() => setAbaAtiva(aba.id as any)}
                    className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                      abaAtiva === aba.id
                        ? 'text-purple-600 border-b-2 border-purple-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <aba.icon className="w-4 h-4" />
                    {aba.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Conteúdo das Abas */}
            <div className="p-6">
              {/* ABA: PAINEL RESUMO */}
              {abaAtiva === 'resumo' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-blue-600 font-medium">
                          Faturação do Mês
                        </span>
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                      </div>
                      <p className="text-2xl font-bold text-blue-900">
                        {vendedorSelecionado.vendasMes.toLocaleString('pt-PT', {
                          minimumFractionDigits: 2,
                        })}
                        €
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-green-600 font-medium">
                          Frascos Vendidos
                        </span>
                        <Package className="w-5 h-5 text-green-600" />
                      </div>
                      <p className="text-2xl font-bold text-green-900">
                        {vendedorSelecionado.frascosMes}
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-purple-600 font-medium">
                          Clientes Ativos
                        </span>
                        <Building2 className="w-5 h-5 text-purple-600" />
                      </div>
                      <p className="text-2xl font-bold text-purple-900">
                        {vendedorSelecionado.clientesAtivos}
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-6 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-pink-600 font-medium">Meta Mensal</span>
                        <Target className="w-5 h-5 text-pink-600" />
                      </div>
                      <p className="text-2xl font-bold text-pink-900">
                        {vendedorSelecionado.percentualMeta.toFixed(0)}%
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-emerald-600 font-medium">
                          Comissão Estimada
                        </span>
                        <DollarSign className="w-5 h-5 text-emerald-600" />
                      </div>
                      <p className="text-2xl font-bold text-emerald-900">
                        {vendedorSelecionado.comissaoMes.toLocaleString('pt-PT', {
                          minimumFractionDigits: 2,
                        })}
                        €
                      </p>
                      <p className="text-xs text-emerald-600 mt-1">Faixas progressivas</p>
                    </div>

                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-orange-600 font-medium">
                          Km rodados no mês
                        </span>
                        <MapPin className="w-5 h-5 text-orange-600" />
                      </div>
                      <p className="text-2xl font-bold text-orange-900">
                        {vendedorSelecionado.kmRodadosMes.toFixed(0)} km
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 p-6 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-cyan-600 font-medium">
                          Custo de km no mês
                        </span>
                        <DollarSign className="w-5 h-5 text-cyan-600" />
                      </div>
                      <p className="text-2xl font-bold text-cyan-900">
                        {vendedorSelecionado.custoKmMes.toLocaleString('pt-PT', {
                          minimumFractionDigits: 2,
                        })}
                        €
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setMostrarModalPeriodo(true)}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
                  >
                    <Download className="w-5 h-5" />
                    Gerar Relatório Mensal (PDF)
                  </button>
                </div>
              )}

              {/* ABA: CARTEIRA DE CLIENTES */}
              {abaAtiva === 'carteira' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Clientes Atribuídos</h3>
                      <p className="text-sm text-gray-600">
                        {clientesDoVendedor.length} clientes
                      </p>
                    </div>
                    <button
                      onClick={abrirModalAdicionarCliente}
                      className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar Cliente
                    </button>
                  </div>

                  <div className="space-y-2">
                    {clientesDoVendedor.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Nenhum cliente atribuído</p>
                      </div>
                    ) : (
                      clientesDoVendedor.map((cliente: any) => (
                        <div
                          key={cliente.id}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <Building2 className="w-5 h-5 text-gray-400" />
                            <div>
                              <p className="font-medium text-gray-900">{cliente.nome}</p>
                              <p className="text-sm text-gray-600">
                                {cliente.localidade || 'N/A'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                cliente.ativo
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {cliente.ativo ? 'Ativo' : 'Inativo'}
                            </span>
                            <button
                              onClick={() => removerClienteDoVendedor(cliente.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Remover cliente"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* ABA: VENDAS & COMISSÕES */}
              {abaAtiva === 'vendas' && (
                <div className="space-y-6">
                  {/* Resumo de Comissões */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl">
                      <p className="text-sm text-green-600 font-medium mb-2">
                        Comissão do Mês
                      </p>
                      <p className="text-2xl font-bold text-green-900">
                        {vendedorSelecionado.comissaoMes.toLocaleString('pt-PT', {
                          minimumFractionDigits: 2,
                        })}
                        €
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl">
                      <p className="text-sm text-blue-600 font-medium mb-2">
                        Vendas do Mês
                      </p>
                      <p className="text-2xl font-bold text-blue-900">
                        {vendedorSelecionado.vendasMes.toLocaleString('pt-PT', {
                          minimumFractionDigits: 2,
                        })}
                        €
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl">
                      <p className="text-sm text-purple-600 font-medium mb-2">
                        Frascos Vendidos (Mês)
                      </p>
                      <p className="text-2xl font-bold text-purple-900">
                        {vendedorSelecionado.frascosMes}
                      </p>
                    </div>
                  </div>

                  {/* Lista de Vendas */}
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Vendas Recentes</h3>
                    <div className="space-y-2">
                      {vendasDoVendedor.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p>Nenhuma venda registrada</p>
                        </div>
                      ) : (
                        vendasDoVendedor.map((venda) => {
                          const cliente = clientes.find((c) => c.id === venda.cliente_id);
                          const itens = vendaItens.filter(
                            (item) => item.venda_id === venda.id
                          );
                          const totalFrascos = itens.reduce(
                            (sum, item) => sum + item.quantidade,
                            0
                          );

                          return (
                            <div
                              key={venda.id}
                              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                            >
                              <div>
                                <p className="font-medium text-gray-900">
                                  {cliente?.nome || 'Cliente não encontrado'}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {new Date(venda.data).toLocaleDateString('pt-PT')} •{' '}
                                  {totalFrascos} frascos
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-purple-600">
                                  {venda.total_com_iva.toLocaleString('pt-PT', {
                                    minimumFractionDigits: 2,
                                  })}
                                  €
                                </p>
                                <p className="text-sm text-gray-600">com IVA</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ABA: QUILOMETRAGEM & VISITAS */}
              {abaAtiva === 'km' && (
                <div className="space-y-6">
                  {/* Quilometragem */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900">Quilometragem</h3>
                      <button
                        onClick={abrirModalAdicionarKm}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar KM
                      </button>
                    </div>

                    <div className="space-y-2">
                      {kmDoVendedor.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p>Nenhum registro de quilometragem</p>
                        </div>
                      ) : (
                        kmDoVendedor.map((km) => (
                          <div
                            key={km.id}
                            className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <MapPin className="w-5 h-5 text-gray-400" />
                              <div>
                                <p className="font-medium text-gray-900">
                                  {new Date(km.data).toLocaleDateString('pt-PT')}
                                </p>
                                <p className="text-sm text-gray-600">{km.km} km</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-blue-600">
                                {km.valor.toLocaleString('pt-PT', {
                                  minimumFractionDigits: 2,
                                })}
                                €
                              </p>
                              <button
                                onClick={() => abrirModalEditarKm(km)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => excluirKm(km.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Visitas */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900">Visitas</h3>
                      <button
                        onClick={abrirModalAdicionarVisita}
                        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar Visita
                      </button>
                    </div>

                    <div className="space-y-2">
                      {visitasDoVendedor.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p>Nenhuma visita registrada</p>
                        </div>
                      ) : (
                        visitasDoVendedor.map((visita) => {
                          const cliente = clientes.find((c) => c.id === visita.cliente_id);

                          return (
                            <div
                              key={visita.id}
                              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <Calendar className="w-5 h-5 text-gray-400" />
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {cliente?.nome || 'Cliente não encontrado'}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    {new Date(visita.data_visita).toLocaleDateString('pt-PT')}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                    visita.estado === 'REALIZADA'
                                      ? 'bg-green-100 text-green-800'
                                      : visita.estado === 'PENDENTE'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {visita.estado}
                                </span>
                                <button
                                  onClick={() => abrirModalEditarVisita(visita)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Editar"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => excluirVisita(visita.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

{/* Modal Período do Relatório do Vendedor */}
{mostrarModalPeriodo && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Período do Relatório</h2>
          <button
            onClick={() => setMostrarModalPeriodo(false)}
            className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Opções de período */}
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              className="text-purple-600"
              checked={tipoPeriodoRelatorio === 'MES_ATUAL'}
              onChange={() => setTipoPeriodoRelatorio('MES_ATUAL')}
            />
            <span>Mês atual</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              className="text-purple-600"
              checked={tipoPeriodoRelatorio === 'ULTIMOS_30'}
              onChange={() => setTipoPeriodoRelatorio('ULTIMOS_30')}
            />
            <span>Últimos 30 dias</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              className="text-purple-600"
              checked={tipoPeriodoRelatorio === 'MES_ANTERIOR'}
              onChange={() => setTipoPeriodoRelatorio('MES_ANTERIOR')}
            />
            <span>Mês anterior</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              className="text-purple-600"
              checked={tipoPeriodoRelatorio === 'PERSONALIZADO'}
              onChange={() => setTipoPeriodoRelatorio('PERSONALIZADO')}
            />
            <span>Período personalizado</span>
          </label>
        </div>

        {/* Campos de datas – só aparecem no modo PERSONALIZADO */}
        {tipoPeriodoRelatorio === 'PERSONALIZADO' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data início
              </label>
              <input
                type="date"
                value={dataInicioRelatorio}
                onChange={(e) => setDataInicioRelatorio(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data fim
              </label>
              <input
                type="date"
                value={dataFimRelatorio}
                onChange={(e) => setDataFimRelatorio(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        )}

        {/* Botões */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={() => {
              setMostrarModalPeriodo(false);
            }}
            className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={async () => {
              // Validação simples para período personalizado
              if (
                tipoPeriodoRelatorio === 'PERSONALIZADO' &&
                (!dataInicioRelatorio || !dataFimRelatorio)
              ) {
                alert('Preencha as datas de início e fim.');
                return;
              }

              await gerarRelatorioMensal(); // usa o filtro escolhido
              setMostrarModalPeriodo(false);
            }}
            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
          >
            Gerar PDF
          </button>
        </div>
      </div>
    </div>
  </div>
)}

      
      {/* Modal Adicionar Cliente */}
      {modalAdicionarCliente && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Adicionar Cliente à Carteira</h2>
                <button
                  onClick={() => setModalAdicionarCliente(false)}
                  className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Busca */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Buscar cliente por nome ou localidade..."
                  value={buscaCliente}
                  onChange={(e) => setBuscaCliente(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Lista de Clientes Disponíveis */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {clientesDisponiveis.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhum cliente disponível</p>
                  </div>
                ) : (
                  clientesDisponiveis.map((cliente) => (
                    <div
                      key={cliente.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Building2 className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">{cliente.nome}</p>
                          <p className="text-sm text-gray-600">
                            {cliente.localidade || 'N/A'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => adicionarClienteAoVendedor(cliente.id)}
                        className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar KM */}
      {modalAdicionarKm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold">Adicionar Quilometragem</h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data</label>
                <input
                  type="date"
                  value={novaKm.data}
                  onChange={(e) => setNovaKm({ ...novaKm, data: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">KM Total</label>
                <input
                  type="number"
                  value={novaKm.km}
                  onChange={(e) => setNovaKm({ ...novaKm, km: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="120"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor Total (€)
                </label>
                <input
                  type="number"
                  value={valorCalculadoKm.toFixed(2)}
                  readOnly
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
                  placeholder="Calculado automaticamente"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Calculado automaticamente: {novaKm.km} km × {vendedorSelecionado?.custo_km.toFixed(2)}€/km
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={adicionarKm}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-all"
                >
                  Adicionar
                </button>
                <button
                  onClick={() => setModalAdicionarKm(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar KM */}
      {modalEditarKm && kmSelecionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold">Editar Quilometragem</h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data</label>
                <input
                  type="date"
                  value={novaKm.data}
                  onChange={(e) => setNovaKm({ ...novaKm, data: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">KM Total</label>
                <input
                  type="number"
                  value={novaKm.km}
                  onChange={(e) => setNovaKm({ ...novaKm, km: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor Total (€)
                </label>
                <input
                  type="number"
                  value={valorCalculadoKm.toFixed(2)}
                  readOnly
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
                  placeholder="Calculado automaticamente"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Calculado automaticamente: {novaKm.km} km × {vendedorSelecionado?.custo_km.toFixed(2)}€/km
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={salvarEdicaoKm}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-all"
                >
                  Salvar
                </button>
                <button
                  onClick={() => setModalEditarKm(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar Visita */}
      {modalAdicionarVisita && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold">Adicionar Visita</h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cliente</label>
                <select
                  value={novaVisita.cliente_id}
                  onChange={(e) =>
                    setNovaVisita({ ...novaVisita, cliente_id: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Selecione um cliente</option>
                  {clientesDoVendedor.map((cliente: any) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nome} - {cliente.localidade || 'N/A'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data</label>
                <input
                  type="date"
                  value={novaVisita.data_visita}
                  onChange={(e) =>
                    setNovaVisita({ ...novaVisita, data_visita: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
                <select
                  value={novaVisita.estado}
                  onChange={(e) => setNovaVisita({ ...novaVisita, estado: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="PENDENTE">Pendente</option>
                  <option value="REALIZADA">Realizada</option>
                  <option value="CANCELADA">Cancelada</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notas (opcional)
                </label>
                <textarea
                  value={novaVisita.notas}
                  onChange={(e) => setNovaVisita({ ...novaVisita, notas: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  rows={3}
                  placeholder="Observações sobre a visita..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={adicionarVisita}
                  className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-all"
                >
                  Adicionar
                </button>
                <button
                  onClick={() => setModalAdicionarVisita(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Visita */}
      {modalEditarVisita && visitaSelecionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold">Editar Visita</h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cliente</label>
                <select
                  value={novaVisita.cliente_id}
                  onChange={(e) =>
                    setNovaVisita({ ...novaVisita, cliente_id: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Selecione um cliente</option>
                  {clientesDoVendedor.map((cliente: any) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nome} - {cliente.localidade || 'N/A'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data</label>
                <input
                  type="date"
                  value={novaVisita.data_visita}
                  onChange={(e) =>
                    setNovaVisita({ ...novaVisita, data_visita: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
                <select
                  value={novaVisita.estado}
                  onChange={(e) => setNovaVisita({ ...novaVisita, estado: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="PENDENTE">Pendente</option>
                  <option value="REALIZADA">Realizada</option>
                  <option value="CANCELADA">Cancelada</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notas (opcional)
                </label>
                <textarea
                  value={novaVisita.notas}
                  onChange={(e) => setNovaVisita({ ...novaVisita, notas: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  rows={3}
                  placeholder="Observações sobre a visita..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={salvarEdicaoVisita}
                  className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-all"
                >
                  Salvar
                </button>
                <button
                  onClick={() => setModalEditarVisita(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
