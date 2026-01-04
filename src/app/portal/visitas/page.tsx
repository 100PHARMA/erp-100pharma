'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  X,
  Plus,
  Search,
  Edit3,
  Save,
  Ban,
  Navigation,
  MapPin,
  Receipt,
  BadgeCheck,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type EstadoVisita = 'AGENDADA' | 'REALIZADA' | 'CANCELADA';

const statusColors: Record<EstadoVisita, string> = {
  AGENDADA: 'bg-blue-100 text-blue-800',
  REALIZADA: 'bg-green-100 text-green-800',
  CANCELADA: 'bg-red-100 text-red-800',
};

const statusIcons: Record<EstadoVisita, any> = {
  AGENDADA: AlertCircle,
  REALIZADA: CheckCircle,
  CANCELADA: XCircle,
};

const statusLabels: Record<EstadoVisita, string> = {
  AGENDADA: 'Agendada',
  REALIZADA: 'Realizada',
  CANCELADA: 'Cancelada',
};

type ClienteRow = {
  id: string;
  nome: string;
};

type VisitaRow = {
  id: string;
  vendedor_id: string;
  cliente_id: string | null;
  data_visita: string;
  estado: EstadoVisita | null;
  notas: string | null;

  km_informado?: number | null;
  km_referencia?: number | null;
  concluida_em?: string | null;
  concluida_por?: string | null;

  created_at?: string | null;

  clientes?: { id: string; nome: string } | null;
};

type KmLancamentoRow = {
  id: string;
  visita_id: string;
  status: 'PENDENTE' | 'APROVADO' | 'PAGO' | string;
  km: number | null;
  valor_total: number | null;
};

function parseNum(str: string): number | null {
  if (!str) return null;
  const n = Number(String(str).replace(',', '.'));
  if (Number.isNaN(n)) return null;
  return n;
}

