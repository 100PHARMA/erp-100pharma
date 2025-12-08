'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, Search, Eye, Edit, Trash2, 
  FileText, CheckCircle, X, ChevronRight,
  AlertCircle, TrendingUp, Package, Save
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/utils/formatCurrency';

// ======================================================================
// CONSTANTES
// ======================================================================

const TAXA_IVA = 0.23;

// por enquanto vamos usar valores padrão fixos
const PERCENTUAL_COMISSAO_VENDEDOR_PADRAO = 5;      // 5%
const INCENTIVO_FARMACIA_PADRAO = 0.28;             // € por frasco
const INCENTIVO_PODOLOGISTA_PADRAO = 1.0;           // € por frasco
const CUSTO_KM_PADRAO = 0.20;                       // € por km

// ======================================================================
// TIPOS
// ======================================================================

type EstadoVenda = 'ORCAMENTO' | 'ABERTA' | 'FECHADA' | 'CANCELADA';

interface Cliente {
  id: string;
  nome: string;
  tipo: string;
  nif: string;
  email: string;
  telefone: string;
  endereco?: string;
  cidade?: string;
  codigo_postal?: string;
}

interface Vendedor {
  id: string;
  nome: string;
  email: string;
}

interface Produto {
  id: string;
  nome: string;
  preco: number;
  estoque: number;
}

interface ItemVenda {
  id?: string;
  venda_id?: string;
  produto_id: string;
  produto?: Produto;
  quantidade: number;
  preco_unitario: number;
  total_linha: number;

  // Novos campos congelados por item (ainda não usados, mas já declarados)
  percentual_comissao_vendedor?: number;
  valor_comissao_vendedor?: number;
  incentivo_farmacia?: number;
  incentivo_podologista?: number;
  taxa_iva?: number;
}

interface Venda {
  id: string;
  numero: string;
  cliente_id: string;
  vendedor_id: string;
  data: string;
  estado: EstadoVenda;
  subtotal: number;
  iva: number;
  total_com_iva: number;
  observacoes: string;
  created_at: string;
  updated_at: string;

  // Novos campos congelados por venda
  taxa_iva?: number;
  percentual_comissao_vendedor?: number;
  valor_total_comissao?: number;
  incentivo_farmacia_total?: number;
  incentivo_podologista_total?: number;
  meta_mensal_vendedor_no_momento?: number;
  custo_km_no_momento?: number;

  // Relacionamentos
  clientes?: Cliente;
  vendedores?: Vendedor;
  venda_itens?: ItemVenda[];
}

// ======================================================================
// COMPONENTE PRINCIPAL
// ======================================================================

