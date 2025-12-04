'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, Search, Eye, Edit, Trash2, 
  FileText, CheckCircle, X, ChevronRight,
  AlertCircle, TrendingUp, Package, Calendar, Save, XCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { finalizarVendaECriarFatura } from './actions';
import { useRouter } from 'next/navigation';

// ======================================================================
// CONSTANTES
// ======================================================================

const TAXA_IVA = 0.23;

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
  const [estadoVenda, setEstadoVenda] = useState<EstadoVenda>('ORCAMENTO');
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

      // Carregar clientes REAIS do Supabase
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
  // SALVAR VENDA
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

      const totais = calcularTotais(itensVenda);

      if (vendaEditando) {
        // Atualizar venda existente
        const { error: vendaError } = await supabase
          .from('vendas')
          .update({
            cliente_id: clienteSelecionado,
            vendedor_id: vendedorSelecionado,
            data: dataVenda,
            estado: estadoVenda,
            subtotal: totais.subtotal,
            iva: totais.iva,
            total_com_iva: totais.total_com_iva,
            observacoes,
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

        // Inserir novos itens
        const itensParaInserir = itensVenda.map(item => ({
          venda_id: vendaEditando.id,
          produto_id: item.produto_id,
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
          total_linha: item.total_linha
        }));

        const { error: itensError } = await supabase
          .from('venda_itens')
          .insert(itensParaInserir);

        if (itensError) throw itensError;

        alert('Venda atualizada com sucesso!');
      } else {
        // Criar nova venda
        const numeroVenda = `VD${Date.now()}`;

        const { data: vendaData, error: vendaError } = await supabase
          .from('vendas')
          .insert({
            numero: numeroVenda,
            cliente_id: clienteSelecionado,
            vendedor_id: vendedorSelecionado,
            data: dataVenda,
            estado: estadoVenda,
            subtotal: totais.subtotal,
            iva: totais.iva,
            total_com_iva: totais.total_com_iva,
            observacoes
          })
          .select()
          .single();

        if (vendaError) throw vendaError;

        // Inserir itens
        const itensParaInserir = itensVenda.map(item => ({
          venda_id: vendaData.id,
          produto_id: item.produto_id,
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
          total_linha: item.total_linha
        }));

        const { error: itensError } = await supabase
          .from('venda_itens')
          .insert(itensParaInserir);

        if (itensError) throw itensError;

        alert('Venda criada com sucesso!');
      }

      fecharModal();
      carregarDados();
    } catch (error: any) {
      console.error('Erro ao salvar venda:', error);
      alert('Erro ao salvar venda: ' + error.message);
    }
  };

  // ======================================================================
  // MUDAR ESTADO DA VENDA
  // ======================================================================

  const mudarEstadoVenda = async (vendaId: string, novoEstado: EstadoVenda) => {
    try {
      const { error } = await supabase
        .from('vendas')
        .update({ 
          estado: novoEstado,
          updated_at: new Date().toISOString()
        })
        .eq('id', vendaId);

      if (error) throw error;

      alert(`Venda alterada para ${novoEstado}`);
      carregarDados();
    } catch (error: any) {
      console.error('Erro ao mudar estado:', error);
      alert('Erro ao mudar estado: ' + error.message);
    }
  };

  // ======================================================================
  // FECHAR VENDA E CRIAR FATURA
  // ======================================================================

  const fecharVendaECriarFatura = async (vendaId: string) => {
    if (!confirm('Deseja fechar esta venda e criar a fatura automaticamente?')) {
      return;
    }

    try {
      setCarregando(true);
      
      console.log('🔄 Finalizando venda e criando fatura...');
      const resultado = await finalizarVendaECriarFatura(vendaId);

      if (!resultado.success) {
        alert(`Erro ao finalizar venda: ${resultado.error}`);
        return;
      }

      alert('✅ Venda fechada e fatura criada com sucesso!');
      
      // Recarregar dados
      await carregarDados();

      // Redirecionar para a página de detalhes da fatura
      if (resultado.faturaId) {
        router.push(`/faturas/${resultado.faturaId}`);
      } else {
        // Se não tiver ID, redirecionar para listagem de faturas
        router.push('/faturas');
      }

    } catch (error: any) {
      console.error('❌ Erro ao processar venda:', error);
      alert('Erro ao processar venda: ' + error.message);
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
    setEstadoVenda('ORCAMENTO');
    setObservacoesVenda('');
    setItensVenda([]);
    setEtapaAtual(1);
    setModalAberto(true);
  };

  const abrirModalEditar = async (venda: Venda) => {
    try {
      console.log('🔍 Abrindo modal de edição para venda:', venda.id);
      
      setVendaEditando(venda);
      setClienteSelecionado(venda.cliente_id);
      setVendedorSelecionado(venda.vendedor_id);
      setDataVenda(venda.data);
      setEstadoVenda(venda.estado);
      setObservacoesVenda(venda.observacoes || '');
      
      // Carregar itens da venda com produtos
      console.log('📦 Buscando itens da venda no Supabase...');
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

      if (itensError) {
        console.error('❌ Erro ao carregar itens:', itensError);
        throw itensError;
      }

      console.log('✅ Itens carregados do Supabase:', itensData);
      console.log('📊 Quantidade de itens:', itensData?.length || 0);

      // Mapear itens para o formato correto
      const itens: ItemVenda[] = (itensData || []).map((item: any) => {
        console.log('🔄 Mapeando item:', item);
        
        // O Supabase retorna o relacionamento como um objeto ou array
        // Precisamos garantir que pegamos o primeiro elemento se for array
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

      console.log('✅ Itens mapeados para o estado:', itens);
      console.log('📊 Total de itens mapeados:', itens.length);
      
      setItensVenda(itens);
      
      setEtapaAtual(1);
      setModalAberto(true);
      
      console.log('✅ Modal aberto com sucesso!');
    } catch (error: any) {
      console.error('❌ Erro ao abrir modal de edição:', error);
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
    
    console.log(`📍 Avançando da etapa ${etapaAtual} para ${etapaAtual + 1}`);
    console.log(`📦 Itens no estado ao avançar:`, itensVenda);
    
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
                  <th className="px-6 py-4 text-right text-sm font-semibold">Subtotal</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold">IVA</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold">Total</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold">Estado</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {vendasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
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
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        €{venda.subtotal.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-600">
                        €{venda.iva.toFixed(2)}
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
                            onClick={() => abrirModalEditar(venda)}
                            className="p-2 hover:bg-green-100 rounded-lg transition-colors" 
                            title="Editar"
                          >
                            <Edit className="w-4 h-4 text-green-600" />
                          </button>
                          
                          {venda.estado !== 'FECHADA' && venda.estado !== 'CANCELADA' && (
                            <button 
                              onClick={() => fecharVendaECriarFatura(venda.id)}
                              className="p-2 hover:bg-blue-100 rounded-lg transition-colors" 
                              title="Fechar Venda e Criar Fatura"
                            >
                              <CheckCircle className="w-4 h-4 text-blue-600" />
                            </button>
                          )}
                          
                          {venda.estado !== 'CANCELADA' && (
                            <button 
                              onClick={() => mudarEstadoVenda(venda.id, 'CANCELADA')}
                              className="p-2 hover:bg-yellow-100 rounded-lg transition-colors" 
                              title="Cancelar"
                            >
                              <XCircle className="w-4 h-4 text-yellow-600" />
                            </button>
                          )}
                          
                          {venda.estado !== 'FECHADA' && (
                            <button 
                              onClick={() => deletarVenda(venda.id)}
                              className="p-2 hover:bg-red-100 rounded-lg transition-colors" 
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
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

                  <div className="grid grid-cols-2 gap-4">
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
                        Estado *
                      </label>
                      <select
                        value={estadoVenda}
                        onChange={(e) => setEstadoVenda(e.target.value as EstadoVenda)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="ORCAMENTO">Orçamento</option>
                        <option value="ABERTA">Aberta</option>
                        <option value="FECHADA">Fechada</option>
                        <option value="CANCELADA">Cancelada</option>
                      </select>
                    </div>
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

                  {/* Debug Info */}
                  {vendaEditando && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <p className="text-sm text-blue-800">
                        <strong>Debug:</strong> Editando venda {vendaEditando.numero} | 
                        Itens carregados: {itensVenda.length}
                      </p>
                    </div>
                  )}

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
                      <span className="text-sm text-gray-600">Tipo de Cliente:</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {clientes.find(c => c.id === clienteSelecionado)?.tipo}
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
                      <span className="text-sm text-gray-600">Estado:</span>
                      <span className={`text-sm font-semibold ${
                        estadoVenda === 'FECHADA' ? 'text-green-600' :
                        estadoVenda === 'ABERTA' ? 'text-orange-600' :
                        estadoVenda === 'ORCAMENTO' ? 'text-blue-600' :
                        'text-gray-600'
                      }`}>
                        {estadoVenda}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Total de Itens:</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {itensVenda.length}
                      </span>
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