export default function PortalVisitasPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);

  const [vendedorId, setVendedorId] = useState<string | null>(null);
  const [vendedorEmail, setVendedorEmail] = useState<string | null>(null);

  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [visitas, setVisitas] = useState<VisitaRow[]>([]);
  const [kmLancMap, setKmLancMap] = useState<Record<string, KmLancamentoRow>>(
    {}
  );

  const [filterStatus, setFilterStatus] = useState<
    'TODOS' | 'AGENDADA' | 'REALIZADA' | 'CANCELADA'
  >('TODOS');
  const [busca, setBusca] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [visitaEditandoId, setVisitaEditandoId] = useState<string | null>(null);

  const [form, setForm] = useState<{
    cliente_id: string;
    data_visita: string;
    hora_inicio: string; // UI only
    hora_fim: string; // UI only
    objetivo: string; // vai em notas
    resultado: string; // vai em notas
    proxima_acao: string; // vai em notas
    km_informado: string;
    km_referencia: string;
  }>({
    cliente_id: '',
    data_visita: '',
    hora_inicio: '',
    hora_fim: '',
    objetivo: '',
    resultado: '',
    proxima_acao: '',
    km_informado: '',
    km_referencia: '',
  });

  // =========================================================
  // BOOTSTRAP: user -> perfis -> vendedor_id
  // =========================================================
  useEffect(() => {
  let cancelled = false;

  (async () => {
    setLoading(true); // ou setCarregando(true)

    try {
      const { data: uRes, error: userErr } = await supabase.auth.getUser();
      const user = uRes.user;

      if (userErr || !user) {
        router.push('/login');
        return;
      }

      if (!cancelled) setVendedorEmail(user.email ?? null);

      const { data: perfil, error: perfilErr } = await supabase
        .from('perfis')
        .select('role, vendedor_id')
        .eq('id', user.id)
        .maybeSingle();

      if (perfilErr) throw perfilErr;

      const role = String(perfil?.role ?? '').toUpperCase();
      if (role !== 'VENDEDOR') {
        router.push('/dashboard');
        return;
      }

      if (!perfil?.vendedor_id) {
        throw new Error('Seu perfil não possui vendedor_id. Ajuste em public.perfis.');
      }

      if (!cancelled) setVendedorId(perfil.vendedor_id);

      // CHAME A FUNÇÃO QUE VOCÊ JÁ TEM:
      // visitas: await carregarTudo(perfil.vendedor_id);
      // vendas:  await carregarDados(perfil.vendedor_id);
      await carregarTudo(perfil.vendedor_id); // ou carregarDados
    } catch (e: any) {
      console.error(e);
      alert('Erro no portal: ' + (e?.message ?? 'Erro'));
      router.push('/login');
    } finally {
      if (!cancelled) setLoading(false); // ou setCarregando(false)
    }
  })();

  return () => {
    cancelled = true;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);


  async function carregarTudo(vendId: string) {
    try {
      setLoading(true);

      // Clientes (por enquanto: todos). Se depois você quiser restringir por carteira, filtramos.
      const { data: clientesData, error: cErr } = await supabase
        .from('clientes')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (cErr) throw cErr;
      setClientes((clientesData ?? []) as any);

      // Visitas do vendedor
      const { data: visitasData, error: visErr } = await supabase
        .from('vendedor_visitas')
        .select(
          `
          id,
          vendedor_id,
          cliente_id,
          data_visita,
          estado,
          notas,
          km_informado,
          km_referencia,
          concluida_em,
          concluida_por,
          created_at,
          clientes (id, nome)
        `
        )
        .eq('vendedor_id', vendId)
        .order('data_visita', { ascending: false })
        .order('created_at', { ascending: false });

      if (visErr) throw visErr;

      const rows = (visitasData ?? []) as any as VisitaRow[];
      setVisitas(rows);

      // KM lançamentos dessas visitas (read-only para vendedor)
      const visitaIds = rows.map((r) => r.id);
      if (visitaIds.length > 0) {
        const { data: kmData, error: kmErr } = await supabase
          .from('vendedor_km_lancamentos')
          .select('id, visita_id, status, km, valor_total')
          .in('visita_id', visitaIds);

        if (kmErr) {
          // se der permissão negada por RLS, não quebra a página
          console.warn('Sem acesso a vendedor_km_lancamentos:', kmErr);
          setKmLancMap({});
        } else {
          const map: Record<string, KmLancamentoRow> = {};
          (kmData ?? []).forEach((k: any) => {
            map[k.visita_id] = k as KmLancamentoRow;
          });
          setKmLancMap(map);
        }
      } else {
        setKmLancMap({});
      }
    } catch (e: any) {
      console.error(e);
      alert('Erro ao carregar visitas (portal): ' + (e?.message ?? 'Erro'));
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({
      cliente_id: '',
      data_visita: '',
      hora_inicio: '',
      hora_fim: '',
      objetivo: '',
      resultado: '',
      proxima_acao: '',
      km_informado: '',
      km_referencia: '',
    });
    setModoEdicao(false);
    setVisitaEditandoId(null);
  }

  function buildNotas() {
    const parts: string[] = [];
    if (form.hora_inicio || form.hora_fim) {
      parts.push(`Horário: ${form.hora_inicio || '—'} - ${form.hora_fim || '—'}`);
    }
    if (form.objetivo) parts.push(`Objetivo: ${form.objetivo}`);
    if (form.resultado) parts.push(`Resultado: ${form.resultado}`);
    if (form.proxima_acao) parts.push(`Próxima ação: ${form.proxima_acao}`);
    return parts.join('\n');
  }

  function abrirModalNova() {
    resetForm();
    setShowModal(true);
  }

  function abrirModalEditar(visita: VisitaRow) {
    const estado = (visita.estado ?? 'AGENDADA') as EstadoVisita;

    if (estado !== 'AGENDADA') {
      alert('Só é permitido editar quando a visita está AGENDADA.');
      return;
    }

    setModoEdicao(true);
    setVisitaEditandoId(visita.id);

    setForm({
      cliente_id: visita.cliente_id ?? '',
      data_visita: visita.data_visita,
      hora_inicio: '',
      hora_fim: '',
      objetivo: visita.notas ?? '',
      resultado: '',
      proxima_acao: '',
      km_informado:
        visita.km_informado != null ? String(visita.km_informado) : '',
      km_referencia:
        visita.km_referencia != null ? String(visita.km_referencia) : '',
    });

    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!vendedorId) {
      alert('Vendedor não identificado. Faça login novamente.');
      return;
    }

    if (!form.cliente_id || !form.data_visita || !form.objetivo) {
      alert('Preencha: Cliente, Data e Objetivo.');
      return;
    }

    const kmInformado = parseNum(form.km_informado);
    const kmReferencia = parseNum(form.km_referencia);

    if (kmInformado != null && kmInformado < 0) {
      alert('KM informado não pode ser negativo.');
      return;
    }
    if (kmReferencia != null && kmReferencia < 0) {
      alert('KM referência não pode ser negativo.');
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const payload: any = {
        vendedor_id: vendedorId,
        cliente_id: form.cliente_id,
        data_visita: form.data_visita,
        estado: 'AGENDADA',
        notas: buildNotas(),
        km_informado: kmInformado,
        km_referencia: kmReferencia,
        origem: 'VENDEDOR',
        updated_by: user?.id ?? null,
      };

      if (modoEdicao && visitaEditandoId) {
        // segurança extra: só edita se ainda estiver AGENDADA
        const { error } = await supabase
          .from('vendedor_visitas')
          .update(payload)
          .eq('id', visitaEditandoId)
          .eq('vendedor_id', vendedorId)
          .eq('estado', 'AGENDADA');

        if (error) throw error;
        alert('Visita atualizada.');
      } else {
        payload.created_by = user?.id ?? null;

        const { error } = await supabase.from('vendedor_visitas').insert(payload);
        if (error) throw error;
        alert('Visita agendada.');
      }

      setShowModal(false);
      resetForm();
      await carregarTudo(vendedorId);
    } catch (e: any) {
      console.error(e);
      alert('Erro ao salvar visita: ' + (e?.message ?? 'Erro'));
    } finally {
      setLoading(false);
    }
  }

  async function concluirVisita(visita: VisitaRow) {
    if (!vendedorId) return;

    const estado = (visita.estado ?? 'AGENDADA') as EstadoVisita;
    if (estado !== 'AGENDADA') return;

    const km = visita.km_informado ?? null;
    if (km == null || Number(km) <= 0) {
      alert('Antes de concluir, preencha o KM informado (> 0).');
      return;
    }

    if (!confirm('Confirmar como REALIZADA? Isto vai gerar o lançamento de KM.')) return;

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('vendedor_visitas')
        .update({
          estado: 'REALIZADA',
          concluida_em: new Date().toISOString(),
          concluida_por: user?.id ?? null,
          updated_by: user?.id ?? null,
        })
        .eq('id', visita.id)
        .eq('vendedor_id', vendedorId)
        .eq('estado', 'AGENDADA');

      if (error) throw error;

      await carregarTudo(vendedorId);
      alert('Visita concluída. Lançamento de KM deve estar PENDENTE.');
    } catch (e: any) {
      console.error(e);
      alert('Erro ao concluir visita: ' + (e?.message ?? 'Erro'));
    } finally {
      setLoading(false);
    }
  }

  async function cancelarVisita(visita: VisitaRow) {
    if (!vendedorId) return;

    const estado = (visita.estado ?? 'AGENDADA') as EstadoVisita;
    if (estado !== 'AGENDADA') {
      alert('Só é permitido cancelar quando está AGENDADA.');
      return;
    }

    if (!confirm('Cancelar esta visita?')) return;

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('vendedor_visitas')
        .update({
          estado: 'CANCELADA',
          updated_by: user?.id ?? null,
        })
        .eq('id', visita.id)
        .eq('vendedor_id', vendedorId)
        .eq('estado', 'AGENDADA');

      if (error) throw error;

      await carregarTudo(vendedorId);
      alert('Visita cancelada.');
    } catch (e: any) {
      console.error(e);
      alert('Erro ao cancelar: ' + (e?.message ?? 'Erro'));
    } finally {
      setLoading(false);
    }
  }

  const visitasFiltradas = useMemo(() => {
    const term = busca.trim().toLowerCase();
    return visitas.filter((v) => {
      const estado = (v.estado ?? 'AGENDADA') as EstadoVisita;
      const matchStatus = filterStatus === 'TODOS' || estado === filterStatus;

      const clienteNome = (v.clientes?.nome ?? '').toLowerCase();
      const notas = (v.notas ?? '').toLowerCase();

      const matchBusca = !term || clienteNome.includes(term) || notas.includes(term);
      return matchStatus && matchBusca;
    });
  }, [visitas, filterStatus, busca]);

  const stats = useMemo(() => {
    const total = visitas.length;
    const agendadas = visitas.filter((v) => (v.estado ?? 'AGENDADA') === 'AGENDADA').length;
    const realizadas = visitas.filter((v) => (v.estado ?? 'AGENDADA') === 'REALIZADA').length;
    const totalKm = visitas
      .filter((v) => (v.estado ?? 'AGENDADA') === 'REALIZADA')
      .reduce((acc, v) => acc + Number(v.km_informado ?? 0), 0);
    return { total, agendadas, realizadas, totalKm };
  }, [visitas]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
          <p className="text-gray-600">Carregando visitas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1">
              Minhas Visitas
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Você está logado como <span className="font-semibold">{vendedorEmail ?? 'vendedor'}</span>
            </p>
          </div>
          <button
            onClick={abrirModalNova}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-[1.02]"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">Agendar Visita</span>
          </button>
        </div>
      </div>

      {/* Busca + filtros */}
      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por cliente ou notas..."
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(['TODOS', 'AGENDADA', 'REALIZADA', 'CANCELADA'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                  filterStatus === status
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status === 'TODOS' ? 'Todas' : statusLabels[status]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-100 p-2 rounded-lg">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm text-gray-600">Total</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.total}</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-orange-100 p-2 rounded-lg">
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </div>
            <span className="text-sm text-gray-600">Agendadas</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-orange-600">{stats.agendadas}</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-green-100 p-2 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm text-gray-600">Realizadas</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-green-600">{stats.realizadas}</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-purple-100 p-2 rounded-lg">
              <Navigation className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm text-gray-600">Total KM (realizadas)</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-purple-600">
            {stats.totalKm.toLocaleString('pt-PT')}
          </p>
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-4">
        {visitasFiltradas.map((visita) => {
          const estado = (visita.estado ?? 'AGENDADA') as EstadoVisita;
          const StatusIcon = statusIcons[estado];

          const kmLanc = kmLancMap[visita.id];

          return (
            <div key={visita.id} className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <MapPin className="w-5 h-5 text-blue-600" />
                    </div>

                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 mb-1">
                        {visita.clientes?.nome ?? '—'}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Data: {new Date(visita.data_visita).toLocaleDateString('pt-PT')}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${statusColors[estado]}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {statusLabels[estado]}
                      </span>

                      {kmLanc?.status && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
                          <Receipt className="w-3 h-3" />
                          KM: {kmLanc.status}
                          {kmLanc.valor_total != null
                            ? ` (€${Number(kmLanc.valor_total).toFixed(2)})`
                            : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Navigation className="w-4 h-4" />
                      <span>
                        KM informado:{' '}
                        <span className="font-semibold text-gray-900">
                          {Number(visita.km_informado ?? 0).toLocaleString('pt-PT')} km
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <BadgeCheck className="w-4 h-4" />
                      <span>
                        KM ref.:{' '}
                        <span className="font-semibold text-gray-900">
                          {Number(visita.km_referencia ?? 0).toLocaleString('pt-PT')} km
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>
                        Concluída:{' '}
                        <span className="font-semibold text-gray-900">
                          {visita.concluida_em
                            ? new Date(visita.concluida_em).toLocaleString('pt-PT')
                            : '—'}
                        </span>
                      </span>
                    </div>
                  </div>

                  {visita.notas ? (
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-gray-600 mb-1">Notas</p>
                      <pre className="text-sm text-gray-900 whitespace-pre-wrap font-sans">
                        {visita.notas}
                      </pre>
                    </div>
                  ) : (
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-sm text-gray-600">Sem notas.</p>
                    </div>
                  )}
                </div>

                {/* Ações */}
                <div className="flex flex-row lg:flex-col gap-2 justify-end">
                  {estado === 'AGENDADA' && (
                    <>
                      <button
                        onClick={() => abrirModalEditar(visita)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold text-sm"
                      >
                        <Edit3 className="w-4 h-4" />
                        Editar
                      </button>

                      <button
                        onClick={() => concluirVisita(visita)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold text-sm"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Concluir
                      </button>

                      <button
                        onClick={() => cancelarVisita(visita)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-sm"
                      >
                        <Ban className="w-4 h-4" />
                        Cancelar
                      </button>
                    </>
                  )}

                  {estado !== 'AGENDADA' && (
                    <div className="text-xs text-gray-500 max-w-[220px]">
                      Esta visita não está AGENDADA. Edição bloqueada.
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {visitasFiltradas.length === 0 && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center mt-6">
          <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Nenhuma visita encontrada</p>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-6 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-2xl font-bold">
                {modoEdicao ? 'Editar Visita' : 'Agendar Nova Visita'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cliente/Farmácia *
                </label>
                <select
                  value={form.cliente_id}
                  onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Selecione...</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data da Visita *
                </label>
                <input
                  type="date"
                  value={form.data_visita}
                  onChange={(e) => setForm({ ...form, data_visita: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Horas (UI apenas) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hora Início (opcional)
                  </label>
                  <input
                    type="time"
                    value={form.hora_inicio}
                    onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hora Fim (opcional)
                  </label>
                  <input
                    type="time"
                    value={form.hora_fim}
                    onChange={(e) => setForm({ ...form, hora_fim: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* KM */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    KM informado
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={form.km_informado}
                    onChange={(e) => setForm({ ...form, km_informado: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: 15"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Para concluir como REALIZADA, precisa ser &gt; 0.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    KM referência (opcional)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={form.km_referencia}
                    onChange={(e) => setForm({ ...form, km_referencia: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: 15"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Objetivo *
                </label>
                <textarea
                  value={form.objetivo}
                  onChange={(e) => setForm({ ...form, objetivo: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={4}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Resultado (opcional)
                  </label>
                  <textarea
                    value={form.resultado}
                    onChange={(e) => setForm({ ...form, resultado: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Próxima ação (opcional)
                  </label>
                  <textarea
                    value={form.proxima_acao}
                    onChange={(e) => setForm({ ...form, proxima_acao: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
                >
                  Fechar
                </button>

                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:shadow-lg font-semibold transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  {modoEdicao ? 'Salvar alterações' : 'Agendar visita'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
