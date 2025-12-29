// src/app/(admin)/visitas/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  MapPin,
  Calendar,
  Clock,
  Navigation,
  CheckCircle,
  XCircle,
  AlertCircle,
  X,
  Plus,
  Search,
  Edit3,
  Save,
  Ban,
  BadgeCheck,
  Receipt,
  Lock,
} from 'lucide-react';
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

type ClienteRow = { id: string; nome: string };

type VendedorRow = {
  id: string;
  nome: string;
  email?: string | null;
};

type VisitaRow = {
  id: string;
  vendedor_id: string;
  cliente_id: string | null;
  data_visita: string; // date
  estado: EstadoVisita | null;
  notas: string | null;

  km_informado?: number | null;
  km_referencia?: number | null;
  concluida_em?: string | null;
  concluida_por?: string | null;

  created_at?: string | null;

  clientes?: { id: string; nome: string } | null;
  vendedores?: { id: string; nome: string; email?: string | null } | null;
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

function buildNotas(params: {
  hora_inicio?: string;
  hora_fim?: string;
  objetivo?: string;
  resultado?: string;
  proxima_acao?: string;
}) {
  const parts: string[] = [];
  if (params.hora_inicio || params.hora_fim) {
    parts.push(`Horário: ${params.hora_inicio || '—'} - ${params.hora_fim || '—'}`);
  }
  if (params.objetivo) parts.push(`Objetivo: ${params.objetivo}`);
  if (params.resultado) parts.push(`Resultado: ${params.resultado}`);
  if (params.proxima_acao) parts.push(`Próxima ação: ${params.proxima_acao}`);
  return parts.join('\n');
}

export default function VisitasPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);

  const [filterStatus, setFilterStatus] = useState<'TODOS' | EstadoVisita>('TODOS');
  const [busca, setBusca] = useState('');

  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [vendedores, setVendedores] = useState<VendedorRow[]>([]);
  const [visitas, setVisitas] = useState<VisitaRow[]>([]);

  // map visita_id -> km_lancamento (último/único)
  const [kmLancMap, setKmLancMap] = useState<Record<string, KmLancamentoRow>>({});

  // Se falhar leitura por RLS, guardamos para saber que não podemos “confiar” no bloqueio por PAGO
  const [kmLancReadFailed, setKmLancReadFailed] = useState(false);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [visitaEditandoId, setVisitaEditandoId] = useState<string | null>(null);
  const [visitaEditandoOriginal, setVisitaEditandoOriginal] = useState<VisitaRow | null>(null);

  const [form, setForm] = useState<{
    vendedor_id: string;
    cliente_id: string;
    data_visita: string;

    hora_inicio: string; // UI only
    hora_fim: string; // UI only

    objetivo: string;
    resultado: string;
    proxima_acao: string;

    km_informado: string;
    km_referencia: string;

    // Dropdown apenas para AGENDADA/CANCELADA (REALIZADA só via concluir)
    estado: 'AGENDADA' | 'CANCELADA';
  }>({
    vendedor_id: '',
    cliente_id: '',
    data_visita: '',
    hora_inicio: '',
    hora_fim: '',
    objetivo: '',
    resultado: '',
    proxima_acao: '',
    km_informado: '',
    km_referencia: '',
    estado: 'AGENDADA',
  });

  useEffect(() => {
    (async () => {
      await carregarTudo();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function carregarTudo() {
    setLoading(true);
    try {
      const { data: clientesData, error: cErr } = await supabase
        .from('clientes')
        .select('id, nome')
        .order('nome', { ascending: true });
      if (cErr) throw cErr;
      setClientes((clientesData ?? []) as any);

      const { data: vendedoresData, error: vErr } = await supabase
        .from('vendedores')
        .select('id, nome, email')
        .order('nome', { ascending: true });
      if (vErr) throw vErr;
      setVendedores((vendedoresData ?? []) as any);

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
          clientes (id, nome),
          vendedores (id, nome, email)
        `
        )
        .order('data_visita', { ascending: false })
        .order('created_at', { ascending: false });
      if (visErr) throw visErr;

      const rows = (visitasData ?? []) as any as VisitaRow[];
      setVisitas(rows);

      const visitaIds = rows.map((r) => r.id);
      if (visitaIds.length > 0) {
        const { data: kmData, error: kmErr } = await supabase
          .from('vendedor_km_lancamentos')
          .select('id, visita_id, status, km, valor_total')
          .in('visita_id', visitaIds);

        if (kmErr) {
          console.warn('Aviso: não consegui ler vendedor_km_lancamentos:', kmErr);
          setKmLancReadFailed(true);
          setKmLancMap({});
        } else {
          setKmLancReadFailed(false);
          const map: Record<string, KmLancamentoRow> = {};
          (kmData ?? []).forEach((k: any) => {
            map[k.visita_id] = k as KmLancamentoRow;
          });
          setKmLancMap(map);
        }
      } else {
        setKmLancReadFailed(false);
        setKmLancMap({});
      }
    } catch (e: any) {
      console.error(e);
      alert('Erro ao carregar visitas: ' + (e?.message ?? 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({
      vendedor_id: '',
      cliente_id: '',
      data_visita: '',
      hora_inicio: '',
      hora_fim: '',
      objetivo: '',
      resultado: '',
      proxima_acao: '',
      km_informado: '',
      km_referencia: '',
      estado: 'AGENDADA',
    });
    setModoEdicao(false);
    setVisitaEditandoId(null);
    setVisitaEditandoOriginal(null);
  }

  function abrirModalNova() {
    resetForm();
    setShowModal(true);
  }

  function isPago(visitaId: string) {
    const lanc = kmLancMap[visitaId];
    return (lanc?.status ?? '').toUpperCase() === 'PAGO';
  }

  function canEditVisita(visita: VisitaRow) {
    // Regra: bloqueia apenas se KM estiver PAGO
    // Se não conseguimos ler km_lancamentos (RLS), não dá para afirmar que é PAGO -> não bloqueia aqui.
    if (!kmLancReadFailed && isPago(visita.id)) return false;
    return true;
  }

  function abrirModalEditar(visita: VisitaRow) {
    if (!canEditVisita(visita)) {
      alert('Edição bloqueada: esta visita tem lançamento de KM com estado PAGO.');
      return;
    }

    setModoEdicao(true);
    setVisitaEditandoId(visita.id);
    setVisitaEditandoOriginal(visita);

    const estadoAtual = (visita.estado ?? 'AGENDADA') as EstadoVisita;
    const notas = visita.notas ?? '';

    setForm({
      vendedor_id: visita.vendedor_id,
      cliente_id: visita.cliente_id ?? '',
      data_visita: visita.data_visita,

      hora_inicio: '',
      hora_fim: '',

      objetivo: notas,
      resultado: '',
      proxima_acao: '',

      km_informado: visita.km_informado != null ? String(visita.km_informado) : '',
      km_referencia: visita.km_referencia != null ? String(visita.km_referencia) : '',

      // dropdown só controla AGENDADA/CANCELADA; se visita for REALIZADA, vamos travar o select no UI
      estado: estadoAtual === 'CANCELADA' ? 'CANCELADA' : 'AGENDADA',
    });

    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.vendedor_id || !form.cliente_id || !form.data_visita || !form.objetivo) {
      alert('Preencha: Vendedor, Cliente, Data e Objetivo.');
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

    // Se estiver editando e já for PAGO, bloqueia (segunda barreira)
    if (modoEdicao && visitaEditandoId && visitaEditandoOriginal && !kmLancReadFailed) {
      if (isPago(visitaEditandoId)) {
        alert('Edição bloqueada: esta visita está vinculada a um lançamento de KM PAGO.');
        return;
      }
    }

    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id ?? null;

      const originalEstado = (visitaEditandoOriginal?.estado ?? null) as EstadoVisita | null;

      const payload: any = {
        vendedor_id: form.vendedor_id,
        cliente_id: form.cliente_id,
        data_visita: form.data_visita,
        notas: buildNotas({
          hora_inicio: form.hora_inicio,
          hora_fim: form.hora_fim,
          objetivo: form.objetivo,
          resultado: form.resultado,
          proxima_acao: form.proxima_acao,
        }),
        km_informado: kmInformado,
        km_referencia: kmReferencia,

        // colunas existem (você confirmou)
        origem: 'ADMIN',
        updated_by: userId,
      };

      if (modoEdicao && visitaEditandoId) {
        // Regra central: se a visita original é REALIZADA, NÃO alteramos estado via modal.
        // Edita-se apenas os campos, mantendo REALIZADA.
        if (originalEstado === 'REALIZADA') {
          // mantém estado REALIZADA, não escreve estado no payload
        } else {
          // se não for REALIZADA, estado pode ser AGENDADA/CANCELADA via select
          payload.estado = form.estado;
        }

        const { error } = await supabase.from('vendedor_visitas').update(payload).eq('id', visitaEditandoId);
        if (error) throw error;

        alert('Visita atualizada.');
      } else {
        // criação
        payload.estado = form.estado; // AGENDADA/CANCELADA
        payload.created_by = userId;

        const { error } = await supabase.from('vendedor_visitas').insert(payload);
        if (error) throw error;

        alert('Visita agendada.');
      }

      setShowModal(false);
      resetForm();
      await carregarTudo();
    } catch (e: any) {
      console.error(e);
      alert('Erro ao salvar visita: ' + (e?.message ?? 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  }

  async function concluirVisita(visita: VisitaRow) {
    const estado = (visita.estado ?? 'AGENDADA') as EstadoVisita;
    if (estado === 'REALIZADA') return;
    if (estado === 'CANCELADA') {
      alert('Não é possível concluir uma visita CANCELADA.');
      return;
    }

    const km = visita.km_informado ?? null;
    if (km == null || Number(km) <= 0) {
      alert('Antes de concluir, preencha o KM informado (> 0).');
      return;
    }

    if (!confirm('Confirmar como REALIZADA? Isto deve gerar o lançamento de KM.')) return;

    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id ?? null;

      const { error } = await supabase
        .from('vendedor_visitas')
        .update({
          estado: 'REALIZADA',
          concluida_em: new Date().toISOString(),
          concluida_por: userId,
          origem: 'ADMIN',
          updated_by: userId,
        })
        .eq('id', visita.id);

      if (error) throw error;

      await carregarTudo();
      alert('Visita concluída. Verifique o lançamento de KM (PENDENTE).');
    } catch (e: any) {
      console.error(e);
      alert('Erro ao concluir visita: ' + (e?.message ?? 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  }

  async function cancelarVisita(visita: VisitaRow) {
    const estado = (visita.estado ?? 'AGENDADA') as EstadoVisita;

    if (estado === 'REALIZADA') {
      alert('Visita REALIZADA não deve ser cancelada neste fluxo.');
      return;
    }
    if (estado === 'CANCELADA') return;

    if (!confirm('Cancelar esta visita?')) return;

    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id ?? null;

      const { error } = await supabase
        .from('vendedor_visitas')
        .update({
          estado: 'CANCELADA',
          origem: 'ADMIN',
          updated_by: userId,
        })
        .eq('id', visita.id);

      if (error) throw error;

      await carregarTudo();
      alert('Visita cancelada.');
    } catch (e: any) {
      console.error(e);
      alert('Erro ao cancelar: ' + (e?.message ?? 'Erro desconhecido'));
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
      const vendedorNome = (v.vendedores?.nome ?? '').toLowerCase();
      const notas = (v.notas ?? '').toLowerCase();

      const matchBusca = !term || clienteNome.includes(term) || vendedorNome.includes(term) || notas.includes(term);
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
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1">Visitas (Admin)</h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Agendamento, edição, conclusão e quilometragem por visita (edição bloqueada quando KM estiver PAGO)
            </p>
            {kmLancReadFailed && (
              <p className="mt-1 text-xs text-amber-700">
                Aviso: não foi possível ler lançamentos de KM (RLS). O bloqueio por “PAGO” pode não ser aplicado.
              </p>
            )}
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

      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por cliente, vendedor ou notas..."
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(['TODOS', 'AGENDADA', 'REALIZADA', 'CANCELADA'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                  filterStatus === status ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status === 'TODOS' ? 'Todas' : statusLabels[status]}
              </button>
            ))}
          </div>
        </div>
      </div>

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
          <p className="text-2xl sm:text-3xl font-bold text-purple-600">{stats.totalKm.toLocaleString('pt-PT')}</p>
        </div>
      </div>

      <div className="space-y-4">
        {visitasFiltradas.map((visita) => {
          const estado = (visita.estado ?? 'AGENDADA') as EstadoVisita;
          const StatusIcon = statusIcons[estado];

          const kmLanc = kmLancMap[visita.id];
          const kmStatus = (kmLanc?.status ?? '').toUpperCase();
          const bloqueadaPorPago = !kmLancReadFailed && kmStatus === 'PAGO';

          const kmLancBadge = kmLanc?.status ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
              <Receipt className="w-3 h-3" />
              KM: {kmLanc.status}
              {kmLanc?.valor_total != null ? ` (€${Number(kmLanc.valor_total).toFixed(2)})` : ''}
            </span>
          ) : null;

          return (
            <div key={visita.id} className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <MapPin className="w-5 h-5 text-blue-600" />
                    </div>

                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 mb-1">{visita.clientes?.nome ?? '—'}</h3>
                      <p className="text-sm text-gray-600">Vendedor: {visita.vendedores?.nome ?? visita.vendedor_id}</p>
                      {bloqueadaPorPago && (
                        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          Bloqueada: lançamento de KM está PAGO.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${statusColors[estado]}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusLabels[estado]}
                      </span>
                      {kmLancBadge}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(visita.data_visita).toLocaleDateString('pt-PT')}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Navigation className="w-4 h-4" />
                      <span>
                        KM informado:{' '}
                        <span className="font-semibold text-gray-900">{Number(visita.km_informado ?? 0).toLocaleString('pt-PT')} km</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <BadgeCheck className="w-4 h-4" />
                      <span>
                        KM ref.:{' '}
                        <span className="font-semibold text-gray-900">{Number(visita.km_referencia ?? 0).toLocaleString('pt-PT')} km</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>
                        Concluída em:{' '}
                        <span className="font-semibold text-gray-900">
                          {visita.concluida_em ? new Date(visita.concluida_em).toLocaleString('pt-PT') : '—'}
                        </span>
                      </span>
                    </div>
                  </div>

                  {visita.notas ? (
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-gray-600 mb-1">Notas</p>
                      <pre className="text-sm text-gray-900 whitespace-pre-wrap font-sans">{visita.notas}</pre>
                    </div>
                  ) : (
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-sm text-gray-600">Sem notas.</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-row lg:flex-col gap-2 justify-end">
                  {/* Editar: permitido em AGENDADA/CANCELADA/REALIZADA, exceto quando KM PAGO */}
                  <button
                    onClick={() => abrirModalEditar(visita)}
                    disabled={bloqueadaPorPago}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm ${
                      bloqueadaPorPago ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
                    }`}
                  >
                    <Edit3 className="w-4 h-4" />
                    Editar
                  </button>

                  {/* Concluir/Cancelar apenas se não for REALIZADA */}
                  {estado !== 'REALIZADA' && (
                    <>
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

                  {estado === 'REALIZADA' && (
                    <div className="text-xs text-gray-500 max-w-[220px]">
                      Realizada: edição permitida (Admin) enquanto KM não estiver PAGO.
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

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-5 flex items-center justify-between">
              <h2 className="text-xl sm:text-2xl font-bold">{modoEdicao ? 'Editar Visita' : 'Agendar Nova Visita'}</h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                aria-label="Fechar"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {modoEdicao && visitaEditandoOriginal?.estado === 'REALIZADA' && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Esta visita está <strong>REALIZADA</strong>. Você pode editar os dados, mas o estado não é alterado aqui.
                  O bloqueio total só acontece quando o lançamento de KM estiver <strong>PAGO</strong>.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cliente/Farmácia *</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Vendedor *</label>
                  <select
                    value={form.vendedor_id}
                    onChange={(e) => setForm({ ...form, vendedor_id: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Selecione...</option>
                    {vendedores.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.nome}
                        {v.email ? ` (${v.email})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data da Visita *</label>
                <input
                  type="date"
                  value={form.data_visita}
                  onChange={(e) => setForm({ ...form, data_visita: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Hora Início (opcional)</label>
                  <input
                    type="time"
                    value={form.hora_inicio}
                    onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Hora Fim (opcional)</label>
                  <input
                    type="time"
                    value={form.hora_fim}
                    onChange={(e) => setForm({ ...form, hora_fim: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">KM informado</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={form.km_informado}
                    onChange={(e) => setForm({ ...form, km_informado: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: 15"
                  />
                  <p className="text-xs text-gray-500 mt-1">Para concluir como REALIZADA, precisa ser &gt; 0.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">KM referência (opcional)</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Objetivo *</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Resultado (opcional)</label>
                  <textarea
                    value={form.resultado}
                    onChange={(e) => setForm({ ...form, resultado: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Próxima ação (opcional)</label>
                  <textarea
                    value={form.proxima_acao}
                    onChange={(e) => setForm({ ...form, proxima_acao: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>

                {modoEdicao && visitaEditandoOriginal?.estado === 'REALIZADA' ? (
                  <div className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-slate-50 text-slate-700">
                    REALIZADA (travado no modal)
                  </div>
                ) : (
                  <select
                    value={form.estado}
                    onChange={(e) => setForm({ ...form, estado: e.target.value as 'AGENDADA' | 'CANCELADA' })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="AGENDADA">Agendada</option>
                    <option value="CANCELADA">Cancelada</option>
                  </select>
                )}

                <p className="text-xs text-gray-500 mt-1">REALIZADA é via botão “Concluir”. PAGO bloqueia edição.</p>
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