export default function VendasPage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  
  // Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [vendaEditando, setVendaEditando] = useState<Venda | null>(null);
  const [etapaAtual, setEtapaAtual] = useState(1);
  
  // Formulário
  const [clienteSelecionado, setClienteSelecionado] = useState('');
  const [vendedorSelecionado, setVendedorSelecionado] = useState('');
  const [dataVenda, setDataVenda] = useState(new Date().toISOString().split('T')[0]);
  const [observacoes, setObservacoesVenda] = useState('');
  const [itensVenda, setItensVenda] = useState<ItemVenda[]>([]);
  
  // Item sendo adicionado
  const [produtoSelecionado, setProdutoSelecionado] = useState('');
  const [quantidade, setQuantidade] = useState(1);
  
  // Filtros
  const [filtroEstado, setFiltroEstado] = useState<EstadoVenda | 'TODOS'>('TODOS');
  const [busca, setBusca] = useState('');

  // ======================================================================
  // CARREGAMENTO INICIAL
  // ======================================================================

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setCarregando(true);
      
      // Carregar vendas com relacionamentos
      const { data: vendasData, error: vendasError } = await supabase
        .from('vendas')
        .select(`
          *,
          clientes (id, nome, tipo, nif, email, telefone, endereco, cidade, codigo_postal),
          vendedores (id, nome, email),
          venda_itens (
            id,
            produto_id,
            quantidade,
            preco_unitario,
            total_linha,
            produtos (id, nome, preco, estoque)
          )
        `)
        .order('created_at', { ascending: false });

      if (vendasError) throw vendasError;
      setVendas(vendasData || []);

      // Carregar clientes
      const { data: clientesData, error: clientesError } = await supabase
        .from('clientes')
        .select('*')
        .order('nome');

      if (clientesError) throw clientesError;
      setClientes(clientesData || []);

      // Carregar vendedores
      const { data: vendedoresData, error: vendedoresError } = await supabase
        .from('vendedores')
        .select('*')
        .order('nome');

      if (vendedoresError) throw vendedoresError;
      setVendedores(vendedoresData || []);

      // Carregar produtos
      const { data: produtosData, error: produtosError } = await supabase
        .from('produtos')
        .select('*')
        .order('nome');

      if (produtosError) throw produtosError;
      setProdutos(produtosData || []);

    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      alert('Erro ao carregar dados: ' + error.message);
    } finally {
      setCarregando(false);
    }
  };

  // ======================================================================
  // CÁLCULOS
  // ======================================================================

  const calcularTotais = (itens: ItemVenda[]) => {
    const subtotal = itens.reduce((acc, item) => acc + item.total_linha, 0);
    const iva = subtotal * TAXA_IVA;
    const total_com_iva = subtotal + iva;
    return { subtotal, iva, total_com_iva };
  };

  // ======================================================================
  // GERENCIAMENTO DE ITENS
  // ======================================================================

  const adicionarItem = () => {
    if (!produtoSelecionado || quantidade <= 0) {
      alert('Selecione um produto e quantidade válida');
      return;
    }

    const produto = produtos.find(p => p.id === produtoSelecionado);
    if (!produto) return;

    const total_linha = produto.preco * quantidade;

    const novoItem: ItemVenda = {
      produto_id: produto.id,
      produto,
      quantidade,
      preco_unitario: produto.preco,
      total_linha
    };

    setItensVenda([...itensVenda, novoItem]);
    setProdutoSelecionado('');
    setQuantidade(1);
  };

  const removerItem = (index: number) => {
    setItensVenda(itensVenda.filter((_, i) => i !== index));
  };

  // ======================================================================
  // META MENSAL DO VENDEDOR
  // ======================================================================

  const obterMetaMensalDoVendedor = async (
    vendedorId: string,
    dataVendaISO: string
  ): Promise<number> => {
    const data = new Date(dataVendaISO);
    const ano = data.getFullYear();
    const mes = data.getMonth() + 1;

    try {
      // Tenta meta específica do vendedor para ano/mês
      const { data: metasEspecificas, error: metaError } = await supabase
        .from('vendedor_metas_mensais')
        .select('meta_mensal')
        .eq('vendedor_id', vendedorId)
        .eq('ano', ano)
        .eq('mes', mes)
        .limit(1);

      if (metaError) {
        console.error('Erro ao buscar meta específica do vendedor:', metaError);
      }

      if (
        metasEspecificas &&
        metasEspecificas.length > 0 &&
        metasEspecificas[0].meta_mensal != null
      ) {
        return Number(metasEspecificas[0].meta_mensal);
      }

      // Caso não exista meta específica, busca configuração global
      const { data: configRows, error: configError } = await supabase
        .from('configuracoes_financeiras')
        .select('meta_mensal_vendedor')
        .limit(1);

      if (configError) {
        console.error('Erro ao buscar configuração financeira:', configError);
        return 0;
      }

      const config = configRows?.[0];
      return Number(config?.meta_mensal_vendedor ?? 0);
    } catch (e) {
      console.error('Erro inesperado ao obter meta mensal do vendedor:', e);
      return 0;
    }
  };

    // ======================================================================
   // SALVAR VENDA (SEMPRE COMO ABERTA)
   // ======================================================================

  const salvarVenda = async () => {
    try {
      if (!clienteSelecionado || !vendedorSelecionado) {
        alert('Selecione cliente e vendedor');
        return;
      }

      if (itensVenda.length === 0) {
        alert('Adicione pelo menos um produto');
        return;
      }

      setCarregando(true);

      // Totais da venda
      const totais = calcularTotais(itensVenda);

      const percentualComissao = PERCENTUAL_COMISSAO_VENDEDOR_PADRAO;
      // Comissão deve ser calculada sobre o valor SEM IVA
      const valorComissao = totais.subtotal * (percentualComissao / 100);

      // Total de unidades (frascos)
      const totalFrascos = itensVenda.reduce(
        (acc, item) => acc + item.quantidade,
        0
      );

      const incentivoFarmaciaTotal =
        totalFrascos * INCENTIVO_FARMACIA_PADRAO;

      const incentivoPodologistaTotal =
        totalFrascos * INCENTIVO_PODOLOGISTA_PADRAO;

      // Meta mensal do vendedor congelada no momento
      const metaMensalVendedor = await obterMetaMensalDoVendedor(
        vendedorSelecionado,
        dataVenda
      );

      // Buscar podologista associado à farmácia (cliente) no momento da venda
      const { data: relacao, error: relacaoErro } = await supabase
        .from('podologista_farmacia')
        .select('podologista_id')
        .eq('farmacia_id', clienteSelecionado)
        .maybeSingle(); // assumindo 1 podologista ativo por farmácia

      if (relacaoErro) throw relacaoErro;

      const podologistaId = relacao?.podologista_id ?? null;


      if (vendaEditando) {
        // ============================================================
        // ATUALIZAR VENDA EXISTENTE - SEMPRE COMO ABERTA
        // ============================================================

        const { error: vendaError } = await supabase
          .from('vendas')
          .update({
            cliente_id: clienteSelecionado,
            vendedor_id: vendedorSelecionado,
            data: dataVenda,
            estado: 'ABERTA',
            subtotal: totais.subtotal,
            iva: totais.iva,
            total_com_iva: totais.total_com_iva,
            observacoes,

            // campos congelados
            taxa_iva: TAXA_IVA,
            percentual_comissao_vendedor: percentualComissao,
            valor_total_comissao: valorComissao,
            incentivo_farmacia_total: incentivoFarmaciaTotal,
            incentivo_podologista_total: incentivoPodologistaTotal,
            meta_mensal_vendedor_no_momento: metaMensalVendedor,
            custo_km_no_momento: CUSTO_KM_PADRAO,

            updated_at: new Date().toISOString()
          })
          .eq('id', vendaEditando.id);

        if (vendaError) throw vendaError;

        // Deletar itens antigos
        const { error: deleteError } = await supabase
          .from('venda_itens')
          .delete()
          .eq('venda_id', vendaEditando.id);

        if (deleteError) throw deleteError;

        // Inserir novos itens (IVA + podologista congelados por linha)
        const itensParaInserir = itensVenda.map(item => ({
          venda_id: vendaEditando.id,
          produto_id: item.produto_id,
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
          total_linha: item.total_linha,
          taxa_iva: TAXA_IVA,
          incentivo_podologista: INCENTIVO_PODOLOGISTA_PADRAO,
          podologista_id: podologistaId
        }));

        const { error: itensError } = await supabase
          .from('venda_itens')
          .insert(itensParaInserir);

        if (itensError) throw itensError;

        alert('Venda atualizada com sucesso!');
      } else {
        // ============================================================
        // CRIAR NOVA VENDA - SEMPRE COMO ABERTA
        // ============================================================

        const numeroVenda = `VD${Date.now()}`;

        const { data: vendaData, error: vendaError } = await supabase
          .from('vendas')
          .insert({
            numero: numeroVenda,
            cliente_id: clienteSelecionado,
            vendedor_id: vendedorSelecionado,
            data: dataVenda,
            estado: 'ABERTA',
            subtotal: totais.subtotal,
            iva: totais.iva,
            total_com_iva: totais.total_com_iva,
            observacoes,

            // campos congelados
            taxa_iva: TAXA_IVA,
            percentual_comissao_vendedor: percentualComissao,
            valor_total_comissao: valorComissao,
            incentivo_farmacia_total: incentivoFarmaciaTotal,
            incentivo_podologista_total: incentivoPodologistaTotal,
            meta_mensal_vendedor_no_momento: metaMensalVendedor,
            custo_km_no_momento: CUSTO_KM_PADRAO
          })
          .select()
          .single();

        if (vendaError) throw vendaError;

        // Inserir itens (IVA + podologista congelados por linha)
        const itensParaInserir = itensVenda.map(item => ({
          venda_id: vendaData.id,
          produto_id: item.produto_id,
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
          total_linha: item.total_linha,
          taxa_iva: TAXA_IVA,
          incentivo_podologista: INCENTIVO_PODOLOGISTA_PADRAO,
          podologista_id: podologistaId
        }));

        const { error: itensError } = await supabase
          .from('venda_itens')
          .insert(itensParaInserir);

        if (itensError) throw itensError;

        alert('Venda criada com sucesso!');
      }

      fecharModal();
      await carregarDados();
    } catch (error: any) {
      console.error('Erro ao salvar venda:', error);
      alert('Erro ao salvar venda: ' + error.message);
    } finally {
      setCarregando(false);
    }
  };

  // ======================================================================
  // DELETAR VENDA
  // ======================================================================

  const deletarVenda = async (vendaId: string) => {
    if (!confirm('Tem certeza que deseja deletar esta venda?')) return;

    try {
      // Deletar itens primeiro
      const { error: itensError } = await supabase
        .from('venda_itens')
        .delete()
        .eq('venda_id', vendaId);

      if (itensError) throw itensError;

      // Deletar venda
      const { error: vendaError } = await supabase
        .from('vendas')
        .delete()
        .eq('id', vendaId);

      if (vendaError) throw vendaError;

      alert('Venda deletada com sucesso!');
      carregarDados();
    } catch (error: any) {
      console.error('Erro ao deletar venda:', error);
      alert('Erro ao deletar venda: ' + error.message);
    }
  };

  // ======================================================================
  // MODAL
  // ======================================================================

  const abrirModalNovo = () => {
    setVendaEditando(null);
    setClienteSelecionado('');
    setVendedorSelecionado('');
    setDataVenda(new Date().toISOString().split('T')[0]);
    setObservacoesVenda('');
    setItensVenda([]);
    setEtapaAtual(1);
    setModalAberto(true);
  };

  const abrirModalEditar = async (venda: Venda) => {
    try {
      setVendaEditando(venda);
      setClienteSelecionado(venda.cliente_id);
      setVendedorSelecionado(venda.vendedor_id);
      setDataVenda(venda.data);
      setObservacoesVenda(venda.observacoes || '');
      
      // Carregar itens da venda
      const { data: itensData, error: itensError } = await supabase
        .from('venda_itens')
        .select(`
          id,
          produto_id,
          quantidade,
          preco_unitario,
          total_linha,
          produtos (id, nome, preco, estoque)
        `)
        .eq('venda_id', venda.id);

      if (itensError) throw itensError;

      const itens: ItemVenda[] = (itensData || []).map((item: any) => {
        const produtoData = Array.isArray(item.produtos) ? item.produtos[0] : item.produtos;
        
        return {
          id: item.id,
          venda_id: venda.id,
          produto_id: item.produto_id,
          produto: produtoData ? {
            id: produtoData.id,
            nome: produtoData.nome,
            preco: produtoData.preco,
            estoque: produtoData.estoque
          } : undefined,
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
          total_linha: item.total_linha
        };
      });
      
      setItensVenda(itens);
      setEtapaAtual(1);
      setModalAberto(true);
      
    } catch (error: any) {
      console.error('Erro ao abrir modal de edição:', error);
      alert('Erro ao carregar dados da venda: ' + error.message);
    }
  };

  const fecharModal = () => {
    setModalAberto(false);
    setVendaEditando(null);
  };

  const proximaEtapa = () => {
    if (etapaAtual === 1 && !clienteSelecionado) {
      alert('Selecione um cliente');
      return;
    }
    if (etapaAtual === 1 && !vendedorSelecionado) {
      alert('Selecione um vendedor');
      return;
    }
    if (etapaAtual === 2 && itensVenda.length === 0) {
      alert('Adicione pelo menos um produto');
      return;
    }
    
    setEtapaAtual(etapaAtual + 1);
  };

  const etapaAnterior = () => {
    setEtapaAtual(etapaAtual - 1);
  };

  // ======================================================================
  // FILTROS
  // ======================================================================

  const vendasFiltradas = vendas.filter(venda => {
    const matchEstado = filtroEstado === 'TODOS' || venda.estado === filtroEstado;
    const matchBusca = !busca || 
      venda.numero.toLowerCase().includes(busca.toLowerCase()) ||
      venda.clientes?.nome.toLowerCase().includes(busca.toLowerCase());
    return matchEstado && matchBusca;
  });

  // ======================================================================
  // ESTATÍSTICAS
  // ======================================================================

  const totalVendas = vendas.length;
  const vendasFechadas = vendas.filter(v => v.estado === 'FECHADA').length;
  const vendasAbertas = vendas.filter(v => v.estado === 'ABERTA').length;
  const totalFaturado = vendas
    .filter(v => v.estado === 'FECHADA')
    .reduce((acc, v) => acc + v.total_com_iva, 0);

  // ======================================================================
  // RENDERIZAÇÃO
  // ======================================================================

  if (carregando) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando vendas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                Gestão de Vendas
              </h1>
              <p className="text-gray-600">Orçamentos, vendas abertas e fechadas</p>
            </div>
            <button
              onClick={abrirModalNovo}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 flex items-center gap-2 hover:scale-105"
            >
              <Plus className="w-5 h-5" />
              Nova Venda
            </button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-3 rounded-lg">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Vendas</p>
                  <p className="text-2xl font-bold text-blue-600">{totalVendas}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="bg-green-600 p-3 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Fechadas</p>
                  <p className="text-2xl font-bold text-green-600">{vendasFechadas}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="bg-orange-600 p-3 rounded-lg">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Abertas</p>
                  <p className="text-2xl font-bold text-orange-600">{vendasAbertas}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="bg-purple-600 p-3 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Faturado</p>
                  <p className="text-2xl font-bold text-purple-600">
                    €{totalFaturado.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar vendas..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as EstadoVenda | 'TODOS')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="TODOS">Todos os Estados</option>
              <option value="ORCAMENTO">Orçamento</option>
              <option value="ABERTA">Aberta</option>
              <option value="FECHADA">Fechada</option>
              <option value="CANCELADA">Cancelada</option>
            </select>
          </div>
        </div>

        {/* Lista de Vendas */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Número</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Cliente</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Vendedor</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Data</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold">Total</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold">Estado</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {vendasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                      <p className="text-lg font-semibold mb-2">Nenhuma venda encontrada</p>
                      <p className="text-sm">Clique em "Nova Venda" para começar</p>
                    </td>
                  </tr>
                ) : (
                  vendasFiltradas.map((venda) => (
                    <tr key={venda.id} className="hover:bg-blue-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {venda.numero}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {venda.clientes?.nome || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {venda.vendedores?.nome || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(venda.data).toLocaleDateString('pt-PT')}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                        €{venda.total_com_iva.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                          venda.estado === 'FECHADA' ? 'bg-green-100 text-green-800' :
                          venda.estado === 'ABERTA' ? 'bg-orange-100 text-orange-800' :
                          venda.estado === 'ORCAMENTO' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {venda.estado}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => router.push(`/vendas/${venda.id}`)}
                            className="p-2 hover:bg-blue-100 rounded-lg transition-colors" 
                            title="Ver Detalhes"
                          >
                            <Eye className="w-4 h-4 text-blue-600" />
                          </button>
                          
                          {venda.estado !== 'FECHADA' && (
                            <>
                              <button 
                                onClick={() => abrirModalEditar(venda)}
                                className="p-2 hover:bg-green-100 rounded-lg transition-colors" 
                                title="Editar"
                              >
                                <Edit className="w-4 h-4 text-green-600" />
                              </button>
                              
                              <button 
                                onClick={() => deletarVenda(venda.id)}
                                className="p-2 hover:bg-red-100 rounded-lg transition-colors" 
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Nova/Editar Venda */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header do Modal */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-2xl">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold">
                    {vendaEditando ? 'Editar Venda' : 'Nova Venda'}
                  </h2>
                  <p className="text-blue-100 text-sm mt-1">Etapa {etapaAtual} de 3</p>
                </div>
                <button
                  onClick={fecharModal}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Progress Bar */}
              <div className="mt-4 bg-white/20 rounded-full h-2">
                <div
                  className="bg-white h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(etapaAtual / 3) * 100}%` }}
                />
              </div>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6">
              {/* Etapa 1: Cliente, Vendedor e Data */}
              {etapaAtual === 1 && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">
                    Informações Básicas
                  </h3>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Cliente *
                    </label>
                    <select
                      value={clienteSelecionado}
                      onChange={(e) => setClienteSelecionado(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Selecione um cliente</option>
                      {clientes.map((cliente) => (
                        <option key={cliente.id} value={cliente.id}>
                          {cliente.nome} – {cliente.tipo}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Vendedor *
                    </label>
                    <select
                      value={vendedorSelecionado}
                      onChange={(e) => setVendedorSelecionado(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Selecione um vendedor</option>
                      {vendedores.map((vendedor) => (
                        <option key={vendedor.id} value={vendedor.id}>
                          {vendedor.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Data da Venda *
                    </label>
                    <input
                      type="date"
                      value={dataVenda}
                      onChange={(e) => setDataVenda(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Observações
                    </label>
                    <textarea
                      value={observacoes}
                      onChange={(e) => setObservacoesVenda(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Observações sobre a venda..."
                    />
                  </div>
                </div>
              )}

              {/* Etapa 2: Produtos */}
              {etapaAtual === 2 && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">
                    Produtos da Venda
                  </h3>

                  {/* Adicionar Produto */}
                  <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Produto
                        </label>
                        <select
                          value={produtoSelecionado}
                          onChange={(e) => setProdutoSelecionado(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Selecione um produto</option>
                          {produtos.map((produto) => (
                            <option key={produto.id} value={produto.id}>
                              {produto.nome} - €{produto.preco.toFixed(2)} (Estoque: {produto.estoque})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Quantidade
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={quantidade}
                          onChange={(e) => setQuantidade(parseInt(e.target.value) || 1)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <button
                      onClick={adicionarItem}
                      disabled={!produtoSelecionado || quantidade <= 0}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-5 h-5" />
                      Adicionar Item
                    </button>
                  </div>

                  {/* Lista de Itens */}
                  {itensVenda.length > 0 ? (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Produto</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Qtd</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Preço Unit.</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Total</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {itensVenda.map((item, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {item.produto?.nome || 'Produto'}
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-600">
                                {item.quantidade}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-gray-900">
                                €{item.preco_unitario.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                                €{item.total_linha.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => removerItem(index)}
                                  className="p-1 hover:bg-red-100 rounded transition-colors"
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">Nenhum item adicionado ainda</p>
                    </div>
                  )}
                </div>
              )}

              {/* Etapa 3: Resumo */}
              {etapaAtual === 3 && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">
                    Resumo da Venda
                  </h3>

                  {/* Totais */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Subtotal (sem IVA)</p>
                        <p className="text-2xl font-bold text-gray-900">
                          €{calcularTotais(itensVenda).subtotal.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">IVA (23%)</p>
                        <p className="text-2xl font-bold text-gray-900">
                          €{calcularTotais(itensVenda).iva.toFixed(2)}
                        </p>
                      </div>
                      <div className="col-span-2 border-t border-blue-300 pt-4 mt-2">
                        <p className="text-sm text-gray-600">Total com IVA</p>
                        <p className="text-4xl font-bold text-blue-600">
                          €{calcularTotais(itensVenda).total_com_iva.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Informações */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Cliente:</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {clientes.find(c => c.id === clienteSelecionado)?.nome}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Vendedor:</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {vendedores.find(v => v.id === vendedorSelecionado)?.nome}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Data:</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {new Date(dataVenda).toLocaleDateString('pt-PT')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Total de Itens:</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {itensVenda.length}
                      </span>
                    </div>
                  </div>

                  {/* Aviso */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-blue-800">
                          Venda será salva como ABERTA
                        </p>
                        <p className="text-xs text-blue-700 mt-1">
                          Para fechar a venda e emitir fatura, acesse a página de detalhes após salvar.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Botão Salvar */}
                  <button
                    onClick={salvarVenda}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    {vendaEditando ? 'Atualizar Venda' : 'Salvar Venda'}
                  </button>
                </div>
              )}
            </div>

            {/* Footer com Navegação */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 rounded-b-2xl">
              <div className="flex justify-between">
                <button
                  onClick={etapaAnterior}
                  disabled={etapaAtual === 1}
                  className="px-6 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Anterior
                </button>

                {etapaAtual < 3 && (
                  <button
                    onClick={proximaEtapa}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
                  >
                    Seguinte
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
