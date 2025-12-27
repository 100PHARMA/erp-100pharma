'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, User, TrendingUp, Award, DollarSign, X, Edit } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import Link from 'next/link';

// Tipos baseados no schema real do Supabase
interface Podologista {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  nif: string | null;
  morada: string | null;
  localidade: string | null;
  codigo_postal: string | null;
  observacoes: string | null;
  ativo: boolean;
}

interface IncentivoPodologista {
  podologista_id: string;
  podologista_nome: string;
  total_farmacias: number;
  total_frascos: number;
  total_incentivos: number;
}

interface PodologistaComIncentivos extends Podologista {
  total_farmacias: number;
  total_frascos: number;
  total_incentivos: number;
}

export default function PodologistasPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [podologistas, setPodologistas] = useState<PodologistaComIncentivos[]>([]);
  const [podologistaEditando, setPodologistaEditando] = useState<string | null>(null);
  
  // Stats
  const [totalPodologistas, setTotalPodologistas] = useState(0);
  const [totalFrascos, setTotalFrascos] = useState(0);
  const [totalIncentivos, setTotalIncentivos] = useState(0);
  const [mediaPorFrasco, setMediaPorFrasco] = useState(0);

  // Form data
  const [formData, setFormData] = useState({
    nome: '',
    nif: '',
    telefone: '',
    email: '',
    morada: '',
    localidade: '',
    codigo_postal: '',
    observacoes: '',
    ativo: true,
  });

  // Carregar dados ao montar o componente
  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      // Query 1: Buscar podologistas ativos
      const { data: podologistasAtivos, error: errorPodologistas } = await supabase
        .from('podologistas')
        .select('id, nome, telefone, email, nif, morada, localidade, codigo_postal, observacoes, ativo')
        .eq('ativo', true)
        .order('nome', { ascending: true });

      if (errorPodologistas) {
        console.error('Erro ao buscar podologistas:', errorPodologistas);
        toast.error('Erro ao carregar podologistas');
        setLoading(false);
        return;
      }

      // Query 2: Buscar incentivos da view
      const { data: incentivos, error: errorIncentivos } = await supabase
        .from('vw_incentivos_podologistas')
        .select('podologista_id, podologista_nome, total_farmacias, total_frascos, total_incentivos');

      if (errorIncentivos) {
        console.error('Erro ao buscar incentivos:', errorIncentivos);
        toast.error('Erro ao carregar incentivos');
      }

      // Merge: para cada podologista ativo, procurar incentivos
      const podologistasComIncentivos: PodologistaComIncentivos[] = (podologistasAtivos || []).map((pod) => {
        const incentivo = (incentivos || []).find((inc) => inc.podologista_id === pod.id);

        return {
          ...pod,
          total_farmacias: incentivo?.total_farmacias || 0,
          total_frascos: incentivo?.total_frascos || 0,
          total_incentivos: Number(incentivo?.total_incentivos || 0),
        };
      });

      setPodologistas(podologistasComIncentivos);

      // Calcular estatísticas
      const totalPods = podologistasComIncentivos.length;
      const totalFras = podologistasComIncentivos.reduce((sum, p) => sum + p.total_frascos, 0);
      const totalInc = podologistasComIncentivos.reduce((sum, p) => sum + p.total_incentivos, 0);
      const media = totalFras > 0 ? totalInc / totalFras : 0;

      setTotalPodologistas(totalPods);
      setTotalFrascos(totalFras);
      setTotalIncentivos(totalInc);
      setMediaPorFrasco(media);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados dos podologistas');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome.trim()) {
      toast.error('Por favor, preencha o nome do podologista');
      return;
    }

    // Validação de email se preenchido
    if (formData.email && !validarEmail(formData.email)) {
      toast.error('Por favor, insira um email válido');
      return;
    }

    try {
      const { error } = await supabase.from('podologistas').insert([
        {
          nome: formData.nome,
          nif: formData.nif || null,
          telefone: formData.telefone || null,
          email: formData.email || null,
          morada: formData.morada || null,
          localidade: formData.localidade || null,
          codigo_postal: formData.codigo_postal || null,
          observacoes: formData.observacoes || null,
          ativo: formData.ativo,
        },
      ]);

      if (error) {
        console.error('Erro ao criar podologista:', error);
        toast.error('Erro ao criar podologista');
        return;
      }

      toast.success('Podologista criado com sucesso!');
      setShowModal(false);
      resetForm();
      carregarDados(); // Recarregar lista
    } catch (error) {
      console.error('Erro ao salvar podologista:', error);
      toast.error('Erro ao salvar podologista');
    }
  };

  const handleEditar = (podologista: PodologistaComIncentivos) => {
    setPodologistaEditando(podologista.id);
    setFormData({
      nome: podologista.nome,
      nif: podologista.nif || '',
      telefone: podologista.telefone || '',
      email: podologista.email || '',
      morada: podologista.morada || '',
      localidade: podologista.localidade || '',
      codigo_postal: podologista.codigo_postal || '',
      observacoes: podologista.observacoes || '',
      ativo: podologista.ativo,
    });
    setShowEditModal(true);
  };

  const handleSubmitEdicao = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome.trim()) {
      toast.error('Por favor, preencha o nome do podologista');
      return;
    }

    // Validação de email se preenchido
    if (formData.email && !validarEmail(formData.email)) {
      toast.error('Por favor, insira um email válido');
      return;
    }

    if (!podologistaEditando) return;

    try {
      const { error } = await supabase
        .from('podologistas')
        .update({
          nome: formData.nome,
          nif: formData.nif || null,
          telefone: formData.telefone || null,
          email: formData.email || null,
          morada: formData.morada || null,
          localidade: formData.localidade || null,
          codigo_postal: formData.codigo_postal || null,
          observacoes: formData.observacoes || null,
          ativo: formData.ativo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', podologistaEditando);

      if (error) {
        console.error('Erro ao atualizar podologista:', error);
        toast.error('Erro ao atualizar podologista');
        return;
      }

      toast.success('Podologista atualizado com sucesso!');
      setShowEditModal(false);
      setPodologistaEditando(null);
      resetForm();
      carregarDados(); // Recarregar lista e estatísticas
    } catch (error) {
      console.error('Erro ao atualizar podologista:', error);
      toast.error('Erro ao atualizar podologista');
    }
  };

  const validarEmail = (email: string): boolean => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      nif: '',
      telefone: '',
      email: '',
      morada: '',
      localidade: '',
      codigo_postal: '',
      observacoes: '',
      ativo: true,
    });
  };

  const handleNovo = () => {
    resetForm();
    setShowModal(true);
  };

  const handleFecharModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleFecharModalEdicao = () => {
    setShowEditModal(false);
    setPodologistaEditando(null);
    resetForm();
  };

  const filteredPodologistas = podologistas.filter(
    (p) =>
      p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.nif && p.nif.includes(searchTerm)) ||
      (p.email && p.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Podologistas</h1>
            <p className="text-gray-600 mt-1">Gestão de podologistas e incentivos</p>
          </div>
          <button
            onClick={handleNovo}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105"
          >
            <Plus className="w-5 h-5" />
            Novo Podologista
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-lg">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Podologistas</p>
                <p className="text-2xl font-bold text-gray-900">{totalPodologistas}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Frascos</p>
                <p className="text-2xl font-bold text-gray-900">{totalFrascos}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-4">
              <div className="bg-purple-100 p-3 rounded-lg">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Incentivos</p>
                <p className="text-2xl font-bold text-gray-900">
                  € {totalIncentivos.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-4">
              <div className="bg-orange-100 p-3 rounded-lg">
                <Award className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Média por Frasco</p>
                <p className="text-2xl font-bold text-gray-900">
                  € {mediaPorFrasco.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl shadow-md p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar por nome, NIF ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Podologistas List */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Podologista
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">NIF</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Contacto
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">
                    Total Frascos
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">
                    Total Incentivos
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">
                    Estado
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPodologistas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      Nenhum podologista encontrado
                    </td>
                  </tr>
                ) : (
                  filteredPodologistas.map((podologista) => (
                    <tr key={podologista.id} className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-gray-900">{podologista.nome}</p>
                          {podologista.morada && (
                            <p className="text-sm text-gray-600">{podologista.morada}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900">{podologista.nif || '—'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="text-sm text-gray-600">{podologista.telefone || '—'}</p>
                          <p className="text-sm text-gray-600">{podologista.email || '—'}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-semibold text-gray-900">
                          {podologista.total_frascos}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-semibold text-green-600">
                          €{' '}
                          {podologista.total_incentivos.toLocaleString('pt-PT', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            Ativo
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`/podologistas/${podologista.id}/relatorio`}
                            className="px-3 py-1 text-xs font-medium rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            Relatório
                          </Link>
                          <button
                            onClick={() => handleEditar(podologista)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar podologista"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Award className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Sistema de Incentivos</h3>
              <p className="text-sm text-gray-700 mb-3">
                Cada frasco vendido através de um podologista gera um incentivo de{' '}
                <strong>
                  € {mediaPorFrasco.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                </strong>
                . Os valores são calculados automaticamente com base nas vendas registadas no sistema.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Criar Podologista */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-2xl font-bold">Novo Podologista</h2>
              <button
                onClick={handleFecharModal}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Dr. João Silva"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">NIF</label>
                  <input
                    type="text"
                    value={formData.nif}
                    onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="123456789"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Telefone</label>
                  <input
                    type="tel"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+351 91 234 5678"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="email@exemplo.pt"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Morada</label>
                <input
                  type="text"
                  value={formData.morada}
                  onChange={(e) => setFormData({ ...formData, morada: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Rua, Número"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Localidade</label>
                  <input
                    type="text"
                    value={formData.localidade}
                    onChange={(e) => setFormData({ ...formData, localidade: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Lisboa"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Código Postal</label>
                  <input
                    type="text"
                    value={formData.codigo_postal}
                    onChange={(e) => setFormData({ ...formData, codigo_postal: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="1000-001"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Observações adicionais..."
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={formData.ativo}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="ativo" className="text-sm font-medium text-gray-700">
                  Ativo
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleFecharModal}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg font-medium transition-all"
                >
                  Cadastrar Podologista
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Podologista */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-2xl font-bold">Editar Podologista</h2>
              <button
                onClick={handleFecharModalEdicao}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdicao} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Dr. João Silva"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">NIF</label>
                  <input
                    type="text"
                    value={formData.nif}
                    onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="123456789"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Telefone</label>
                  <input
                    type="tel"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+351 91 234 5678"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="email@exemplo.pt"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Morada</label>
                <input
                  type="text"
                  value={formData.morada}
                  onChange={(e) => setFormData({ ...formData, morada: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Rua, Número"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Localidade</label>
                  <input
                    type="text"
                    value={formData.localidade}
                    onChange={(e) => setFormData({ ...formData, localidade: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Lisboa"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Código Postal</label>
                  <input
                    type="text"
                    value={formData.codigo_postal}
                    onChange={(e) => setFormData({ ...formData, codigo_postal: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="1000-001"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Observações adicionais..."
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ativo-edit"
                  checked={formData.ativo}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="ativo-edit" className="text-sm font-medium text-gray-700">
                  Ativo
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleFecharModalEdicao}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg font-medium transition-all"
                >
                  Guardar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
