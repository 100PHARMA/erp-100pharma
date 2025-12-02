'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Eye, Search, Calendar, Package, AlertCircle } from 'lucide-react';

interface Fornecedor {
  id: string;
  nome: string;
}

interface Produto {
  id: string;
  nome: string;
  preco: number;
}

interface ItemCompra {
  id: string;
  produto_id: string;
  produto_nome?: string;
  quantidade: number;
  custo_unitario: number;
  taxa_iva: number;
  subtotal: number;
  iva: number;
  total_com_iva: number;
}

interface Compra {
  id: string;
  numero: string;
  fornecedor_id: string;
  fornecedor_nome?: string;
  data_compra: string;
  numero_documento: string;
  subtotal: number;
  iva_total: number;
  total_com_iva: number;
  frete: number;
  estado: string;
  observacoes: string;
}

export default function ComprasPage() {
  const [compras, setCompras] = useState<Compra[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalDetalhes, setModalDetalhes] = useState(false);
  const [compraDetalhes, setCompraDetalhes] = useState<Compra | null>(null);
  const [itensDetalhes, setItensDetalhes] = useState<ItemCompra[]>([]);
  const [salvando, setSalvando] = useState(false);

  // Filtros
  const [filtroFornecedor, setFiltroFornecedor] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');

  // Formulário
  const [fornecedorId, setFornecedorId] = useState('');
  const [dataCompra, setDataCompra] = useState(new Date().toISOString().split('T')[0]);
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [frete, setFrete] = useState(0);
  const [observacoes, setObservacoes] = useState('');
  const [itens, setItens] = useState<ItemCompra[]>([]);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      setErro(null);

      // Carregar fornecedores
      const { data: fornData, error: fornError } = await supabase
        .from('fornecedores')
        .select('id, nome')
        .eq('status', 'ATIVO')
        .order('nome');
      
      if (fornError) {
        console.error('Erro ao carregar fornecedores:', fornError);
        throw new Error(`Erro ao carregar fornecedores: ${fornError.message}`);
      }
      
      setFornecedores(fornData || []);

      // Carregar produtos
      const { data: prodData, error: prodError } = await supabase
        .from('produtos')
        .select('id, nome, preco')
        .eq('ativo', true)
        .order('nome');
      
      if (prodError) {
        console.error('Erro ao carregar produtos:', prodError);
        throw new Error(`Erro ao carregar produtos: ${prodError.message}`);
      }
      
      setProdutos(prodData || []);

      // Carregar compras
      await carregarCompras();
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      
      // Mensagens de erro mais específicas
      if (error.message?.includes('Failed to fetch')) {
        setErro('Não foi possível conectar ao banco de dados. Verifique se as variáveis de ambiente do Supabase estão configuradas corretamente.');
      } else if (error.message?.includes('JWT') || error.message?.includes('apikey')) {
        setErro('Erro de autenticação. Verifique se a chave de API do Supabase está correta.');
      } else if (error.message?.includes('policy')) {
        setErro('Acesso negado. Verifique as políticas de segurança (RLS) no Supabase.');
      } else {
        setErro(error.message || 'Erro ao carregar dados. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const carregarCompras = async () => {
    try {
      // Buscar compras
      const { data: comprasData, error: comprasError } = await supabase
        .from('compras')
        .select('*')
        .order('data_compra', { ascending: false });

      if (comprasError) {
        console.error('Erro ao carregar compras:', comprasError);
        throw comprasError;
      }

      // Buscar fornecedores
      const { data: fornecedoresData, error: fornError } = await supabase
        .from('fornecedores')
        .select('id, nome');

      if (fornError) {
        console.error('Erro ao carregar fornecedores para compras:', fornError);
        throw fornError;
      }

      // Criar mapa de fornecedores
      const fornecedoresMap = new Map(
        (fornecedoresData || []).map(f => [f.id, f.nome])
      );

      // Combinar dados
      const comprasFormatadas = (comprasData || []).map((c: any) => ({
        ...c,
        fornecedor_nome: fornecedoresMap.get(c.fornecedor_id) || 'N/A'
      }));

      setCompras(comprasFormatadas);
    } catch (error: any) {
      console.error('Erro ao carregar compras:', error);
      throw error;
    }
  };

  const adicionarItem = () => {
    const novoItem: ItemCompra = {
      id: `temp-${Date.now()}`,
      produto_id: '',
      quantidade: 1,
      custo_unitario: 0,
      taxa_iva: 23,
      subtotal: 0,
      iva: 0,
      total_com_iva: 0
    };
    setItens([...itens, novoItem]);
  };

  const removerItem = (id: string) => {
    setItens(itens.filter(item => item.id !== id));
  };

  const atualizarItem = (id: string, campo: string, valor: any) => {
    setItens(itens.map(item => {
      if (item.id === id) {
        const itemAtualizado = { ...item, [campo]: valor };
        
        // Recalcular valores
        const quantidade = itemAtualizado.quantidade || 0;
        const custoUnitario = itemAtualizado.custo_unitario || 0;
        const taxaIva = itemAtualizado.taxa_iva || 0;
        
        itemAtualizado.subtotal = quantidade * custoUnitario;
        itemAtualizado.iva = itemAtualizado.subtotal * (taxaIva / 100);
        itemAtualizado.total_com_iva = itemAtualizado.subtotal + itemAtualizado.iva;
        
        return itemAtualizado;
      }
      return item;
    }));
  };

  const calcularTotais = () => {
    const subtotal = itens.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    const totalIva = itens.reduce((sum, item) => sum + (item.iva || 0), 0);
    const totalComIva = itens.reduce((sum, item) => sum + (item.total_com_iva || 0), 0);
    const totalGeral = totalComIva + (frete || 0);

    return { subtotal, totalIva, totalComIva, totalGeral };
  };

  const salvarCompra = async () => {
    try {
      // Validações
      if (!fornecedorId) {
        alert('Selecione um fornecedor');
        return;
      }

      if (itens.length === 0) {
        alert('Adicione pelo menos um item');
        return;
      }

      const itensInvalidos = itens.filter(item => !item.produto_id || item.quantidade <= 0);
      if (itensInvalidos.length > 0) {
        alert('Todos os itens devem ter produto e quantidade válida');
        return;
      }

      setSalvando(true);

      const totais = calcularTotais();

      // Gerar número único
      const numeroCompra = `COMP-${Date.now()}`;

      // Inserir compra
      const { data: compraData, error: compraError } = await supabase
        .from('compras')
        .insert({
          numero: numeroCompra,
          fornecedor_id: fornecedorId,
          data_compra: dataCompra,
          numero_documento: numeroDocumento || null,
          subtotal: totais.subtotal,
          iva_total: totais.totalIva,
          total_com_iva: totais.totalComIva,
          frete: frete || 0,
          estado: 'CONFIRMADA',
          observacoes: observacoes || null
        })
        .select()
        .single();

      if (compraError) {
        console.error('Erro ao inserir compra:', compraError);
        throw new Error(`Erro ao salvar compra: ${compraError.message}`);
      }

      const compraId = compraData.id;

      // Inserir itens
      const itensParaInserir = itens.map(item => ({
        compra_id: compraId,
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        custo_unitario: item.custo_unitario,
        taxa_iva: item.taxa_iva,
        subtotal: item.subtotal,
        iva: item.iva,
        total_com_iva: item.total_com_iva
      }));

      const { error: itensError } = await supabase
        .from('compra_itens')
        .insert(itensParaInserir);

      if (itensError) {
        console.error('Erro ao inserir itens:', itensError);
        throw new Error(`Erro ao salvar itens: ${itensError.message}`);
      }

      // Criar movimentações de estoque
      const movimentacoes = itens.map(item => ({
        produto_id: item.produto_id,
        tipo: 'entrada',
        quantidade: item.quantidade,
        custo_unitario: item.custo_unitario,
        referencia_id: compraId,
        referencia_tipo: 'compra',
        data: new Date(dataCompra).toISOString(),
        observacoes: `Compra ${numeroCompra}`
      }));

      const { error: movError } = await supabase
        .from('movimentacoes_estoque')
        .insert(movimentacoes);

      if (movError) {
        console.error('Erro ao criar movimentações:', movError);
        throw new Error(`Erro ao atualizar estoque: ${movError.message}`);
      }

      // Atualizar estoque dos produtos
      for (const item of itens) {
        const { data: produtoAtual, error: prodError } = await supabase
          .from('produtos')
          .select('estoque')
          .eq('id', item.produto_id)
          .single();

        if (prodError) {
          console.error('Erro ao buscar produto:', prodError);
          continue;
        }

        if (produtoAtual) {
          const { error: updateError } = await supabase
            .from('produtos')
            .update({ estoque: produtoAtual.estoque + item.quantidade })
            .eq('id', item.produto_id);

          if (updateError) {
            console.error('Erro ao atualizar estoque do produto:', updateError);
          }
        }
      }

      alert('Compra criada com sucesso!');
      fecharModal();
      carregarCompras();
    } catch (error: any) {
      console.error('Erro ao salvar compra:', error);
      alert(error.message || 'Erro ao salvar compra. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  const abrirModal = () => {
    setFornecedorId('');
    setDataCompra(new Date().toISOString().split('T')[0]);
    setNumeroDocumento('');
    setFrete(0);
    setObservacoes('');
    setItens([]);
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
  };

  const verDetalhes = async (compra: Compra) => {
    try {
      // Buscar itens da compra
      const { data: itensData, error: itensError } = await supabase
        .from('compra_itens')
        .select('*')
        .eq('compra_id', compra.id);

      if (itensError) {
        console.error('Erro ao carregar itens:', itensError);
        throw itensError;
      }

      // Buscar produtos
      const { data: produtosData, error: prodError } = await supabase
        .from('produtos')
        .select('id, nome');

      if (prodError) {
        console.error('Erro ao carregar produtos:', prodError);
        throw prodError;
      }

      // Criar mapa de produtos
      const produtosMap = new Map(
        (produtosData || []).map(p => [p.id, p.nome])
      );

      // Combinar dados
      const itensFormatados = (itensData || []).map((item: any) => ({
        ...item,
        produto_nome: produtosMap.get(item.produto_id) || 'N/A'
      }));

      setCompraDetalhes(compra);
      setItensDetalhes(itensFormatados);
      setModalDetalhes(true);
    } catch (error: any) {
      console.error('Erro ao carregar detalhes:', error);
      alert('Erro ao carregar detalhes da compra');
    }
  };

  const comprasFiltradas = compras.filter(compra => {
    if (filtroFornecedor && compra.fornecedor_id !== filtroFornecedor) return false;
    if (filtroDataInicio && compra.data_compra < filtroDataInicio) return false;
    if (filtroDataFim && compra.data_compra > filtroDataFim) return false;
    return true;
  });

  const totais = calcularTotais();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando dados...</p>
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-red-900 mb-2">Erro ao carregar dados</h3>
              <p className="text-red-700 mb-4">{erro}</p>
              <div className="space-y-2 text-sm text-red-600">
                <p><strong>Possíveis soluções:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Verifique se as variáveis de ambiente do Supabase estão configuradas</li>
                  <li>Confirme se o projeto Supabase está ativo e acessível</li>
                  <li>Verifique as políticas de segurança (RLS) nas tabelas do banco</li>
                  <li>Certifique-se de que as tabelas necessárias existem no banco</li>
                </ul>
              </div>
              <button
                onClick={carregarDados}
                className="mt-4 bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
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
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Compras</h1>
          <p className="text-gray-600 mt-1">Gerencie suas compras de fornecedores</p>
        </div>
        <button
          onClick={abrirModal}
          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all hover:scale-105"
        >
          <Plus className="w-5 h-5" />
          Nova Compra
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fornecedor
            </label>
            <select
              value={filtroFornecedor}
              onChange={(e) => setFiltroFornecedor(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todos</option>
              {fornecedores.map(f => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Início
            </label>
            <input
              type="date"
              value={filtroDataInicio}
              onChange={(e) => setFiltroDataInicio(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Fim
            </label>
            <input
              type="date"
              value={filtroDataFim}
              onChange={(e) => setFiltroDataFim(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Tabela de Compras */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Data</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Fornecedor</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Nº Doc</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Subtotal</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">IVA</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Total c/ IVA</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Frete</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Total Geral</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Estado</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {comprasFiltradas.map(compra => (
                <tr key={compra.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {new Date(compra.data_compra).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{compra.fornecedor_nome}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{compra.numero_documento || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right">
                    €{Number(compra.subtotal).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right">
                    €{Number(compra.iva_total).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right">
                    €{Number(compra.total_com_iva).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right">
                    €{Number(compra.frete || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">
                    €{(Number(compra.total_com_iva) + Number(compra.frete || 0)).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {compra.estado}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => verDetalhes(compra)}
                      className="text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nova Compra */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold text-gray-900">Nova Compra</h2>
            </div>

            <div className="p-8">
              {/* Cabeçalho da Compra */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fornecedor *
                  </label>
                  <select
                    value={fornecedorId}
                    onChange={(e) => setFornecedorId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Selecione...</option>
                    {fornecedores.map(f => (
                      <option key={f.id} value={f.id}>{f.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data da Compra *
                  </label>
                  <input
                    type="date"
                    value={dataCompra}
                    onChange={(e) => setDataCompra(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Número do Documento
                  </label>
                  <input
                    type="text"
                    value={numeroDocumento}
                    onChange={(e) => setNumeroDocumento(e.target.value)}
                    placeholder="Ex: NF-12345"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Frete (€)
                  </label>
                  <input
                    type="number"
                    value={frete}
                    onChange={(e) => setFrete(Number(e.target.value))}
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observações
                  </label>
                  <textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Itens da Compra */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Itens da Compra</h3>
                  <button
                    onClick={adicionarItem}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Item
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Produto</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Qtd</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Custo Unit.</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">IVA %</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Subtotal</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">IVA</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Total</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {itens.map(item => (
                        <tr key={item.id}>
                          <td className="px-4 py-3">
                            <select
                              value={item.produto_id}
                              onChange={(e) => atualizarItem(item.id, 'produto_id', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            >
                              <option value="">Selecione...</option>
                              {produtos.map(p => (
                                <option key={p.id} value={p.id}>{p.nome}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={item.quantidade}
                              onChange={(e) => atualizarItem(item.id, 'quantidade', Number(e.target.value))}
                              min="1"
                              className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm text-center"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={item.custo_unitario}
                              onChange={(e) => atualizarItem(item.id, 'custo_unitario', Number(e.target.value))}
                              step="0.01"
                              min="0"
                              className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm text-right"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={item.taxa_iva}
                              onChange={(e) => atualizarItem(item.id, 'taxa_iva', Number(e.target.value))}
                              step="0.01"
                              min="0"
                              max="100"
                              className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm text-center"
                            />
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">
                            €{item.subtotal.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">
                            €{item.iva.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                            €{item.total_com_iva.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => removerItem(item.id)}
                              className="text-red-600 hover:text-red-800 transition-colors"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Resumo Financeiro */}
              <div className="bg-gray-50 rounded-xl p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumo Financeiro</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal (sem IVA):</span>
                    <span className="font-semibold text-gray-900">€{totais.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total IVA:</span>
                    <span className="font-semibold text-gray-900">€{totais.totalIva.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total com IVA:</span>
                    <span className="font-semibold text-gray-900">€{totais.totalComIva.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Frete:</span>
                    <span className="font-semibold text-gray-900">€{(frete || 0).toFixed(2)}</span>
                  </div>
                  <div className="border-t border-gray-300 pt-2 mt-2">
                    <div className="flex justify-between text-lg">
                      <span className="font-bold text-gray-900">Total Geral:</span>
                      <span className="font-bold text-blue-600">€{totais.totalGeral.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-4">
                <button
                  onClick={fecharModal}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={salvarCompra}
                  disabled={salvando}
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {salvando ? 'Salvando...' : 'Salvar Compra'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalhes */}
      {modalDetalhes && compraDetalhes && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold text-gray-900">Detalhes da Compra</h2>
            </div>

            <div className="p-8">
              {/* Informações da Compra */}
              <div className="grid grid-cols-2 gap-6 mb-8">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Fornecedor</label>
                  <p className="text-lg font-semibold text-gray-900">{compraDetalhes.fornecedor_nome}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Data</label>
                  <p className="text-lg font-semibold text-gray-900">
                    {new Date(compraDetalhes.data_compra).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Nº Documento</label>
                  <p className="text-lg font-semibold text-gray-900">{compraDetalhes.numero_documento || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Estado</label>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    {compraDetalhes.estado}
                  </span>
                </div>
              </div>

              {/* Itens */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Itens da Compra</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Produto</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Qtd</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Custo Unit.</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">IVA %</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Subtotal</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">IVA</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {itensDetalhes.map(item => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 text-sm text-gray-900">{item.produto_nome}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-center">{item.quantidade}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">
                            €{Number(item.custo_unitario).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-center">
                            {Number(item.taxa_iva).toFixed(0)}%
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">
                            €{Number(item.subtotal).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">
                            €{Number(item.iva).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                            €{Number(item.total_com_iva).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totais */}
              <div className="bg-gray-50 rounded-xl p-6 mb-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal (sem IVA):</span>
                    <span className="font-semibold text-gray-900">€{Number(compraDetalhes.subtotal).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total IVA:</span>
                    <span className="font-semibold text-gray-900">€{Number(compraDetalhes.iva_total).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total com IVA:</span>
                    <span className="font-semibold text-gray-900">€{Number(compraDetalhes.total_com_iva).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Frete:</span>
                    <span className="font-semibold text-gray-900">€{Number(compraDetalhes.frete || 0).toFixed(2)}</span>
                  </div>
                  <div className="border-t border-gray-300 pt-2 mt-2">
                    <div className="flex justify-between text-lg">
                      <span className="font-bold text-gray-900">Total Geral:</span>
                      <span className="font-bold text-blue-600">
                        €{(Number(compraDetalhes.total_com_iva) + Number(compraDetalhes.frete || 0)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {compraDetalhes.observacoes && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-600 mb-2">Observações</label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-4 rounded-lg">{compraDetalhes.observacoes}</p>
                </div>
              )}

              <button
                onClick={() => setModalDetalhes(false)}
                className="w-full bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
