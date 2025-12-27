'use client';

import { useState } from 'react';
import { Calendar, Plus, Search, CheckCircle, Clock, AlertCircle, XCircle, X } from 'lucide-react';

interface Tarefa {
  id: string;
  titulo: string;
  descricao: string;
  prioridade: 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';
  responsavel: string;
  cliente?: string;
  dataVencimento: string;
  estado: 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA';
}

export default function TarefasPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS');
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>('TODOS');
  const [showModal, setShowModal] = useState(false);
  const [novaTarefa, setNovaTarefa] = useState({
    titulo: '',
    descricao: '',
    prioridade: 'MEDIA' as 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE',
    responsavel: '',
    cliente: '',
    dataVencimento: '',
    estado: 'PENDENTE' as 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA',
  });

  const [tarefas, setTarefas] = useState<Tarefa[]>([
    {
      id: '1',
      titulo: 'Follow-up Farmácia Central',
      descricao: 'Ligar para confirmar recebimento do pedido',
      prioridade: 'ALTA',
      responsavel: 'João Silva',
      cliente: 'Farmácia Central de Lisboa',
      dataVencimento: '2024-03-25',
      estado: 'PENDENTE',
    },
    {
      id: '2',
      titulo: 'Apresentação de novos produtos',
      descricao: 'Agendar reunião para apresentar linha 100FUNGO',
      prioridade: 'MEDIA',
      responsavel: 'Maria Santos',
      cliente: 'Farmácia São João',
      dataVencimento: '2024-03-28',
      estado: 'EM_ANDAMENTO',
    },
    {
      id: '3',
      titulo: 'Relatório mensal de vendas',
      descricao: 'Preparar relatório consolidado de março',
      prioridade: 'URGENTE',
      responsavel: 'Ana Costa',
      dataVencimento: '2024-03-31',
      estado: 'PENDENTE',
    },
    {
      id: '4',
      titulo: 'Visita técnica - Clínica Podológica',
      descricao: 'Demonstração de produtos e negociação',
      prioridade: 'ALTA',
      responsavel: 'João Silva',
      cliente: 'Clínica Podológica Saúde dos Pés',
      dataVencimento: '2024-03-26',
      estado: 'CONCLUIDA',
    },
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaTarefa.titulo || !novaTarefa.descricao || !novaTarefa.responsavel || !novaTarefa.dataVencimento) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    const tarefa: Tarefa = {
      id: (tarefas.length + 1).toString(),
      ...novaTarefa,
    };

    setTarefas([...tarefas, tarefa]);
    setShowModal(false);
    setNovaTarefa({
      titulo: '',
      descricao: '',
      prioridade: 'MEDIA',
      responsavel: '',
      cliente: '',
      dataVencimento: '',
      estado: 'PENDENTE',
    });
  };

  const getPrioridadeConfig = (prioridade: string) => {
    const configs = {
      BAIXA: { color: 'bg-gray-100 text-gray-700', label: 'Baixa' },
      MEDIA: { color: 'bg-blue-100 text-blue-700', label: 'Média' },
      ALTA: { color: 'bg-orange-100 text-orange-700', label: 'Alta' },
      URGENTE: { color: 'bg-red-100 text-red-700', label: 'Urgente' },
    };
    return configs[prioridade as keyof typeof configs] || configs.MEDIA;
  };

  const getEstadoConfig = (estado: string) => {
    const configs = {
      PENDENTE: { color: 'bg-yellow-100 text-yellow-700', icon: Clock, label: 'Pendente' },
      EM_ANDAMENTO: { color: 'bg-blue-100 text-blue-700', icon: AlertCircle, label: 'Em Andamento' },
      CONCLUIDA: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Concluída' },
      CANCELADA: { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Cancelada' },
    };
    return configs[estado as keyof typeof configs] || configs.PENDENTE;
  };

  const filteredTarefas = tarefas.filter(t => {
    const matchSearch = t.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       t.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       (t.cliente && t.cliente.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchEstado = filtroEstado === 'TODOS' || t.estado === filtroEstado;
    const matchPrioridade = filtroPrioridade === 'TODOS' || t.prioridade === filtroPrioridade;
    return matchSearch && matchEstado && matchPrioridade;
  });

  const tarefasPendentes = tarefas.filter(t => t.estado === 'PENDENTE').length;
  const tarefasEmAndamento = tarefas.filter(t => t.estado === 'EM_ANDAMENTO').length;
  const tarefasConcluidas = tarefas.filter(t => t.estado === 'CONCLUIDA').length;

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
              onChange={(e) => setFiltroEstado(e.target.value)}
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
              onChange={(e) => setFiltroPrioridade(e.target.value)}
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
              <div key={tarefa.id} className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
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
                          {new Date(tarefa.dataVencimento).toLocaleDateString('pt-PT')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className={`inline-flex items-center justify-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${estadoConfig.color}`}>
                      <EstadoIcon className="w-3 h-3" />
                      {estadoConfig.label}
                    </span>
                    <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-medium ${prioridadeConfig.color}`}>
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
                    onChange={(e) => setNovaTarefa({ ...novaTarefa, prioridade: e.target.value as any })}
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
                    onChange={(e) => setNovaTarefa({ ...novaTarefa, estado: e.target.value as any })}
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
                  value={novaTarefa.dataVencimento}
                  onChange={(e) => setNovaTarefa({ ...novaTarefa, dataVencimento: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg font-medium transition-all"
                >
                  Criar Tarefa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
