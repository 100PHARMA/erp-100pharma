'use client';

import { useState, useEffect } from 'react';
import { Building2, Plus, Search, Edit, Trash2, Eye, Phone, Mail, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Fornecedor {
  id: string;
  nome: string;
  nif: string;
  tipo: 'NACIONAL' | 'INTERNACIONAL';
  localidade: string;
  morada: string;
  contacto: string;
  email: string;
  status: 'ATIVO' | 'INATIVO';
  total_compras: number;
  ultima_compra: string | null;
}

export default function FornecedoresPage() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [busca, setBusca] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [modalDetalhes, setModalDetalhes] = useState(false);
  const [fornecedorSelecionado, setFornecedorSelecionado] = useState<Fornecedor | null>(null);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const [novoFornecedor, setNovoFornecedor] = useState<Omit<Fornecedor, 'id' | 'total_compras' | 'ultima_compra'>>(
    {
      nome: '',
      nif: '',
      tipo: 'NACIONAL',
      localidade: '',
      morada: '',
      contacto: '',
      email: '',
      status: 'ATIVO',
    }
  );

  // Carregar fornecedores do Supabase
  const carregarFornecedores = async () => {
    try {
      setCarregando(true);
      const { data, error } = await supabase
        .from('fornecedores')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setFornecedores(data || []);
    } catch (error) {
      console.error('Erro ao carregar fornecedores:', error);
      alert('Erro ao carregar fornecedores. Verifique a conexão com o Supabase.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarFornecedores();
  }, []);

  const fornecedoresFiltrados = fornecedores.filter(
    (f) =>
      f.nome.toLowerCase().includes(busca.toLowerCase()) ||
      f.nif.includes(busca) ||
      f.email.toLowerCase().includes(busca.toLowerCase())
  );

  const abrirModalNovo = () => {
    setModoEdicao(false);
    setNovoFornecedor({
      nome: '',
      nif: '',
      tipo: 'NACIONAL',
      localidade: '',
      morada: '',
      contacto: '',
      email: '',
      status: 'ATIVO',
    });
    setModalAberto(true);
  };

  const abrirModalEdicao = (fornecedor: Fornecedor) => {
    setModoEdicao(true);
    setFornecedorSelecionado(fornecedor);
    setNovoFornecedor({
      nome: fornecedor.nome,
      nif: fornecedor.nif,
      tipo: fornecedor.tipo,
      localidade: fornecedor.localidade,
      morada: fornecedor.morada,
      contacto: fornecedor.contacto,
      email: fornecedor.email,
      status: fornecedor.status,
    });
    setModalAberto(true);
  };

  const salvarFornecedor = async () => {
    if (!novoFornecedor.nome || !novoFornecedor.nif || !novoFornecedor.email) {
      alert('Preencha todos os campos obrigatórios!');
      return;
    }

    try {
      if (modoEdicao && fornecedorSelecionado) {
        // Atualizar fornecedor existente
        const { error } = await supabase
          .from('fornecedores')
          .update({
            nome: novoFornecedor.nome,
            nif: novoFornecedor.nif,
            tipo: novoFornecedor.tipo,
            localidade: novoFornecedor.localidade,
            morada: novoFornecedor.morada,
            contacto: novoFornecedor.contacto,
            email: novoFornecedor.email,
            status: novoFornecedor.status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', fornecedorSelecionado.id);

        if (error) throw error;
        alert('Fornecedor atualizado com sucesso!');
      } else {
        // Criar novo fornecedor
        const { error } = await supabase.from('fornecedores').insert([
          {
            nome: novoFornecedor.nome,
            nif: novoFornecedor.nif,
            tipo: novoFornecedor.tipo,
            localidade: novoFornecedor.localidade,
            morada: novoFornecedor.morada,
            contacto: novoFornecedor.contacto,
            email: novoFornecedor.email,
            status: novoFornecedor.status,
            total_compras: 0,
            ultima_compra: null,
          },
        ]);

        if (error) throw error;
        alert('Fornecedor cadastrado com sucesso!');
      }

      setModalAberto(false);
      carregarFornecedores();
    } catch (error) {
      console.error('Erro ao salvar fornecedor:', error);
      alert('Erro ao salvar fornecedor. Tente novamente.');
    }
  };

  const excluirFornecedor = async (id: string) => {
    if (!confirm('Deseja realmente marcar este fornecedor como INATIVO?')) {
      return;
    }

    try {
      // Soft delete - marcar como INATIVO
      const { error } = await supabase
        .from('fornecedores')
        .update({ status: 'INATIVO', updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      alert('Fornecedor marcado como INATIVO com sucesso!');
      carregarFornecedores();
    } catch (error) {
      console.error('Erro ao excluir fornecedor:', error);
      alert('Erro ao excluir fornecedor. Tente novamente.');
    }
  };

  const verDetalhes = (fornecedor: Fornecedor) => {
    setFornecedorSelecionado(fornecedor);
    setModalDetalhes(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Fornecedores</h1>
            <p className="text-gray-600">Gestão de fornecedores e parceiros</p>
          </div>
          <button
            onClick={abrirModalNovo}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 hover:scale-105"
          >
            <Plus className="w-5 h-5" />
            Novo Fornecedor
          </button>
        </div>
      </div>

      {/* Busca */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nome, NIF ou email..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          {carregando ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Nome</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">NIF</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Tipo</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Localidade</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Contacto</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold">Total Compras</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold">Status</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {fornecedoresFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      Nenhum fornecedor encontrado. Clique em "Novo Fornecedor" para adicionar.
                    </td>
                  </tr>
                ) : (
                  fornecedoresFiltrados.map((fornecedor) => (
                    <tr key={fornecedor.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-100 p-2 rounded-lg">
                            <Building2 className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{fornecedor.nome}</p>
                            <p className="text-sm text-gray-500">{fornecedor.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700">{fornecedor.nif}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            fornecedor.tipo === 'NACIONAL'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {fornecedor.tipo}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-700">{fornecedor.localidade}</td>
                      <td className="px-6 py-4 text-gray-700">{fornecedor.contacto}</td>
                      <td className="px-6 py-4 text-center font-semibold text-gray-900">
                        {Number(fornecedor.total_compras || 0).toLocaleString('pt-PT', {
                          minimumFractionDigits: 2,
                        })}
                        €
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            fornecedor.status === 'ATIVO'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {fornecedor.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => verDetalhes(fornecedor)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Ver Detalhes"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => abrirModalEdicao(fornecedor)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => excluirFornecedor(fornecedor.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal Novo/Editar Fornecedor */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold">
                {modoEdicao ? 'Editar Fornecedor' : 'Novo Fornecedor'}
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome *</label>
                  <input
                    type="text"
                    value={novoFornecedor.nome}
                    onChange={(e) => setNovoFornecedor({ ...novoFornecedor, nome: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Nome do fornecedor"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">NIF *</label>
                  <input
                    type="text"
                    value={novoFornecedor.nif}
                    onChange={(e) => setNovoFornecedor({ ...novoFornecedor, nif: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="NIF"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo *</label>
                  <select
                    value={novoFornecedor.tipo}
                    onChange={(e) =>
                      setNovoFornecedor({
                        ...novoFornecedor,
                        tipo: e.target.value as 'NACIONAL' | 'INTERNACIONAL',
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="NACIONAL">Nacional</option>
                    <option value="INTERNACIONAL">Internacional</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Localidade *
                  </label>
                  <input
                    type="text"
                    value={novoFornecedor.localidade}
                    onChange={(e) =>
                      setNovoFornecedor({ ...novoFornecedor, localidade: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Cidade"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Morada *</label>
                  <input
                    type="text"
                    value={novoFornecedor.morada}
                    onChange={(e) =>
                      setNovoFornecedor({ ...novoFornecedor, morada: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Endereço completo"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contacto *
                  </label>
                  <input
                    type="text"
                    value={novoFornecedor.contacto}
                    onChange={(e) =>
                      setNovoFornecedor({ ...novoFornecedor, contacto: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="+351 21 123 4567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    value={novoFornecedor.email}
                    onChange={(e) =>
                      setNovoFornecedor({ ...novoFornecedor, email: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="email@fornecedor.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={novoFornecedor.status}
                    onChange={(e) =>
                      setNovoFornecedor({
                        ...novoFornecedor,
                        status: e.target.value as 'ATIVO' | 'INATIVO',
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ATIVO">Ativo</option>
                    <option value="INATIVO">Inativo</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={salvarFornecedor}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
                >
                  {modoEdicao ? 'Atualizar' : 'Cadastrar'}
                </button>
                <button
                  onClick={() => setModalAberto(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalhes */}
      {modalDetalhes && fornecedorSelecionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold">Detalhes do Fornecedor</h2>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4 pb-6 border-b">
                <div className="bg-blue-100 p-4 rounded-xl">
                  <Building2 className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{fornecedorSelecionado.nome}</h3>
                  <p className="text-gray-600">{fornecedorSelecionado.tipo}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">NIF</p>
                  <p className="font-semibold text-gray-900">{fornecedorSelecionado.nif}</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-gray-500">Status</p>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                      fornecedorSelecionado.status === 'ATIVO'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {fornecedorSelecionado.status}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <MapPin className="w-4 h-4" />
                    <span>Localização</span>
                  </div>
                  <p className="font-semibold text-gray-900">{fornecedorSelecionado.localidade}</p>
                  <p className="text-sm text-gray-600">{fornecedorSelecionado.morada}</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Phone className="w-4 h-4" />
                    <span>Contacto</span>
                  </div>
                  <p className="font-semibold text-gray-900">{fornecedorSelecionado.contacto}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Mail className="w-4 h-4 text-gray-500" />
                    <p className="text-sm text-gray-600">{fornecedorSelecionado.email}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-gray-500">Total em Compras</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {Number(fornecedorSelecionado.total_compras || 0).toLocaleString('pt-PT', {
                      minimumFractionDigits: 2,
                    })}
                    €
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-gray-500">Última Compra</p>
                  <p className="font-semibold text-gray-900">
                    {fornecedorSelecionado.ultima_compra
                      ? new Date(fornecedorSelecionado.ultima_compra).toLocaleDateString('pt-PT')
                      : 'Nenhuma compra registrada'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setModalDetalhes(false)}
                className="w-full bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-all"
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
