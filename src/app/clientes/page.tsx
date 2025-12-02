'use client';

import { useState, useMemo, useEffect } from 'react';
import { Users, Plus, Search, Filter, Building2, UserCircle, Stethoscope, User, X, Eye, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import SupabaseSetupGuide from '@/components/SupabaseSetupGuide';

type TipoCliente = 'Farmacia' | 'Podologista' | 'Clinica' | 'Consumidor';

interface Cliente {
  id: string;
  nome: string;
  nif: string | null;
  tipo: string | null;
  morada: string | null;
  telefone: string | null;
  email: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

const tipoIcons = {
  Farmacia: Building2,
  Podologista: UserCircle,
  Clinica: Stethoscope,
  Consumidor: User,
};

export default function ClientesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState<TipoCliente | 'TODOS'>('TODOS');
  const [filterAtivo, setFilterAtivo] = useState<'TODOS' | 'ATIVO' | 'INATIVO'>('TODOS');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [modalNovoCliente, setModalNovoCliente] = useState(false);
  const [modalDetalhes, setModalDetalhes] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [novoCliente, setNovoCliente] = useState<Partial<Cliente>>({
    nome: '',
    nif: '',
    tipo: 'Farmacia',
    morada: '',
    telefone: '',
    email: '',
    ativo: true,
  });

  // Carregar clientes do Supabase
  useEffect(() => {
    carregarClientes();
  }, []);

  const carregarClientes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nome', { ascending: true });

      if (error) {
        // Se houver erro de permissão, mostrar guia de configuração
        if (error.message.includes('permission') || error.message.includes('policy') || error.message.includes('JWT')) {
          setNeedsSetup(true);
          setLoading(false);
          return;
        }
        throw error;
      }
      setClientes(data || []);
      setNeedsSetup(false);
    } catch (error: any) {
      console.error('Erro ao carregar clientes:', error);
      // Verificar se é erro de RLS/permissão
      if (error?.message?.includes('Failed to fetch') || error?.message?.includes('permission') || error?.message?.includes('policy')) {
        setNeedsSetup(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const clientesFiltrados = useMemo(() => {
    return clientes.filter((cliente) => {
      const matchSearch =
        cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (cliente.nif && cliente.nif.includes(searchTerm)) ||
        (cliente.email && cliente.email.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchTipo = filterTipo === 'TODOS' || cliente.tipo === filterTipo;
      const matchAtivo = 
        filterAtivo === 'TODOS' || 
        (filterAtivo === 'ATIVO' && cliente.ativo) ||
        (filterAtivo === 'INATIVO' && !cliente.ativo);

      return matchSearch && matchTipo && matchAtivo;
    });
  }, [searchTerm, filterTipo, filterAtivo, clientes]);

  const stats = useMemo(() => {
    return {
      total: clientes.length || 0,
      ativos: clientes.filter((c) => c.ativo).length || 0,
      inativos: clientes.filter((c) => !c.ativo).length || 0,
      farmacias: clientes.filter((c) => c.tipo === 'Farmacia').length || 0,
    };
  }, [clientes]);

  const adicionarCliente = async () => {
    if (!novoCliente.nome) {
      alert('Por favor, preencha o nome do cliente.');
      return;
    }

    try {
      const { error } = await supabase
        .from('clientes')
        .insert([{
          nome: novoCliente.nome,
          nif: novoCliente.nif || null,
          tipo: novoCliente.tipo || null,
          morada: novoCliente.morada || null,
          telefone: novoCliente.telefone || null,
          email: novoCliente.email || null,
          ativo: novoCliente.ativo !== false
        }]);

      if (error) throw error;

      await carregarClientes();
      setModalNovoCliente(false);
      setNovoCliente({
        nome: '',
        nif: '',
        tipo: 'Farmacia',
        morada: '',
        telefone: '',
        email: '',
        ativo: true,
      });
      alert('Cliente adicionado com sucesso!');
    } catch (error) {
      console.error('Erro ao adicionar cliente:', error);
      alert('Erro ao adicionar cliente. Tente novamente.');
    }
  };

  const verDetalhes = (cliente: Cliente) => {
    setClienteSelecionado(cliente);
    setClienteEditando(cliente);
    setModoEdicao(false);
    setModalDetalhes(true);
  };

  const iniciarEdicao = () => {
    setModoEdicao(true);
  };

  const cancelarEdicao = () => {
    setClienteEditando(clienteSelecionado);
    setModoEdicao(false);
  };

  const salvarEdicao = async () => {
    if (!clienteEditando) return;

    if (!clienteEditando.nome) {
      alert('Por favor, preencha o nome do cliente.');
      return;
    }

    try {
      const { error } = await supabase
        .from('clientes')
        .update({
          nome: clienteEditando.nome,
          nif: clienteEditando.nif || null,
          tipo: clienteEditando.tipo || null,
          morada: clienteEditando.morada || null,
          telefone: clienteEditando.telefone || null,
          email: clienteEditando.email || null,
          ativo: clienteEditando.ativo
        })
        .eq('id', clienteEditando.id);

      if (error) throw error;

      await carregarClientes();
      setClienteSelecionado(clienteEditando);
      setModoEdicao(false);
      alert('Cliente atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      alert('Erro ao atualizar cliente. Tente novamente.');
    }
  };

  // SOFT DELETE: Marca cliente como inativo em vez de deletar
  const deletarCliente = async (cliente: Cliente) => {
    if (confirm(`Tem certeza que deseja desativar o cliente ${cliente.nome}?\n\nO cliente será marcado como INATIVO e não será deletado permanentemente.`)) {
      try {
        const { error } = await supabase
          .from('clientes')
          .update({ ativo: false })
          .eq('id', cliente.id);

        if (error) throw error;

        await carregarClientes();
        alert('Cliente desativado com sucesso!');
      } catch (error) {
        console.error('Erro ao desativar cliente:', error);
        alert('Erro ao desativar cliente. Tente novamente.');
      }
    }
  };

  // SOFT DELETE: Marca cliente como inativo em vez de deletar
  const deletarClienteModal = async () => {
    if (!clienteSelecionado) return;

    if (confirm(`Tem certeza que deseja desativar o cliente ${clienteSelecionado.nome}?\n\nO cliente será marcado como INATIVO e não será deletado permanentemente.`)) {
      try {
        const { error } = await supabase
          .from('clientes')
          .update({ ativo: false })
          .eq('id', clienteSelecionado.id);

        if (error) throw error;

        await carregarClientes();
        setModalDetalhes(false);
        setClienteSelecionado(null);
        setClienteEditando(null);
        setModoEdicao(false);
        alert('Cliente desativado com sucesso!');
      } catch (error) {
        console.error('Erro ao desativar cliente:', error);
        alert('Erro ao desativar cliente. Tente novamente.');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando clientes...</p>
        </div>
      </div>
    );
  }

  if (needsSetup) {
    return <SupabaseSetupGuide />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
              Clientes
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Gestão de farmácias, podologistas, clínicas e consumidores
            </p>
          </div>
          <button 
            onClick={() => setModalNovoCliente(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">Novo Cliente</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm text-gray-600">Total</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.total}</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-green-100 p-2 rounded-lg">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm text-gray-600">Ativos</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-green-600">{stats.ativos}</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-red-100 p-2 rounded-lg">
              <Users className="w-5 h-5 text-red-600" />
            </div>
            <span className="text-sm text-gray-600">Inativos</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-red-600">{stats.inativos}</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-purple-100 p-2 rounded-lg">
              <Building2 className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm text-gray-600">Farmácias</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-purple-600">{stats.farmacias}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar por nome, NIF ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filter Tipo */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value as TipoCliente | 'TODOS')}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
            >
              <option value="TODOS">Todos os Tipos</option>
              <option value="Farmacia">Farmácia</option>
              <option value="Podologista">Podologista</option>
              <option value="Clinica">Clínica</option>
              <option value="Consumidor">Consumidor</option>
            </select>
          </div>

          {/* Filter Status */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={filterAtivo}
              onChange={(e) => setFilterAtivo(e.target.value as 'TODOS' | 'ATIVO' | 'INATIVO')}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="ATIVO">Ativo</option>
              <option value="INATIVO">Inativo</option>
            </select>
          </div>
        </div>
      </div>

      {/* Clientes List */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-4 px-4 sm:px-6 text-sm font-semibold text-gray-700">
                  Cliente
                </th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700 hidden md:table-cell">
                  Tipo
                </th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700 hidden lg:table-cell">
                  Telefone
                </th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700 hidden xl:table-cell">
                  Email
                </th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-gray-700">
                  Status
                </th>
                <th className="text-right py-4 px-4 sm:px-6 text-sm font-semibold text-gray-700">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clientesFiltrados.map((cliente) => {
                const TipoIcon = tipoIcons[cliente.tipo as TipoCliente] || User;
                return (
                  <tr key={cliente.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-4 sm:px-6">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                          <TipoIcon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{cliente.nome}</p>
                          <p className="text-sm text-gray-500">NIF: {cliente.nif || 'N/A'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 hidden md:table-cell">
                      <span className="text-sm text-gray-600">{cliente.tipo || 'N/A'}</span>
                    </td>
                    <td className="py-4 px-4 hidden lg:table-cell">
                      <span className="text-sm text-gray-600">{cliente.telefone || 'N/A'}</span>
                    </td>
                    <td className="py-4 px-4 hidden xl:table-cell">
                      <div className="text-sm text-gray-600">
                        <p className="text-xs text-gray-500">{cliente.email || 'N/A'}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          cliente.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {cliente.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="py-4 px-4 sm:px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => verDetalhes(cliente)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Ver detalhes"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => deletarCliente(cliente)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Desativar cliente"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {clientesFiltrados.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Nenhum cliente encontrado</p>
          </div>
        )}
      </div>

      {/* Modal Novo Cliente */}
      {modalNovoCliente && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Novo Cliente</h2>
              <button
                onClick={() => setModalNovoCliente(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome *
                  </label>
                  <input
                    type="text"
                    value={novoCliente.nome}
                    onChange={(e) => setNovoCliente({ ...novoCliente, nome: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Nome do cliente"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    NIF
                  </label>
                  <input
                    type="text"
                    value={novoCliente.nif}
                    onChange={(e) => setNovoCliente({ ...novoCliente, nif: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="NIF"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo
                  </label>
                  <select
                    value={novoCliente.tipo}
                    onChange={(e) => setNovoCliente({ ...novoCliente, tipo: e.target.value as TipoCliente })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Farmacia">Farmácia</option>
                    <option value="Podologista">Podologista</option>
                    <option value="Clinica">Clínica</option>
                    <option value="Consumidor">Consumidor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={novoCliente.ativo ? 'ATIVO' : 'INATIVO'}
                    onChange={(e) => setNovoCliente({ ...novoCliente, ativo: e.target.value === 'ATIVO' })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="ATIVO">Ativo</option>
                    <option value="INATIVO">Inativo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Telefone
                  </label>
                  <input
                    type="text"
                    value={novoCliente.telefone}
                    onChange={(e) => setNovoCliente({ ...novoCliente, telefone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Telefone"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={novoCliente.email}
                    onChange={(e) => setNovoCliente({ ...novoCliente, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="email@exemplo.com"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Morada
                  </label>
                  <input
                    type="text"
                    value={novoCliente.morada}
                    onChange={(e) => setNovoCliente({ ...novoCliente, morada: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Endereço completo"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setModalNovoCliente(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={adicionarCliente}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all duration-300 font-medium"
                >
                  Adicionar Cliente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalhes */}
      {modalDetalhes && clienteSelecionado && clienteEditando && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                {modoEdicao ? 'Editar Cliente' : 'Detalhes do Cliente'}
              </h2>
              <button
                onClick={() => {
                  setModalDetalhes(false);
                  setModoEdicao(false);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome *
                  </label>
                  <input
                    type="text"
                    value={clienteEditando.nome}
                    onChange={(e) => setClienteEditando({ ...clienteEditando, nome: e.target.value })}
                    disabled={!modoEdicao}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    NIF
                  </label>
                  <input
                    type="text"
                    value={clienteEditando.nif || ''}
                    onChange={(e) => setClienteEditando({ ...clienteEditando, nif: e.target.value })}
                    disabled={!modoEdicao}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo
                  </label>
                  <select
                    value={clienteEditando.tipo || 'Farmacia'}
                    onChange={(e) => setClienteEditando({ ...clienteEditando, tipo: e.target.value })}
                    disabled={!modoEdicao}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                  >
                    <option value="Farmacia">Farmácia</option>
                    <option value="Podologista">Podologista</option>
                    <option value="Clinica">Clínica</option>
                    <option value="Consumidor">Consumidor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={clienteEditando.ativo ? 'ATIVO' : 'INATIVO'}
                    onChange={(e) => setClienteEditando({ ...clienteEditando, ativo: e.target.value === 'ATIVO' })}
                    disabled={!modoEdicao}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                  >
                    <option value="ATIVO">Ativo</option>
                    <option value="INATIVO">Inativo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Telefone
                  </label>
                  <input
                    type="text"
                    value={clienteEditando.telefone || ''}
                    onChange={(e) => setClienteEditando({ ...clienteEditando, telefone: e.target.value })}
                    disabled={!modoEdicao}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={clienteEditando.email || ''}
                    onChange={(e) => setClienteEditando({ ...clienteEditando, email: e.target.value })}
                    disabled={!modoEdicao}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Morada
                  </label>
                  <input
                    type="text"
                    value={clienteEditando.morada || ''}
                    onChange={(e) => setClienteEditando({ ...clienteEditando, morada: e.target.value })}
                    disabled={!modoEdicao}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                {!modoEdicao ? (
                  <>
                    <button
                      onClick={deletarClienteModal}
                      className="px-6 py-3 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors font-medium"
                    >
                      Desativar
                    </button>
                    <button
                      onClick={iniciarEdicao}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all duration-300 font-medium"
                    >
                      Editar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={cancelarEdicao}
                      className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={salvarEdicao}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all duration-300 font-medium"
                    >
                      Salvar
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
