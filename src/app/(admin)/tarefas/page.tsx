'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Plus,
  Search,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  X,
} from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type Prioridade = 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';
type Estado = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA';

interface Tarefa {
  id: string;
  titulo: string;
  descricao: string;
  prioridade: Prioridade;
  responsavel: string;
  cliente: string | null;
  data_vencimento: string; // ISO yyyy-mm-dd
  estado: Estado;
  created_at?: string;
  updated_at?: string;
}

export default function TarefasPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'TODOS' | Estado>('TODOS');
  const [filtroPrioridade, setFiltroPrioridade] = useState<'TODOS' | Prioridade>('TODOS');

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [novaTarefa, setNovaTarefa] = useState<{
    titulo: string;
    descricao: string;
    prioridade: Prioridade;
    responsavel: string;
    cliente: string;
    data_vencimento: string;
    estado: Estado;
  }>({
    titulo: '',
    descricao: '',
    prioridade: 'MEDIA',
    responsavel: '',
    cliente: '',
    data_vencimento: '',
    estado: 'PENDENTE',
  });

  // ======================================================================
  // LOAD
  // ======================================================================

  async function carregarTarefas() {
    setLoading(true);
    try {
      // Diagnóstico (não remove): confirma se está autenticado
      const { data: userData } = await supabase.auth.getUser();
      // Se isso vier null, você está anon e qualquer RLS vai falhar.
      console.log('USER no /tarefas:', userData.user?.id, userData.user?.email);

      const { data, error } = await supabase
        .from('tarefas')
        .select(
          'id,titulo,descricao,prioridade,responsavel,cliente,data_vencimento,estado,created_at,updated_at'
        )
        .order('data_vencimento', { ascending: true });

      if (error) throw error;

      setTarefas((data as Tarefa[]) || []);
    } catch (e: any) {
      console.error('Erro ao carregar tarefas:', e);
      alert(`Erro ao carregar tarefas: ${e?.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarTarefas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ======================================================================
  // HELPERS UI
  // ======================================================================

  const getPrioridadeConfig = (prioridade: Prioridade) => {
    const configs: Record<Prioridade, { color: string; label: string }> = {
      BAIXA: { color: 'bg-gray-100 text-gray-700', label: 'Baixa' },
      MEDIA: { color: 'bg-blue-100 text-blue-700', label: 'Média' },
      ALTA: { color: 'bg-orange-100 text-orange-700', label: 'Alta' },
      URGENTE: { color: 'bg-red-100 text-red-700', label: 'Urgente' },
    };
    return configs[prioridade];
  };

  const getEstadoConfig = (estado: Estado) => {
    const configs: Record<
      Estado,
      { color: string; icon: any; label: string }
    > = {
      PENDENTE: { color: 'bg-yellow-100 text-yellow-700', icon: Clock, label: 'Pendente' },
      EM_ANDAMENTO: { color: 'bg-blue-100 text-blue-700', icon: AlertCircle, label: 'Em Andamento' },
      CONCLUIDA: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Concluída' },
      CANCELADA: { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Cancelada' },
    };
    return configs[estado];
  };

  // ======================================================================
  // FILTERS / STATS
  // ======================================================================

  const filteredTarefas = tarefas.filter((t) => {
    const term = searchTerm.trim().toLowerCase();

    const matchSearch =
      !term ||
      t.titulo.toLowerCase().includes(term) ||
      t.descricao.toLowerCase().includes(term) ||
      (t.cliente ? t.cliente.toLowerCase().includes(term) : false) ||
      (t.responsavel ? t.responsavel.toLowerCase().includes(term) : false);

    const matchEstado = filtroEstado === 'TODOS' || t.estado === filtroEstado;
    const matchPrioridade = filtroPrioridade === 'TODOS' || t.prioridade === filtroPrioridade;

    return matchSearch && matchEstado && matchPrioridade;
  });

  const tarefasPendentes = tarefas.filter((t) => t.estado === 'PENDENTE').length;
  const tarefasEmAndamento = tarefas.filter((t) => t.estado === 'EM_ANDAMENTO').length;
  const tarefasConcluidas = tarefas.filter((t) => t.estado === 'CONCLUIDA').length;

  // ======================================================================
  // CREATE
  // ======================================================================

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!novaTarefa.titulo || !novaTarefa.descricao || !novaTarefa.responsavel || !novaTarefa.data_vencimento) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        titulo: novaTarefa.titulo.trim(),
        descricao: novaTarefa.descricao.trim(),
        prioridade: novaTarefa.prioridade,
        responsavel: novaTarefa.responsavel.trim(),
        cliente: novaTarefa.cliente.trim() ? novaTarefa.cliente.trim() : null,
        data_vencimento: novaTarefa.data_vencimento,
        estado: novaTarefa.estado,
      };

      const { error } = await supabase.from('tarefas').insert(payload);
      if (error) throw error;

      setShowModal(false);
      setNovaTarefa({
        titulo: '',
        descricao: '',
        prioridade: 'MEDIA',
        responsavel: '',
        cliente: '',
        data_vencimento: '',
        estado: 'PENDENTE',
      });

      await carregarTarefas();
    } catch (e: any) {
      console.error('Erro ao criar tarefa:', e);
      alert(`Erro ao criar tarefa: ${e?.message || 'Erro desconhecido'}`);
    } finally {
      setSaving(false);
    }
  }

  // ======================================================================
  // RENDER
  // ======================================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando tarefas...</p>
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
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
              Agenda e Tarefas
            </h1>
            <p className="text-gray-600 mt-1">
              Gestão de tarefas e compromissos
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105"
          >
            <Plus className="w-5 h-5" />
            Nova Tarefa
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-lg">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Tarefas</p>
                <p className="text-2xl font-bold text-gray-900">{tarefas.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-4">
              <div className="bg-yellow-100 p-3 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Pendentes</p>
                <p className="text-2xl font-bold text-gray-900">{tarefasPendentes}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-lg">
                <AlertCircle className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Em Andamento</p>
                <p className="text-2xl font-bold text-gray-900">{tarefasEmAndamento}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Concluídas</p>
                <p className="text-2xl font-bold text-gray-900">{tarefasConcluidas}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Pesquisar tarefas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as any)}
              className="px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="TODOS">Todos os Estados</option>
              <option value="PENDENTE">Pendente</option>
              <option value="EM_ANDAMENTO">Em Andamento</option>
              <option value="CONCLUIDA">Concluída</option>
              <option value="CANCELADA">Cancelada</option>
            </select>

            <select
              value={filtroPrioridade}
              onChange={(e) => setFiltroPrioridade(e.target.value as any)}
              className="px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="TODOS">Todas Prioridades</option>
              <option value="URGENTE">Urgente</option>
              <option value="ALTA">Alta</option>
              <option value="MEDIA">Média</option>
              <option value="BAIXA">Baixa</option>
            </select>
          </div>
        </div>

        {/* Tarefas List */}
        <div className="grid grid-cols-1 gap-4">
          {filteredTarefas.map((tarefa) => {
            const prioridadeConfig = getPrioridadeConfig(tarefa.prioridade);
            const estadoConfig = getEstadoConfig(tarefa.estado);
            const EstadoIcon = estadoConfig.icon;

            return (
              <div
                key={tarefa.id}
                className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">{tarefa.titulo}</h3>
                        <p className="text-sm text-gray-600 mt-1">{tarefa.descricao}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">Responsável:</span>
                        <span className="font-medium text-gray-900">{tarefa.responsavel}</span>
                      </div>

                      {tarefa.cliente && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">Cliente:</span>
                          <span className="font-medium text-gray-900">{tarefa.cliente}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">
                          {new Date(tarefa.data_vencimento).toLocaleDateString('pt-PT')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span
                      className={`inline-flex items-center justify-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${estadoConfig.color}`}
                    >
                      <EstadoIcon className="w-3 h-3" />
                      {estadoConfig.label}
                    </span>
                    <span
                      className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-medium ${prioridadeConfig.color}`}
                    >
                      {prioridadeConfig.label}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Nova Tarefa */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-2xl font-bold">Nova Tarefa</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Título *
                </label>
                <input
                  type="text"
                  value={novaTarefa.titulo}
                  onChange={(e) => setNovaTarefa({ ...novaTarefa, titulo: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Follow-up com cliente"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descrição *
                </label>
                <textarea
                  value={novaTarefa.descricao}
                  onChange={(e) => setNovaTarefa({ ...novaTarefa, descricao: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Descreva a tarefa..."
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prioridade *
                  </label>
                  <select
                    value={novaTarefa.prioridade}
                    onChange={(e) => setNovaTarefa({ ...novaTarefa, prioridade: e.target.value as Prioridade })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="BAIXA">Baixa</option>
                    <option value="MEDIA">Média</option>
                    <option value="ALTA">Alta</option>
                    <option value="URGENTE">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estado *
                  </label>
                  <select
                    value={novaTarefa.estado}
                    onChange={(e) => setNovaTarefa({ ...novaTarefa, estado: e.target.value as Estado })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="PENDENTE">Pendente</option>
                    <option value="EM_ANDAMENTO">Em Andamento</option>
                    <option value="CONCLUIDA">Concluída</option>
                    <option value="CANCELADA">Cancelada</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Responsável *
                </label>
                <input
                  type="text"
                  value={novaTarefa.responsavel}
                  onChange={(e) => setNovaTarefa({ ...novaTarefa, responsavel: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nome do responsável"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cliente (Opcional)
                </label>
                <input
                  type="text"
                  value={novaTarefa.cliente}
                  onChange={(e) => setNovaTarefa({ ...novaTarefa, cliente: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nome do cliente"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data de Vencimento *
                </label>
                <input
                  type="date"
                  value={novaTarefa.data_vencimento}
                  onChange={(e) => setNovaTarefa({ ...novaTarefa, data_vencimento: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg font-medium transition-all disabled:opacity-60"
                  disabled={saving}
                >
                  {saving ? 'A criar...' : 'Criar Tarefa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
