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
  Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Prioridade = 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';
type Estado = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA';

interface Vendedor {
  id: string;
  nome: string;
  email?: string | null;
}

interface Cliente {
  id: string;
  nome: string;
  tipo?: string | null;
}

interface TarefaRow {
  id: string;
  titulo: string;
  descricao: string;
  prioridade: Prioridade;
  estado: Estado;
  responsavel_vendedor_id: string | null;
  cliente_id: string | null;
  data_vencimento: string; // YYYY-MM-DD
  created_at?: string;
  updated_at?: string;
}

interface TarefaUI extends TarefaRow {
  responsavel_nome?: string;
  cliente_nome?: string;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function TarefasPage() {
  const [carregando, setCarregando] = useState(true);

  const [tarefas, setTarefas] = useState<TarefaUI[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS');
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>('TODOS');

  const [showModal, setShowModal] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [novaTarefa, setNovaTarefa] = useState<{
    titulo: string;
    descricao: string;
    prioridade: Prioridade;
    responsavel_vendedor_id: string;
    cliente_id: string;
    data_vencimento: string;
    estado: Estado;
  }>({
    titulo: '',
    descricao: '',
    prioridade: 'MEDIA',
    responsavel_vendedor_id: '',
    cliente_id: '',
    data_vencimento: '',
    estado: 'PENDENTE',
  });

  // =========================================================
  // LOAD
  // =========================================================
  useEffect(() => {
    carregarTudo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const carregarTudo = async () => {
    try {
      setCarregando(true);

      const [tarefasRes, vendedoresRes, clientesRes] = await Promise.all([
        supabase
          .from('tarefas')
          .select(
            'id,titulo,descricao,prioridade,estado,responsavel_vendedor_id,cliente_id,data_vencimento,created_at,updated_at'
          )
          .order('data_vencimento', { ascending: true })
          .order('created_at', { ascending: false }),

        supabase.from('vendedores').select('id,nome,email').order('nome'),

        supabase.from('clientes').select('id,nome,tipo').order('nome'),
      ]);

      if (tarefasRes.error) throw tarefasRes.error;
      if (vendedoresRes.error) throw vendedoresRes.error;
      if (clientesRes.error) throw clientesRes.error;

      const vend = (vendedoresRes.data || []) as Vendedor[];
      const cli = (clientesRes.data || []) as Cliente[];
      setVendedores(vend);
      setClientes(cli);

      const vendMap = new Map(vend.map((v) => [v.id, v.nome]));
      const cliMap = new Map(cli.map((c) => [c.id, c.nome]));

      const rows = ((tarefasRes.data || []) as any as TarefaRow[]).map((t) => ({
        ...t,
        responsavel_nome: t.responsavel_vendedor_id
          ? vendMap.get(t.responsavel_vendedor_id) ?? undefined
          : undefined,
        cliente_nome: t.cliente_id ? cliMap.get(t.cliente_id) ?? undefined : undefined,
      }));

      setTarefas(rows);
    } catch (e: any) {
      console.error('Erro ao carregar tarefas:', e);
      alert('Erro ao carregar tarefas: ' + (e?.message ?? 'Erro desconhecido'));
    } finally {
      setCarregando(false);
    }
  };

  // =========================================================
  // CREATE
  // =========================================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!novaTarefa.titulo.trim() || !novaTarefa.descricao.trim() || !novaTarefa.data_vencimento) {
      alert('Preencha Título, Descrição e Data de Vencimento.');
      return;
    }

    try {
      setSalvando(true);

      const payload = {
        titulo: novaTarefa.titulo.trim(),
        descricao: novaTarefa.descricao.trim(),
        prioridade: novaTarefa.prioridade,
        estado: novaTarefa.estado,
        data_vencimento: novaTarefa.data_vencimento,
        responsavel_vendedor_id: novaTarefa.responsavel_vendedor_id || null,
        cliente_id: novaTarefa.cliente_id || null,
      };

      const { error } = await supabase.from('tarefas').insert(payload);
      if (error) throw error;

      setShowModal(false);
      setNovaTarefa({
        titulo: '',
        descricao: '',
        prioridade: 'MEDIA',
        responsavel_vendedor_id: '',
        cliente_id: '',
        data_vencimento: '',
        estado: 'PENDENTE',
      });

      await carregarTudo();
    } catch (e: any) {
      console.error('Erro ao criar tarefa:', e);
      alert('Erro ao criar tarefa: ' + (e?.message ?? 'Erro desconhecido'));
    } finally {
      setSalvando(false);
    }
  };

  // =========================================================
  // HELPERS UI
  // =========================================================
  const getPrioridadeConfig = (prioridade: Prioridade) => {
    const configs = {
      BAIXA: { color: 'bg-gray-100 text-gray-700', label: 'Baixa' },
      MEDIA: { color: 'bg-blue-100 text-blue-700', label: 'Média' },
      ALTA: { color: 'bg-orange-100 text-orange-700', label: 'Alta' },
      URGENTE: { color: 'bg-red-100 text-red-700', label: 'Urgente' },
    };
    return configs[prioridade] || configs.MEDIA;
  };

  const getEstadoConfig = (estado: Estado) => {
    const configs = {
      PENDENTE: { color: 'bg-yellow-100 text-yellow-700', icon: Clock, label: 'Pendente' },
      EM_ANDAMENTO: { color: 'bg-blue-100 text-blue-700', icon: AlertCircle, label: 'Em Andamento' },
      CONCLUIDA: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Concluída' },
      CANCELADA: { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Cancelada' },
    };
    return configs[estado] || configs.PENDENTE;
  };

  const filteredTarefas = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return tarefas.filter((t) => {
      const matchSearch =
        !term ||
        t.titulo.toLowerCase().includes(term) ||
        t.descricao.toLowerCase().includes(term) ||
        (t.cliente_nome ? t.cliente_nome.toLowerCase().includes(term) : false) ||
        (t.responsavel_nome ? t.responsavel_nome.toLowerCase().includes(term) : false);

      const matchEstado = filtroEstado === 'TODOS' || t.estado === filtroEstado;
      const matchPrioridade = filtroPrioridade === 'TODOS' || t.prioridade === filtroPrioridade;

      return matchSearch && matchEstado && matchPrioridade;
    });
  }, [tarefas, searchTerm, filtroEstado, filtroPrioridade]);

  const stats = useMemo(() => {
    const pendentes = tarefas.filter((t) => t.estado === 'PENDENTE').length;
    const emAndamento = tarefas.filter((t) => t.estado === 'EM_ANDAMENTO').length;
    const concluidas = tarefas.filter((t) => t.estado === 'CONCLUIDA').length;
    return { total: tarefas.length, pendentes, emAndamento, concluidas };
  }, [tarefas]);

  // =========================================================
  // LOADING
  // =========================================================
  if (carregando) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando tarefas...</p>
        </div>
      </div>
    );
  }

  // =========================================================
  // UI
  // =========================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Agenda e Tarefas</h1>
            <p className="text-gray-600 mt-1">Gestão de tarefas e compromissos</p>
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
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
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
                <p className="text-2xl font-bold text-gray-900">{stats.pendentes}</p>
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
                <p className="text-2xl font-bold text-gray-900">{stats.emAndamento}</p>
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
                <p className="text-2xl font-bold text-gray-900">{stats.concluidas}</p>
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

        {/* List */}
        <div className="grid grid-cols-1 gap-4">
          {filteredTarefas.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-10 text-center text-gray-600">
              Nenhuma tarefa encontrada com os filtros atuais.
            </div>
          ) : (
            filteredTarefas.map((tarefa) => {
              const prioridadeConfig = getPrioridadeConfig(tarefa.prioridade);
              const estadoConfig = getEstadoConfig(tarefa.estado);
              const EstadoIcon = estadoConfig.icon;

              return (
                <div key={tarefa.id} className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{tarefa.titulo}</h3>
                        <p className="text-sm text-gray-600 mt-1">{tarefa.descricao}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">Responsável:</span>
                          <span className="font-medium text-gray-900">
                            {tarefa.responsavel_nome || '—'}
                          </span>
                        </div>

                        {tarefa.cliente_nome && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600">Cliente:</span>
                            <span className="font-medium text-gray-900">{tarefa.cliente_nome}</span>
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
                      <span className={cx(
                        'inline-flex items-center justify-center gap-1 px-3 py-1 rounded-full text-xs font-medium',
                        estadoConfig.color
                      )}>
                        <EstadoIcon className="w-3 h-3" />
                        {estadoConfig.label}
                      </span>

                      <span className={cx(
                        'inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-medium',
                        prioridadeConfig.color
                      )}>
                        {prioridadeConfig.label}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal */}
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Título *</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Descrição *</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Prioridade *</label>
                  <select
                    value={novaTarefa.prioridade}
                    onChange={(e) =>
                      setNovaTarefa({ ...novaTarefa, prioridade: e.target.value as Prioridade })
                    }
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Estado *</label>
                  <select
                    value={novaTarefa.estado}
                    onChange={(e) =>
                      setNovaTarefa({ ...novaTarefa, estado: e.target.value as Estado })
                    }
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Responsável (vendedor)</label>
                  <select
                    value={novaTarefa.responsavel_vendedor_id}
                    onChange={(e) =>
                      setNovaTarefa({ ...novaTarefa, responsavel_vendedor_id: e.target.value })
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">— Sem responsável —</option>
                    {vendedores.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.nome}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-2">
                    Depois vamos expandir para funcionários/cargos. Agora é vendedor para integrar rápido com o /portal.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cliente (opcional)</label>
                  <select
                    value={novaTarefa.cliente_id}
                    onChange={(e) => setNovaTarefa({ ...novaTarefa, cliente_id: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">— Sem cliente —</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}{c.tipo ? ` — ${c.tipo}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data de Vencimento *</label>
                <input
                  type="date"
                  value={novaTarefa.data_vencimento}
                  onChange={(e) =>
                    setNovaTarefa({ ...novaTarefa, data_vencimento: e.target.value })
                  }
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
                  disabled={salvando}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg font-medium transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {salvando ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    'Criar Tarefa'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
