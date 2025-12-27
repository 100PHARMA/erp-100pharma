'use client';

import { useState, useMemo } from 'react';
import { RefreshCw, Plus, Search, TrendingUp, TrendingDown, Edit2, Calendar, Download, ArrowLeft, Filter } from 'lucide-react';
import { produtosMock, movimentacoesEstoqueMock } from '@/lib/data';
import { MovimentacaoEstoque } from '@/lib/types';
import Link from 'next/link';

export default function MovimentacoesPage() {
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoEstoque[]>(movimentacoesEstoqueMock || []);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'TODOS' | 'ENTRADA' | 'SAIDA' | 'AJUSTE'>('TODOS');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [formData, setFormData] = useState({
    produtoId: '',
    tipo: 'ENTRADA' as 'ENTRADA' | 'SAIDA' | 'AJUSTE',
    quantidade: '',
    motivo: '',
    observacoes: ''
  });

  // Filtrar movimentações
  const movimentacoesFiltradas = useMemo(() => {
    // Garantir que movimentacoes é sempre um array
    const movimentacoesArray = Array.isArray(movimentacoes) ? movimentacoes : [];
    
    return movimentacoesArray.filter(mov => {
      const matchSearch = mov.produtoNome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         mov.motivo?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchTipo = filtroTipo === 'TODOS' || mov.tipo === filtroTipo;
      
      let matchData = true;
      if (dataInicio && dataFim) {
        const dataMovimentacao = new Date(mov.dataMovimentacao);
        const inicio = new Date(dataInicio);
        const fim = new Date(dataFim);
        matchData = dataMovimentacao >= inicio && dataMovimentacao <= fim;
      }
      
      return matchSearch && matchTipo && matchData;
    });
  }, [movimentacoes, searchTerm, filtroTipo, dataInicio, dataFim]);

  // Estatísticas
  const stats = useMemo(() => {
    // Garantir que movimentacoes é sempre um array
    const movimentacoesArray = Array.isArray(movimentacoes) ? movimentacoes : [];
    
    const totalEntradas = movimentacoesArray
      .filter(m => m.tipo === 'ENTRADA')
      .reduce((acc, m) => acc + m.quantidade, 0);
    
    const totalSaidas = movimentacoesArray
      .filter(m => m.tipo === 'SAIDA')
      .reduce((acc, m) => acc + m.quantidade, 0);
    
    const totalAjustes = movimentacoesArray
      .filter(m => m.tipo === 'AJUSTE')
      .reduce((acc, m) => acc + Math.abs(m.quantidade), 0);

    return { totalEntradas, totalSaidas, totalAjustes };
  }, [movimentacoes]);

  // Abrir modal
  const abrirModal = () => {
    setFormData({
      produtoId: '',
      tipo: 'ENTRADA',
      quantidade: '',
      motivo: '',
      observacoes: ''
    });
    setModalAberto(true);
  };

  // Fechar modal
  const fecharModal = () => {
    setModalAberto(false);
  };

  // Salvar movimentação
  const salvarMovimentacao = () => {
    const produto = produtosMock.find(p => p.id === formData.produtoId);
    if (!produto) {
      alert('Produto não encontrado');
      return;
    }

    const quantidade = parseInt(formData.quantidade);
    let estoqueNovo = produto.estoque;

    if (formData.tipo === 'ENTRADA') {
      estoqueNovo = produto.estoque + quantidade;
    } else if (formData.tipo === 'SAIDA') {
      estoqueNovo = produto.estoque - quantidade;
    } else if (formData.tipo === 'AJUSTE') {
      estoqueNovo = quantidade; // No ajuste, substitui o valor
    }

    const novaMovimentacao: MovimentacaoEstoque = {
      id: Date.now().toString(),
      produtoId: formData.produtoId,
      produtoNome: produto.nome,
      tipo: formData.tipo,
      quantidade: formData.tipo === 'AJUSTE' ? estoqueNovo - produto.estoque : quantidade,
      estoqueAnterior: produto.estoque,
      estoqueNovo: estoqueNovo,
      motivo: formData.motivo,
      responsavel: 'Usuário Atual',
      dataMovimentacao: new Date(),
      observacoes: formData.observacoes
    };

    setMovimentacoes([novaMovimentacao, ...movimentacoes]);
    fecharModal();
  };

  // Exportar para CSV
  const exportarCSV = () => {
    const headers = ['Data', 'Produto', 'Tipo', 'Quantidade', 'Estoque Anterior', 'Estoque Novo', 'Motivo', 'Responsável'];
    const rows = movimentacoesFiltradas.map(mov => [
      new Date(mov.dataMovimentacao).toLocaleDateString('pt-PT'),
      mov.produtoNome,
      mov.tipo,
      mov.quantidade,
      mov.estoqueAnterior,
      mov.estoqueNovo,
      mov.motivo,
      mov.responsavel
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `movimentacoes_estoque_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Link 
            href="/produtos"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 flex items-center gap-3">
              <RefreshCw className="w-8 h-8 text-purple-600" />
              Movimentações de Estoque
            </h1>
            <p className="text-gray-600 text-sm sm:text-base mt-1">
              Controle de entradas, saídas e ajustes
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button 
            onClick={abrirModal}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 flex items-center gap-2 justify-center hover:scale-105"
          >
            <Plus className="w-5 h-5" />
            Nova Movimentação
          </button>
          <button 
            onClick={exportarCSV}
            className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 flex items-center gap-2 justify-center hover:scale-105"
          >
            <Download className="w-5 h-5" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-green-100 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Entradas</p>
              <p className="text-2xl font-bold text-green-600">{stats.totalEntradas}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-red-100 p-3 rounded-lg">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Saídas</p>
              <p className="text-2xl font-bold text-red-600">{stats.totalSaidas}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Edit2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Ajustes</p>
              <p className="text-2xl font-bold text-blue-600">{stats.totalAjustes}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Filtros</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar produto ou motivo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Filtro Tipo */}
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="TODOS">Todos os Tipos</option>
            <option value="ENTRADA">Entradas</option>
            <option value="SAIDA">Saídas</option>
            <option value="AJUSTE">Ajustes</option>
          </select>

          {/* Data Início */}
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Data Início"
          />

          {/* Data Fim */}
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Data Fim"
          />
        </div>
      </div>

      {/* Lista de Movimentações */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
              <tr>
                <th className="text-left py-4 px-4 sm:px-6 text-sm font-semibold">Data</th>
                <th className="text-left py-4 px-4 text-sm font-semibold">Produto</th>
                <th className="text-center py-4 px-4 text-sm font-semibold">Tipo</th>
                <th className="text-center py-4 px-4 text-sm font-semibold">Quantidade</th>
                <th className="text-center py-4 px-4 text-sm font-semibold hidden md:table-cell">Estoque Anterior</th>
                <th className="text-center py-4 px-4 text-sm font-semibold hidden md:table-cell">Estoque Novo</th>
                <th className="text-left py-4 px-4 text-sm font-semibold hidden lg:table-cell">Motivo</th>
                <th className="text-left py-4 px-4 text-sm font-semibold hidden xl:table-cell">Responsável</th>
              </tr>
            </thead>
            <tbody>
              {movimentacoesFiltradas.map((mov, index) => (
                <tr 
                  key={mov.id} 
                  className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                  }`}
                >
                  <td className="py-4 px-4 sm:px-6">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-900">
                        {new Date(mov.dataMovimentacao).toLocaleDateString('pt-PT')}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <p className="font-semibold text-gray-900 text-sm">
                      {mov.produtoNome}
                    </p>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                      mov.tipo === 'ENTRADA' 
                        ? 'bg-green-100 text-green-800' 
                        : mov.tipo === 'SAIDA'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {mov.tipo}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className={`font-bold text-sm ${
                      mov.tipo === 'ENTRADA' 
                        ? 'text-green-600' 
                        : mov.tipo === 'SAIDA'
                        ? 'text-red-600'
                        : 'text-blue-600'
                    }`}>
                      {mov.tipo === 'ENTRADA' ? '+' : mov.tipo === 'SAIDA' ? '-' : '±'}{Math.abs(mov.quantidade)}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center text-sm text-gray-600 hidden md:table-cell">
                    {mov.estoqueAnterior}
                  </td>
                  <td className="py-4 px-4 text-center hidden md:table-cell">
                    <span className="font-semibold text-sm text-gray-900">
                      {mov.estoqueNovo}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-600 hidden lg:table-cell">
                    {mov.motivo}
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-600 hidden xl:table-cell">
                    {mov.responsavel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {movimentacoesFiltradas.length === 0 && (
          <div className="text-center py-12">
            <RefreshCw className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Nenhuma movimentação encontrada</p>
            <p className="text-gray-400 text-sm mt-2">Tente ajustar os filtros de busca</p>
          </div>
        )}
      </div>

      {/* Modal Nova Movimentação */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-4 rounded-t-2xl">
              <h2 className="text-2xl font-bold">Nova Movimentação</h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Produto *</label>
                <select
                  value={formData.produtoId}
                  onChange={(e) => setFormData({...formData, produtoId: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Selecione um produto</option>
                  {produtosMock.map(produto => (
                    <option key={produto.id} value={produto.id}>
                      {produto.nome} (Estoque atual: {produto.estoque})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo *</label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => setFormData({...formData, tipo: e.target.value as any})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="ENTRADA">Entrada</option>
                    <option value="SAIDA">Saída</option>
                    <option value="AJUSTE">Ajuste</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {formData.tipo === 'AJUSTE' ? 'Novo Estoque *' : 'Quantidade *'}
                  </label>
                  <input
                    type="number"
                    value={formData.quantidade}
                    onChange={(e) => setFormData({...formData, quantidade: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Motivo *</label>
                <input
                  type="text"
                  value={formData.motivo}
                  onChange={(e) => setFormData({...formData, motivo: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Ex: Compra, Venda, Inventário, Correção"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  rows={3}
                  placeholder="Informações adicionais (opcional)"
                />
              </div>

              {formData.tipo === 'AJUSTE' && (
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Atenção:</strong> No tipo AJUSTE, o valor informado substituirá o estoque atual do produto.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-gray-50 px-6 py-4 flex gap-3 justify-end rounded-b-2xl">
              <button
                onClick={fecharModal}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={salvarMovimentacao}
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all"
              >
                Salvar Movimentação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
