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
  Pencil,
  RefreshCcw,
} from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type Prioridade = 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';
type Estado = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA';

type VendedorMini = { id: string; nome: string };
type ClienteMini = { id: string; nome: string };

type TarefaRow = {
  id: string;
  titulo: string;
  descricao: string;
  prioridade: Prioridade;
  estado: Estado;
  responsavel_vendedor_id: string | null;
  cliente_id: string | null;
  data_vencimento: string; // date (YYYY-MM-DD)
  created_at: string;
  updated_at: string;

  responsavel?: { nome: string } | null;
  cliente?: { nome: string } | null;
};

type ModalMode = 'create' | 'edit';

type Props = {
  userId: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function TarefasClient({ userId: _userId }: Props) {
  // _userId vem do SSR (fonte de verdade). Não usamos para "validar login" no client.
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS');
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>('TODOS');

  const [tarefas, setTarefas] = useState<TarefaRow[]>([]);
  const [vendedores, setVendedores] = useState<VendedorMini[]>([]);
  const [clientes, setClientes] = useState<ClienteMini[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<ModalMode>('create');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    titulo: '',
    descricao: '',
    prioridade: 'MEDIA' as Prioridade,
    estado: 'PENDENTE' as Estado,
    responsavel_vendedor_id: '' as string,
    cliente_id: '' as string,
    data_vencimento: '',
  });

  function resetForm() {
    setForm({
      titulo: '',
      descricao: '',
      prioridade: 'MEDIA',
      estado: 'PENDENTE',
      responsavel_vendedor_id: '',
      cliente_id: '',
      data_vencimento: '',
    });
    setEditingId(null);
    setMode('create');
  }

  function openCreate() {
    resetForm();
    setShowModal(true);
  }

  function openEdit(t: TarefaRow) {
    setMode('edit');
    setEditingId(t.id);
    setForm({
      titulo: t.titulo ?? '',
      descricao: t.descricao ?? '',
      prioridade: t.prioridade,
      estado: t.estado,
      responsavel_vendedor_id: t.responsavel_vendedor_id ?? '',
      cliente_id: t.cliente_id ?? '',
      data_vencimento: t.data_vencimento ?? '',
    });
    setShowModal(true);
  }

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
    const configs: Record<Estado, { color: string; icon: any; label: string }> = {
      PENDENTE: { color: 'bg-yellow-100 text-yellow-700', icon: Clock, label: 'Pendente' },
      EM_ANDAMENTO: { color: 'bg-blue-100 text-blue-700', icon: AlertCircle, label: 'Em Andamento' },
      CONCLUIDA: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Concluída' },
      CANCELADA: { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Cancelada' },
    };
    return configs[estado];
  };

  async function loadLookups() {
    const vendRes = await supabase
      .from('vendedores')
      .select('id,nome')
      .order('nome', { ascending: true });

    if (!vendRes.error) setVendedores((vendRes.data ?? []) as VendedorMini[]);

    const cliRes = await supabase
      .from('clientes')
      .select('id,nome')
      .order('nome', { ascending: true })
      .limit(500);

    if (!cliRes.error) setClientes((cliRes.data ?? []) as ClienteMini[]);
  }

  async function loadTarefas() {
    setLoading(true);
    setErro(null);

    const { data, error } = await supabase
      .from('tarefas')
      .select(
        `
        id,
        titulo,
        descricao,
        prioridade,
        estado,
        responsavel_vendedor_id,
        cliente_id,
        data_vencimento,
        created_at,
        updated_at,
        responsavel:vendedores!tarefas_responsavel_vendedor_id_fkey ( nome ),
        cliente:clientes!tarefas_cliente_id_fkey ( nome )
      `
      )
      .order('data_vencimento', { ascending: true });

    if (error) {
      setErro(error.message);
      setTarefas([]);
      setLoading(false);
      return;
    }

    setTarefas((data ?? []) as TarefaRow[]);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      await loadLookups();
      await loadTarefas();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!form.titulo.trim() || !form.descricao.trim() || !form.data_vencimento) {
      setErro('Preencha Título, Descrição e Data de Vencimento.');
      return;
    }

    setSaving(true);

    const payload = {
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim(),
      prioridade: form.prioridade,
      estado: form.estado,
      data_vencimento: form.data_vencimento,
      responsavel_vendedor_id: form.responsavel_vendedor_id ? form.responsavel_vendedor_id : null,
      cliente_id: form.cliente_id ? form.cliente_id : null,
    };

    try {
      if (mode === 'create') {
        const { error } = await supabase.from('tarefas').insert(payload);
        if (error) throw error;
      } else {
        if (!editingId) throw new Error('ID da tarefa não encontrado para edição.');
        const { error } = await supabase.from('tarefas').update(payload).eq('id', editingId);
        if (error) throw error;
      }

      setShowModal(false);
      resetForm();
      await loadTarefas();
    } catch (err: any) {
      setErro(err?.message || 'Falha ao salvar tarefa.');
    } finally {
      setSaving(false);
    }
  }

  const filteredTarefas = tarefas.filter((t) => {
    const titulo = String(t.titulo ?? '').toLowerCase();
    const desc = String(t.descricao ?? '').toLowerCase();
    const cli = String(t.cliente?.nome ?? '').toLowerCase();
    const resp = String(t.responsavel?.nome ?? '').toLowerCase();

    const matchSearch =
      titulo.includes(searchTerm.toLowerCase()) ||
      desc.includes(searchTerm.toLowerCase()) ||
      cli.includes(searchTerm.toLowerCase()) ||
      resp.includes(searchTerm.toLowerCase());

    const matchEstado = filtroEstado === 'TODOS' || t.estado === filtroEstado;
    const matchPrioridade = filtroPrioridade === 'TODOS' || t.prioridade === filtroPrioridade;

    return matchSearch && matchEstado && matchPrioridade;
  });

  const tarefasPendentes = tarefas.filter((t) => t.estado === 'PENDENTE').length;
  const tarefasEmAndamento = tarefas.filter((t) => t.estado === 'EM_ANDAMENTO').length;
  const tarefasConcluidas = tarefas.filter((t) => t.estado === 'CONCLUIDA').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Agenda e Tarefas</h1>
            <p className="text-gray-600 mt-1">Gestão de tarefas e compromissos</p>
            {erro && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {erro}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadTarefas()}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white border border-gray-200 hover:bg-gray-50"
              title="Recarregar"
            >
              <RefreshCcw className="w-5 h-5" />
              Recarregar
            </button>

            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-[1.02]"
            >
              <Plus className="w-5 h-5" />
              Nova Tarefa
            </button>
          </div>
        </div>

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

        <div className="grid grid-cols-1 gap-4">
          {loading ? (
            <div className="text-center text-gray-600 py-12">Carregando tarefas...</div>
          ) : filteredTarefas.length === 0 ? (
            <div className="text-center text-gray-600 py-12">Nenhuma tarefa encontrada.</div>
          ) : (
            filteredTarefas.map((tarefa) => {
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

                        <button
                          onClick={() => openEdit(tarefa)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                          Editar
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">Responsável:</span>
                          <span className="font-medium text-gray-900">{tarefa.responsavel?.nome ?? '—'}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">Cliente:</span>
                          <span className="font-medium text-gray-900">{tarefa.cliente?.nome ?? '—'}</span>
                        </div>

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
                        className={cx(
                          'inline-flex items-center justify-center gap-1 px-3 py-1 rounded-full text-xs font-medium',
                          estadoConfig.color
                        )}
                      >
                        <EstadoIcon className="w-3 h-3" />
                        {estadoConfig.label}
                      </span>

                      <span
                        className={cx(
                          'inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-medium',
                          prioridadeConfig.color
                        )}
                      >
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

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-2xl font-bold">{mode === 'create' ? 'Nova Tarefa' : 'Editar Tarefa'}</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={onSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Título *</label>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Descrição *</label>
                <textarea
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Prioridade *</label>
                  <select
                    value={form.prioridade}
                    onChange={(e) => setForm({ ...form, prioridade: e.target.value as Prioridade })}
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
                    value={form.estado}
                    onChange={(e) => setForm({ ...form, estado: e.target.value as Estado })}
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Responsável (Vendedor)</label>
                  <select
                    value={form.responsavel_vendedor_id}
                    onChange={(e) => setForm({ ...form, responsavel_vendedor_id: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">—</option>
                    {vendedores.map((v) => (
                      <option key={v.id} value={v.id}>{v.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cliente</label>
                  <select
                    value={form.cliente_id}
                    onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">—</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data de Vencimento *</label>
                <input
                  type="date"
                  value={form.data_vencimento}
                  onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
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
                  {saving ? 'A guardar...' : mode === 'create' ? 'Criar Tarefa' : 'Guardar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
