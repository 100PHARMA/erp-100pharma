// src/app/vendedores/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  UserCircle,
  Plus,
  Search,
  Eye,
  Phone,
  Mail,
  TrendingUp,
  Target,
  Users,
  Package,
  FileText,
  MapPin,
  Calendar,
  DollarSign,
  Building2,
  CheckCircle,
  XCircle,
  Download,
  AlertCircle,
  Edit,
  Trash2,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { gerarRelatorioVendedorPdf } from '@/lib/relatorio-vendedor-pdf';

import { buscarConfiguracaoFinanceira, type ConfiguracaoFinanceira } from '@/lib/configuracoes-financeiras';
import { getAnoMesAtualUtc, getVendedorMetricasMes, type VendedorMetricasMes } from '@/lib/vendedor-metricas';
import type { VendedorMetaMensalRow } from '@/lib/vendedor-metas-mensais';

// ======================================================================
// TIPOS
// ======================================================================

type StatusVisita = 'REALIZADA' | 'PENDENTE' | 'CANCELADA';

interface VendedorBase {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  salario_base: number;
  custo_km: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

interface VendedorComMetricas extends VendedorBase {
  // Métricas do mês atual (BASE SEM IVA, por FATURAS emitidas)
  baseSemIvaMes: number;
  comissaoMes: number;
  frascosMes: number;
  percentualMetaMes: number;
  metaMensalUsada: number;
  faixaAtual: 'FAIXA_1' | 'FAIXA_2' | 'FAIXA_3';
  faixaPercentAtual: number;

  // Operacional
  clientesAtivos: number; // carteira (vendedor_clientes.ativo)
  clientesUnicosFaturadosMes: number; // via faturas
  numFaturasMes: number;
  kmRodadosMes: number;
  custoKmMes: number;

  // Visitas
  visitasMes: number;
  visitasPendentesMes: number;
  visitasRealizadasMes: number;
  visitasCanceladasMes: number;

  // Debug / origem da regra
  regraOrigem: 'VENDEDOR' | 'GLOBAL';
}

interface Cliente {
  id: string;
  nome: string;
  localidade: string;
  ativo: boolean;
}

interface VendedorCliente {
  id: string;
  vendedor_id: string;
  cliente_id: string;
  ativo: boolean;
  created_at: string;
}

interface Quilometragem {
  id: string;
  vendedor_id: string;
  data: string;
  km: number;
  valor: number;
}

interface Visita {
  id: string;
  vendedor_id: string;
  cliente_id: string;
  data_visita: string;
  estado: StatusVisita | string;
  notas: string;
}

interface FaturaRow {
  id: string;
  numero: string | null;
  venda_id: string | null;
  cliente_id: string | null;
  tipo: string | null;
  estado: string | null;
  data_emissao: string; // timestamptz ISO
  total_sem_iva?: number | null;
  subtotal?: number | null;
  vendas?: { id: string; vendedor_id: string } | null;
}

interface VendaItem {
  id: string;
  venda_id: string;
  quantidade: number;
}

// ======================================================================
// HELPERS (cálculo local para relatório por período)
// ======================================================================

function safeNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pickFaixaPercent(
  faixa: 'FAIXA_1' | 'FAIXA_2' | 'FAIXA_3',
  regra: { faixa1_percent: number; faixa2_percent: number; faixa3_percent: number },
): number {
  if (faixa === 'FAIXA_1') return regra.faixa1_percent;
  if (faixa === 'FAIXA_2') return regra.faixa2_percent;
  return regra.faixa3_percent;
}

function calcComissaoProgressivaLocal(
  base: number,
  regra: {
    faixa1_limite: number;
    faixa1_percent: number;
    faixa2_limite: number;
    faixa2_percent: number;
    faixa3_percent: number;
  },
): { comissao: number; faixa: 'FAIXA_1' | 'FAIXA_2' | 'FAIXA_3' } {
  const b = Math.max(0, safeNum(base));
  const f1 = Math.max(0, safeNum(regra.faixa1_limite));
  const f2 = Math.max(0, safeNum(regra.faixa2_limite));
  const p1 = Math.max(0, safeNum(regra.faixa1_percent));
  const p2 = Math.max(0, safeNum(regra.faixa2_percent));
  const p3 = Math.max(0, safeNum(regra.faixa3_percent));

  const faixa2Valida = f2 > f1;

  if (b <= f1 || f1 === 0) return { comissao: b * (p1 / 100), faixa: 'FAIXA_1' };

  if (faixa2Valida && b <= f2) {
    const c1 = f1 * (p1 / 100);
    const c2 = (b - f1) * (p2 / 100);
    return { comissao: c1 + c2, faixa: 'FAIXA_2' };
  }

  const c1 = f1 * (p1 / 100);
  const c2 = faixa2Valida ? (f2 - f1) * (p2 / 100) : 0;
  const excedenteBase = faixa2Valida ? b - f2 : b - f1;
  const c3 = Math.max(0, excedenteBase) * (p3 / 100);
  return { comissao: c1 + c2 + c3, faixa: 'FAIXA_3' };
}

function calcPercentualMetaLocal(base: number, meta: number): number {
  const b = Math.max(0, safeNum(base));
  const m = safeNum(meta);
  if (m <= 0) return 0;
  const pct = (b / m) * 100;
  return Math.min(Math.max(pct, 0), 200);
}

function monthRangeUtc(ano: number, mes: number) {
  // mes: 1..12
  const inicio = new Date(Date.UTC(ano, mes - 1, 1, 0, 0, 0));
  const fimExclusivo = new Date(Date.UTC(mes === 12 ? ano + 1 : ano, mes === 12 ? 0 : mes, 1, 0, 0, 0));
  const fimInclusive = new Date(Date.UTC(ano, mes, 0, 0, 0, 0));

  const inicioDate = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const fimDate = `${fimInclusive.getUTCFullYear()}-${String(fimInclusive.getUTCMonth() + 1).padStart(2, '0')}-${String(
    fimInclusive.getUTCDate(),
  ).padStart(2, '0')}`;

  return { inicioTs: inicio.toISOString(), fimTs: fimExclusivo.toISOString(), inicioDate, fimDate };
}

async function fetchMetaMensalVendedor(ano: number, mes: number, vendedor_id: string): Promise<VendedorMetaMensalRow | null> {
  const { data, error } = await supabase
    .from('vendedor_metas_mensais')
    .select('*')
    .eq('ano', ano)
    .eq('mes', mes)
    .eq('vendedor_id', vendedor_id)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as any;
}

function pickRegra(cfg: ConfiguracaoFinanceira, metaRow: VendedorMetaMensalRow | null) {
  const faixa1_limite =
    metaRow?.faixa1_limite !== null && metaRow?.faixa1_limite !== undefined ? safeNum(metaRow.faixa1_limite) : safeNum(cfg.faixa1_limite);

  const faixa2_limite =
    metaRow?.faixa2_limite !== null && metaRow?.faixa2_limite !== undefined ? safeNum(metaRow.faixa2_limite) : safeNum(cfg.faixa2_limite);

  const faixa1_percent =
    metaRow?.faixa1_percent !== null && metaRow?.faixa1_percent !== undefined
      ? safeNum(metaRow.faixa1_percent)
      : safeNum((cfg as any).comissao_faixa1 ?? cfg.comissao_faixa1);

  const faixa2_percent =
    metaRow?.faixa2_percent !== null && metaRow?.faixa2_percent !== undefined
      ? safeNum(metaRow.faixa2_percent)
      : safeNum((cfg as any).comissao_faixa2 ?? cfg.comissao_faixa2);

  const faixa3_percent =
    metaRow?.faixa3_percent !== null && metaRow?.faixa3_percent !== undefined
      ? safeNum(metaRow.faixa3_percent)
      : safeNum((cfg as any).comissao_faixa3 ?? cfg.comissao_faixa3);

  const meta_mensal_usada =
    metaRow?.meta_mensal !== null && metaRow?.meta_mensal !== undefined ? safeNum(metaRow.meta_mensal) : safeNum(cfg.meta_mensal);

  const temOverride =
    (metaRow?.meta_mensal !== null && metaRow?.meta_mensal !== undefined) ||
    (metaRow?.faixa1_limite !== null && metaRow?.faixa1_limite !== undefined) ||
    (metaRow?.faixa2_limite !== null && metaRow?.faixa2_limite !== undefined) ||
    (metaRow?.faixa1_percent !== null && metaRow?.faixa1_percent !== undefined) ||
    (metaRow?.faixa2_percent !== null && metaRow?.faixa2_percent !== undefined) ||
    (metaRow?.faixa3_percent !== null && metaRow?.faixa3_percent !== undefined);

  return {
    regraOrigem: (temOverride ? 'VENDEDOR' : 'GLOBAL') as 'VENDEDOR' | 'GLOBAL',
    meta_mensal_usada,
    faixa1_limite,
    faixa2_limite,
    faixa1_percent,
    faixa2_percent,
    faixa3_percent,
  };
}

// ======================================================================
// COMPONENTE
// ======================================================================

export default function VendedoresPage() {
  const [vendedores, setVendedores] = useState<VendedorComMetricas[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vendedorClientes, setVendedorClientes] = useState<VendedorCliente[]>([]);
  const [quilometragens, setQuilometragens] = useState<Quilometragem[]>([]);
  const [visitas, setVisitas] = useState<Visita[]>([]);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [busca, setBusca] = useState('');
  const [modalNovo, setModalNovo] = useState(false);
  const [modalDetalhes, setModalDetalhes] = useState(false);
  const [modalAdicionarCliente, setModalAdicionarCliente] = useState(false);
  const [modalAdicionarKm, setModalAdicionarKm] = useState(false);
  const [modalAdicionarVisita, setModalAdicionarVisita] = useState(false);
  const [modalEditarKm, setModalEditarKm] = useState(false);
  const [modalEditarVisita, setModalEditarVisita] = useState(false);

  const [vendedorSelecionado, setVendedorSelecionado] = useState<VendedorComMetricas | null>(null);
  const [kmSelecionada, setKmSelecionada] = useState<Quilometragem | null>(null);
  const [visitaSelecionada, setVisitaSelecionada] = useState<Visita | null>(null);

  const [abaAtiva, setAbaAtiva] = useState<'resumo' | 'carteira' | 'vendas' | 'km'>('resumo');
  const [buscaCliente, setBuscaCliente] = useState('');

  // Período do relatório do vendedor (mantido, mas base SEM IVA via faturas)
  const [tipoPeriodoRelatorio, setTipoPeriodoRelatorio] = useState<'MES_ATUAL' | 'ULTIMOS_30' | 'MES_ANTERIOR' | 'PERSONALIZADO'>('MES_ATUAL');
  const [dataInicioRelatorio, setDataInicioRelatorio] = useState<string>('');
  const [dataFimRelatorio, setDataFimRelatorio] = useState<string>('');
  const [mostrarModalPeriodo, setMostrarModalPeriodo] = useState(false);

  // Formulários
  const [novoVendedor, setNovoVendedor] = useState({
    nome: '',
    email: '',
    telefone: '',
    salario_base: 0,
    custo_km: 0.4,
  });

  const [novaKm, setNovaKm] = useState({
    data: new Date().toISOString().split('T')[0],
    km: 0,
  });

  const [novaVisita, setNovaVisita] = useState({
    cliente_id: '',
    data_visita: new Date().toISOString().split('T')[0],
    estado: 'PENDENTE' as StatusVisita,
    notas: '',
  });

  // ======================================================================
  // INTERVALO DO RELATÓRIO (datas YYYY-MM-DD)
  // ======================================================================

  const calcularIntervaloRelatorio = () => {
    const hoje = new Date();

    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (tipoPeriodoRelatorio === 'PERSONALIZADO' && dataInicioRelatorio && dataFimRelatorio) {
      return { dataInicio: dataInicioRelatorio, dataFim: dataFimRelatorio };
    }

    let inicio: Date;
    let fim: Date;

    switch (tipoPeriodoRelatorio) {
      case 'ULTIMOS_30':
        fim = hoje;
        inicio = new Date(hoje);
        inicio.setDate(inicio.getDate() - 29);
        break;

      case 'MES_ANTERIOR': {
        const ano = hoje.getFullYear();
        const mesAnterior = hoje.getMonth() - 1;
        inicio = new Date(ano, mesAnterior, 1);
        fim = new Date(ano, mesAnterior + 1, 0);
        break;
      }

      case 'MES_ATUAL':
      default: {
        const ano = hoje.getFullYear();
        const mes = hoje.getMonth();
        inicio = new Date(ano, mes, 1);
        fim = new Date(ano, mes + 1, 0);
        break;
      }
    }

    return { dataInicio: formatDate(inicio), dataFim: formatDate(fim) };
  };

  // ======================================================================
  // CARREGAR DADOS (MÊS ATUAL - FATURAS EMITIDAS, BASE SEM IVA)
  // ======================================================================

  useEffect(() => {
    carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const carregarDados = async () => {
    try {
      setCarregando(true);
      setErro(null);

      // 1) Carregar mês atual (UTC) e métricas consolidadas
      const { ano, mes } = getAnoMesAtualUtc();
      const metricas = await getVendedorMetricasMes(ano, mes);

      const metricByVendedor = new Map<string, VendedorMetricasMes>();
      metricas.forEach((m) => metricByVendedor.set(m.vendedor_id, m));

      // 2) Carregar vendedores
      const { data: vendedoresData, error: vendedoresError } = await supabase
        .from('vendedores')
        .select('*')
        .order('nome', { ascending: true });

      if (vendedoresError) throw vendedoresError;

      // 3) Carregar clientes e relações (carteira)
      const { data: clientesData, error: clientesError } = await supabase
        .from('clientes')
        .select('*')
        .order('nome', { ascending: true });

      if (clientesError) throw clientesError;

      const { data: vendedorClientesData, error: vendedorClientesError } = await supabase.from('vendedor_clientes').select('*');
      if (vendedorClientesError) throw vendedorClientesError;

      // 4) Quilometragens e visitas (para listagens e modais)
      const { data: quilometragensData, error: quilometragensError } = await supabase
        .from('vendedor_km')
        .select('*')
        .order('data', { ascending: false });

      if (quilometragensError) throw quilometragensError;

      const { data: visitasData, error: visitasError } = await supabase
        .from('vendedor_visitas')
        .select('*')
        .order('data_visita', { ascending: false });

      if (visitasError) throw visitasError;

      // 5) Montar vendedores com métricas (base SEM IVA)
      const vendedoresComMetricas: VendedorComMetricas[] = (vendedoresData ?? []).map((v: any) => {
        const m = metricByVendedor.get(v.id);

        const clientesAtivosCarteira = (vendedorClientesData ?? []).filter((vc: any) => vc.vendedor_id === v.id && vc.ativo).length;

        const faixaAtual = (m?.faixa_atual ?? 'FAIXA_1') as 'FAIXA_1' | 'FAIXA_2' | 'FAIXA_3';
        const faixaPercentAtual =
          faixaAtual === 'FAIXA_1' ? safeNum(m?.faixa1_percent) : faixaAtual === 'FAIXA_2' ? safeNum(m?.faixa2_percent) : safeNum(m?.faixa3_percent);

        return {
          ...v,
          baseSemIvaMes: safeNum(m?.base_sem_iva ?? 0),
          comissaoMes: safeNum(m?.comissao_calculada ?? 0),
          frascosMes: safeNum(m?.frascos ?? 0),
          percentualMetaMes: safeNum(m?.percentual_meta ?? 0),
          metaMensalUsada: safeNum(m?.meta_mensal_usada ?? 0),
          faixaAtual,
          faixaPercentAtual: safeNum(faixaPercentAtual),

          clientesAtivos: clientesAtivosCarteira,
          clientesUnicosFaturadosMes: safeNum(m?.clientes_unicos ?? 0),
          numFaturasMes: safeNum(m?.num_faturas ?? 0),
          kmRodadosMes: safeNum(m?.km_rodados ?? 0),
          custoKmMes: safeNum(m?.custo_km ?? 0),

          visitasMes: safeNum(m?.visitas_total ?? 0),
          visitasPendentesMes: safeNum(m?.visitas_pendentes ?? 0),
          visitasRealizadasMes: safeNum(m?.visitas_realizadas ?? 0),
          visitasCanceladasMes: safeNum(m?.visitas_canceladas ?? 0),

          regraOrigem: (m?.regra_origem ?? 'GLOBAL') as 'VENDEDOR' | 'GLOBAL',
        };
      });

      setVendedores(vendedoresComMetricas);
      setClientes((clientesData ?? []) as any);
      setVendedorClientes((vendedorClientesData ?? []) as any);
      setQuilometragens((quilometragensData ?? []) as any);
      setVisitas((visitasData ?? []) as any);
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);

      let mensagemErro = 'Erro ao carregar dados do Supabase';

      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        mensagemErro =
          'Não foi possível conectar ao Supabase. Verifique:\n\n' +
          '1. Sua conexão com a internet\n' +
          '2. Se as variáveis de ambiente estão configuradas corretamente\n' +
          '3. Se o projeto Supabase está ativo e acessível\n' +
          '4. Se as configurações de CORS estão corretas no Supabase';
      } else if (error.message?.includes('timeout')) {
        mensagemErro = 'Tempo limite de conexão excedido. O servidor Supabase pode estar lento ou indisponível.';
      } else {
        mensagemErro = error.message || 'Erro desconhecido ao carregar dados';
      }

      setErro(mensagemErro);
    } finally {
      setCarregando(false);
    }
  };

  // ======================================================================
  // FILTROS
  // ======================================================================

  const vendedoresFiltrados = useMemo(() => {
    return vendedores.filter(
      (v) => v.nome.toLowerCase().includes(busca.toLowerCase()) || v.email.toLowerCase().includes(busca.toLowerCase()),
    );
  }, [vendedores, busca]);

  // ======================================================================
  // CRUD VENDEDOR
  // ======================================================================

  const salvarNovoVendedor = async () => {
    if (!novoVendedor.nome || !novoVendedor.email) {
      alert('Preencha nome e email obrigatórios!');
      return;
    }

    try {
      const { error } = await supabase
        .from('vendedores')
        .insert([
          {
            nome: novoVendedor.nome,
            email: novoVendedor.email,
            telefone: novoVendedor.telefone,
            salario_base: novoVendedor.salario_base,
            custo_km: novoVendedor.custo_km,
            ativo: true,
          },
        ])
        .select();

      if (error) throw error;

      setModalNovo(false);
      setNovoVendedor({ nome: '', email: '', telefone: '', salario_base: 0, custo_km: 0.4 });

      await carregarDados();
      alert('Vendedor cadastrado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao cadastrar vendedor:', error);
      alert('Erro ao cadastrar vendedor: ' + error.message);
    }
  };

  const toggleStatus = async (id: string) => {
    try {
      const vendedor = vendedores.find((v) => v.id === id);
      if (!vendedor) return;

      const { error } = await supabase.from('vendedores').update({ ativo: !vendedor.ativo }).eq('id', id);
      if (error) throw error;

      await carregarDados();
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status: ' + error.message);
    }
  };

  const abrirDetalhes = (vendedor: VendedorComMetricas) => {
    setVendedorSelecionado(vendedor);
    setAbaAtiva('resumo');
    setModalDetalhes(true);
  };

  // ======================================================================
  // KM / VISITAS
  // ======================================================================

  const abrirModalAdicionarKm = () => {
    setNovaKm({ data: new Date().toISOString().split('T')[0], km: 0 });
    setModalAdicionarKm(true);
  };

  const adicionarKm = async () => {
    if (!vendedorSelecionado) return;

    if (!novaKm.km || novaKm.km <= 0) {
      alert('Preencha o campo KM com um valor válido!');
      return;
    }

    try {
      const valorCalculado = novaKm.km * safeNum(vendedorSelecionado.custo_km);

      const { error } = await supabase.from('vendedor_km').insert([
        {
          vendedor_id: vendedorSelecionado.id,
          data: novaKm.data,
          km: novaKm.km,
          valor: valorCalculado,
        },
      ]);

      if (error) throw error;

      setModalAdicionarKm(false);
      setNovaKm({ data: new Date().toISOString().split('T')[0], km: 0 });

      await carregarDados();
      alert('Quilometragem adicionada com sucesso!');
    } catch (error: any) {
      console.error('Erro ao adicionar quilometragem:', error);
      alert('Erro ao adicionar quilometragem: ' + error.message);
    }
  };

  const abrirModalEditarKm = (km: Quilometragem) => {
    setKmSelecionada(km);
    setNovaKm({ data: km.data, km: km.km });
    setModalEditarKm(true);
  };

  const salvarEdicaoKm = async () => {
    if (!kmSelecionada || !vendedorSelecionado) return;

    if (!novaKm.km || novaKm.km <= 0) {
      alert('Preencha o campo KM com um valor válido!');
      return;
    }

    try {
      const valorCalculado = novaKm.km * safeNum(vendedorSelecionado.custo_km);

      const { error } = await supabase
        .from('vendedor_km')
        .update({ data: novaKm.data, km: novaKm.km, valor: valorCalculado })
        .eq('id', kmSelecionada.id);

      if (error) throw error;

      setModalEditarKm(false);
      setKmSelecionada(null);

      await carregarDados();
      alert('Quilometragem atualizada com sucesso!');
    } catch (error: any) {
      console.error('Erro ao atualizar quilometragem:', error);
      alert('Erro ao atualizar quilometragem: ' + error.message);
    }
  };

  const excluirKm = async (id: string) => {
    if (!confirm('Deseja realmente excluir este registro de quilometragem?')) return;

    try {
      const { error } = await supabase.from('vendedor_km').delete().eq('id', id);
      if (error) throw error;

      await carregarDados();
      alert('Quilometragem excluída com sucesso!');
    } catch (error: any) {
      console.error('Erro ao excluir quilometragem:', error);
      alert('Erro ao excluir quilometragem: ' + error.message);
    }
  };

  const abrirModalAdicionarVisita = () => {
    setNovaVisita({
      cliente_id: '',
      data_visita: new Date().toISOString().split('T')[0],
      estado: 'PENDENTE',
      notas: '',
    });
    setModalAdicionarVisita(true);
  };

  const adicionarVisita = async () => {
    if (!vendedorSelecionado || !novaVisita.cliente_id) {
      alert('Selecione um cliente!');
      return;
    }

    try {
      const { error } = await supabase.from('vendedor_visitas').insert([
        {
          vendedor_id: vendedorSelecionado.id,
          cliente_id: novaVisita.cliente_id,
          data_visita: novaVisita.data_visita,
          estado: novaVisita.estado,
          notas: novaVisita.notas,
        },
      ]);

      if (error) throw error;

      setModalAdicionarVisita(false);
      setNovaVisita({
        cliente_id: '',
        data_visita: new Date().toISOString().split('T')[0],
        estado: 'PENDENTE',
        notas: '',
      });

      await carregarDados();
      alert('Visita adicionada com sucesso!');
    } catch (error: any) {
      console.error('Erro ao adicionar visita:', error);
      alert('Erro ao adicionar visita: ' + error.message);
    }
  };

  const abrirModalEditarVisita = (visita: Visita) => {
    setVisitaSelecionada(visita);
    setNovaVisita({
      cliente_id: visita.cliente_id,
      data_visita: visita.data_visita,
      estado: (visita.estado as any) ?? 'PENDENTE',
      notas: visita.notas,
    });
    setModalEditarVisita(true);
  };

  const salvarEdicaoVisita = async () => {
    if (!visitaSelecionada) return;

    try {
      const { error } = await supabase
        .from('vendedor_visitas')
        .update({
          cliente_id: novaVisita.cliente_id,
          data_visita: novaVisita.data_visita,
          estado: novaVisita.estado,
          notas: novaVisita.notas,
        })
        .eq('id', visitaSelecionada.id);

      if (error) throw error;

      setModalEditarVisita(false);
      setVisitaSelecionada(null);

      await carregarDados();
      alert('Visita atualizada com sucesso!');
    } catch (error: any) {
      console.error('Erro ao atualizar visita:', error);
      alert('Erro ao atualizar visita: ' + error.message);
    }
  };

  const excluirVisita = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta visita?')) return;

    try {
      const { error } = await supabase.from('vendedor_visitas').delete().eq('id', id);
      if (error) throw error;

      await carregarDados();
      alert('Visita excluída com sucesso!');
    } catch (error: any) {
      console.error('Erro ao excluir visita:', error);
      alert('Erro ao excluir visita: ' + error.message);
    }
  };

  // ======================================================================
  // CARTEIRA (vendedor_clientes)
  // ======================================================================

  const abrirModalAdicionarCliente = () => {
    setBuscaCliente('');
    setModalAdicionarCliente(true);
  };

  const adicionarClienteAoVendedor = async (clienteId: string) => {
    if (!vendedorSelecionado) return;

    try {
      const { data: existente, error: existenteError } = await supabase
        .from('vendedor_clientes')
        .select('*')
        .eq('vendedor_id', vendedorSelecionado.id)
        .eq('cliente_id', clienteId)
        .maybeSingle();

      if (existenteError) throw existenteError;

      if (existente) {
        const { error } = await supabase.from('vendedor_clientes').update({ ativo: true }).eq('id', (existente as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('vendedor_clientes').insert([
          { vendedor_id: vendedorSelecionado.id, cliente_id: clienteId, ativo: true },
        ]);
        if (error) throw error;
      }

      setModalAdicionarCliente(false);
      await carregarDados();
      alert('Cliente adicionado à carteira com sucesso!');
    } catch (error: any) {
      console.error('Erro ao adicionar cliente:', error);
      alert('Erro ao adicionar cliente: ' + error.message);
    }
  };

  const removerClienteDoVendedor = async (clienteId: string) => {
    if (!vendedorSelecionado) return;
    if (!confirm('Deseja realmente remover este cliente da carteira?')) return;

    try {
      const { error } = await supabase
        .from('vendedor_clientes')
        .update({ ativo: false })
        .eq('vendedor_id', vendedorSelecionado.id)
        .eq('cliente_id', clienteId);

      if (error) throw error;

      await carregarDados();
      alert('Cliente removido da carteira com sucesso!');
    } catch (error: any) {
      console.error('Erro ao remover cliente:', error);
      alert('Erro ao remover cliente: ' + error.message);
    }
  };

  // ======================================================================
  // RELATÓRIO DO VENDEDOR (BASE SEM IVA, POR FATURAS EMITIDAS)
  // ======================================================================

  const gerarRelatorioMensal = async () => {
    if (!vendedorSelecionado) return;

    try {
      const { dataInicio, dataFim } = calcularIntervaloRelatorio();

      // Para comissão/meta por período: usamos as regras do mês da dataInicio.
      // (Na prática, você está usando “mês atual”, então fica 100% consistente.)
      const ano = Number(dataInicio.slice(0, 4));
      const mes = Number(dataInicio.slice(5, 7));
      const { inicioTs, fimTs, inicioDate, fimDate } = monthRangeUtc(ano, mes);

      const cfg = await buscarConfiguracaoFinanceira();
      const metaRow = await fetchMetaMensalVendedor(ano, mes, vendedorSelecionado.id);
      const regra = pickRegra(cfg, metaRow);

      // Faturas do período (join via vendas -> vendedor)
      const inicioPeriodo = new Date(`${dataInicio}T00:00:00.000Z`).toISOString();
      const fimPeriodoExclusivo = new Date(new Date(`${dataFim}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000).toISOString();

      const { data: faturasData, error: faturasErr } = await supabase
        .from('faturas')
        .select('id, numero, venda_id, cliente_id, tipo, estado, data_emissao, total_sem_iva, subtotal, vendas!inner(id, vendedor_id)')
        .eq('tipo', 'FATURA')
        .neq('estado', 'CANCELADA')
        .eq('vendas.vendedor_id', vendedorSelecionado.id)
        .gte('data_emissao', inicioPeriodo)
        .lt('data_emissao', fimPeriodoExclusivo);

      if (faturasErr) throw faturasErr;

      const faturas = (faturasData ?? []) as FaturaRow[];

      const vendasIds = Array.from(
        new Set(
          faturas
            .map((f) => f.venda_id)
            .filter((x): x is string => Boolean(x)),
        ),
      );

      // Itens para contar frascos (somente venda_ids do período)
      let itens: VendaItem[] = [];
      if (vendasIds.length > 0) {
        const { data: itensData, error: itensErr } = await supabase
          .from('venda_itens')
          .select('id, venda_id, quantidade')
          .in('venda_id', vendasIds);

        if (itensErr) throw itensErr;
        itens = (itensData ?? []) as any;
      }

      const frascosPeriodo = itens.reduce((sum, it) => sum + safeNum(it.quantidade), 0);

      const vendasPeriodo = faturas
        .map((f) => {
          const cliente = clientes.find((c) => c.id === f.cliente_id);
          const baseSemIva = safeNum(f.total_sem_iva ?? 0);

          // frascos por venda_id (se houver)
          const frascosVenda =
            f.venda_id ? itens.filter((it) => it.venda_id === f.venda_id).reduce((s, it) => s + safeNum(it.quantidade), 0) : 0;

          return {
            id: f.id,
            data: f.data_emissao,
            cliente_nome: cliente?.nome || 'N/A',
            total_sem_iva: baseSemIva,
            frascos: frascosVenda,
            numero: f.numero ?? '',
            estado: f.estado ?? '',
          };
        })
        .sort((a, b) => String(a.data).localeCompare(String(b.data)));

      const baseSemIvaPeriodo = vendasPeriodo.reduce((sum, v) => sum + safeNum(v.total_sem_iva), 0);

      // KM do período (data é date)
      const quilometragensPeriodo = quilometragens.filter(
        (km) => km.vendedor_id === vendedorSelecionado.id && km.data >= dataInicio && km.data <= dataFim,
      );

      const kmRodadosPeriodo = quilometragensPeriodo.reduce((sum, km) => sum + safeNum(km.km), 0);
      const custoKmPeriodo = quilometragensPeriodo.reduce((sum, km) => sum + safeNum(km.valor), 0);

      // Visitas do período
      const visitasPeriodo = visitas
        .filter((v) => v.vendedor_id === vendedorSelecionado.id && v.data_visita >= dataInicio && v.data_visita <= dataFim)
        .map((v) => {
          const cliente = clientes.find((c) => c.id === v.cliente_id);
          return {
            id: v.id,
            data_visita: v.data_visita,
            estado: v.estado,
            notas: v.notas,
            cliente_nome: cliente?.nome || 'N/A',
          };
        });

      // Comissão e meta (SEM IVA)
      const { comissao, faixa } = calcComissaoProgressivaLocal(baseSemIvaPeriodo, {
        faixa1_limite: regra.faixa1_limite,
        faixa1_percent: regra.faixa1_percent,
        faixa2_limite: regra.faixa2_limite,
        faixa2_percent: regra.faixa2_percent,
        faixa3_percent: regra.faixa3_percent,
      });

      const percentualMetaPeriodo = calcPercentualMetaLocal(baseSemIvaPeriodo, regra.meta_mensal_usada);
      const faixaPercent = pickFaixaPercent(faixa, regra);

      const vendedorInfo = {
        nome: vendedorSelecionado.nome,
        email: vendedorSelecionado.email,
        telefone: vendedorSelecionado.telefone,
        ativo: vendedorSelecionado.ativo,
      };

      const resumo = {
        // Mantém chaves antigas esperadas pelo PDF (sem IVA agora)
        vendasMes: baseSemIvaPeriodo,
        frascosMes: frascosPeriodo,
        comissaoMes: comissao,
        clientesAtivos: vendedorSelecionado.clientesAtivos,
        kmRodadosMes: kmRodadosPeriodo,
        custoKmMes: custoKmPeriodo,
        percentualMeta: percentualMetaPeriodo,

        // extras úteis
        metaMensalUsada: regra.meta_mensal_usada,
        faixaAtual: faixa,
        faixaPercentAtual: faixaPercent,
      };

      await gerarRelatorioVendedorPdf({
        vendedor: vendedorInfo,
        intervalo: { dataInicio, dataFim },
        resumo,
        // mapeia “vendas” como “faturas emitidas”
        vendas: vendasPeriodo.map((v) => ({
          id: v.id,
          data: v.data,
          cliente_nome: v.cliente_nome,
          total_com_iva: v.total_sem_iva, // o gerador pode estar nomeado assim; aqui vai SEM IVA por regra do projeto
          frascos: v.frascos,
        })),
        quilometragens: quilometragensPeriodo,
        visitas: visitasPeriodo,
      });
    } catch (error: any) {
      console.error('Erro ao gerar relatório do vendedor:', error);
      alert('Erro ao gerar relatório do vendedor: ' + (error.message || 'Erro desconhecido'));
    }
  };

  // ======================================================================
  // DERIVAÇÕES (selecionado)
  // ======================================================================

  const clientesDoVendedor = useMemo(() => {
    if (!vendedorSelecionado) return [];
    return vendedorClientes
      .filter((vc) => vc.vendedor_id === vendedorSelecionado.id && vc.ativo)
      .map((vc) => clientes.find((c) => c.id === vc.cliente_id))
      .filter((c): c is Cliente => Boolean(c));
  }, [vendedorSelecionado, vendedorClientes, clientes]);

  const kmDoVendedor = useMemo(() => {
    if (!vendedorSelecionado) return [];
    return quilometragens.filter((k) => k.vendedor_id === vendedorSelecionado.id);
  }, [vendedorSelecionado, quilometragens]);

  const visitasDoVendedor = useMemo(() => {
    if (!vendedorSelecionado) return [];
    return visitas.filter((v) => v.vendedor_id === vendedorSelecionado.id);
  }, [vendedorSelecionado, visitas]);

  const clientesJaNaCarteira = useMemo(() => {
    if (!vendedorSelecionado) return [];
    return vendedorClientes.filter((vc) => vc.vendedor_id === vendedorSelecionado.id && vc.ativo).map((vc) => vc.cliente_id);
  }, [vendedorSelecionado, vendedorClientes]);

  const clientesDisponiveis = useMemo(() => {
    return clientes
      .filter((c) => !clientesJaNaCarteira.includes(c.id))
      .filter(
        (c) =>
          c.nome.toLowerCase().includes(buscaCliente.toLowerCase()) ||
          (c.localidade && c.localidade.toLowerCase().includes(buscaCliente.toLowerCase())),
      );
  }, [clientes, clientesJaNaCarteira, buscaCliente]);

  const valorCalculadoKm = vendedorSelecionado ? safeNum(novaKm.km) * safeNum(vendedorSelecionado.custo_km) : 0;

  // ======================================================================
  // RENDER
  // ======================================================================

  if (carregando) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando vendedores...</p>
          </div>
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-900 mb-2">Erro ao carregar dados</h3>
              <div className="text-red-700 mb-4 whitespace-pre-line">{erro}</div>
              <div className="flex gap-3">
                <button onClick={carregarDados} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
                  Tentar Novamente
                </button>
                <button onClick={() => (window.location.href = '/')} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors">
                  Voltar ao Início
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Vendedores</h1>
            <p className="text-gray-600">
              Gestão da equipa comercial (métricas por <span className="font-medium">faturas emitidas</span>, sempre em € <span className="font-medium">sem IVA</span>)
            </p>
          </div>
          <button
            onClick={() => setModalNovo(true)}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 hover:scale-105"
          >
            <Plus className="w-5 h-5" />
            Novo Vendedor
          </button>
        </div>
      </div>

      {/* Busca */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Cards */}
      {vendedoresFiltrados.length === 0 ? (
        <div className="text-center py-12">
          <UserCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum vendedor encontrado</h3>
          <p className="text-gray-600 mb-6">{busca ? 'Tente ajustar sua busca' : 'Comece adicionando um novo vendedor'}</p>
          {!busca && (
            <button
              onClick={() => setModalNovo(true)}
              className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Adicionar Vendedor
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vendedoresFiltrados.map((vendedor) => (
            <div key={vendedor.id} className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-lg">
                      <UserCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">{vendedor.nome}</h3>
                      <p className="text-xs opacity-90">{vendedor.ativo ? 'Ativo' : 'Inativo'}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs opacity-90">Faixa atual</p>
                    <p className="text-sm font-bold">
                      {vendedor.faixaPercentAtual.toFixed(1)}% <span className="text-xs opacity-80">({vendedor.faixaAtual.replace('_', ' ')})</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status</span>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                      vendedor.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {vendedor.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                {/* Contatos */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4" />
                    <span className="truncate">{vendedor.telefone || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{vendedor.email}</span>
                  </div>
                </div>

                {/* Métricas (BASE SEM IVA) */}
                <div className="border-t pt-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Faturação (Mês) sem IVA</span>
                    <span className="font-bold text-purple-600">
                      {vendedor.baseSemIvaMes.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Frascos (Mês)</span>
                    <span className="font-bold text-blue-600">{vendedor.frascosMes}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Comissão (Mês)</span>
                    <span className="font-bold text-green-600">
                      {vendedor.comissaoMes.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-600">Meta Mensal</span>
                      <span className="text-sm font-semibold text-gray-900">{vendedor.percentualMetaMes.toFixed(0)}%</span>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(vendedor.percentualMetaMes, 100)}%` }}
                      />
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                      <span>
                        Meta usada: {vendedor.metaMensalUsada.toLocaleString('pt-PT', { minimumFractionDigits: 0 })}€
                      </span>
                      <span>Regra: {vendedor.regraOrigem}</span>
                    </div>
                  </div>
                </div>

                {/* Botões */}
                <div className="flex gap-2 pt-4">
                  <button
                    onClick={() => abrirDetalhes(vendedor)}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-50 text-blue-600 py-2 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    Detalhes
                  </button>

                  <button
                    onClick={() => toggleStatus(vendedor.id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-colors ${
                      vendedor.ativo ? 'bg-orange-50 text-orange-600 hover:bg-orange-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
                    }`}
                  >
                    {vendedor.ativo ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                    {vendedor.ativo ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL NOVO VENDEDOR */}
      {modalNovo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold">Novo Vendedor</h2>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome Completo *</label>
                  <input
                    type="text"
                    value={novoVendedor.nome}
                    onChange={(e) => setNovoVendedor({ ...novoVendedor, nome: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="Nome do vendedor"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    value={novoVendedor.email}
                    onChange={(e) => setNovoVendedor({ ...novoVendedor, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="email@100pharma.pt"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Telefone</label>
                  <input
                    type="text"
                    value={novoVendedor.telefone}
                    onChange={(e) => setNovoVendedor({ ...novoVendedor, telefone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="+351 91 234 5678"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Salário Base (€)</label>
                  <input
                    type="number"
                    value={novoVendedor.salario_base}
                    onChange={(e) => setNovoVendedor({ ...novoVendedor, salario_base: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="1200"
                    min="0"
                    step="50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Custo por KM (€)</label>
                  <input
                    type="number"
                    value={novoVendedor.custo_km}
                    onChange={(e) => setNovoVendedor({ ...novoVendedor, custo_km: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="0.40"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={salvarNovoVendedor}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
                >
                  Cadastrar
                </button>
                <button
                  onClick={() => setModalNovo(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALHES */}
      {modalDetalhes && vendedorSelecionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{vendedorSelecionado.nome}</h2>
                  <p className="text-sm opacity-90">{vendedorSelecionado.email}</p>
                </div>
                <button onClick={() => setModalDetalhes(false)} className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors">
                  ✕
                </button>
              </div>
            </div>

            {/* Abas */}
            <div className="border-b">
              <div className="flex overflow-x-auto">
                {[
                  { id: 'resumo', label: 'Painel Resumo', icon: TrendingUp },
                  { id: 'carteira', label: 'Carteira de Clientes', icon: Users },
                  { id: 'vendas', label: 'Faturas & Comissão', icon: DollarSign },
                  { id: 'km', label: 'Quilometragem & Visitas', icon: MapPin },
                ].map((aba) => (
                  <button
                    key={aba.id}
                    onClick={() => setAbaAtiva(aba.id as any)}
                    className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                      abaAtiva === aba.id ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <aba.icon className="w-4 h-4" />
                    {aba.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Conteúdo */}
            <div className="p-6">
              {/* ABA RESUMO */}
              {abaAtiva === 'resumo' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-blue-600 font-medium">Faturação (Mês) sem IVA</span>
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                      </div>
                      <p className="text-2xl font-bold text-blue-900">
                        {vendedorSelecionado.baseSemIvaMes.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
                      </p>
                      <p className="text-xs text-blue-700 mt-1">{vendedorSelecionado.numFaturasMes} faturas emitidas</p>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-green-600 font-medium">Frascos (Mês)</span>
                        <Package className="w-5 h-5 text-green-600" />
                      </div>
                      <p className="text-2xl font-bold text-green-900">{vendedorSelecionado.frascosMes}</p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-purple-600 font-medium">Clientes (Carteira)</span>
                        <Building2 className="w-5 h-5 text-purple-600" />
                      </div>
                      <p className="text-2xl font-bold text-purple-900">{vendedorSelecionado.clientesAtivos}</p>
                      <p className="text-xs text-purple-700 mt-1">{vendedorSelecionado.clientesUnicosFaturadosMes} clientes faturados no mês</p>
                    </div>

                    <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-6 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-pink-600 font-medium">Meta Mensal</span>
                        <Target className="w-5 h-5 text-pink-600" />
                      </div>
                      <p className="text-2xl font-bold text-pink-900">{vendedorSelecionado.percentualMetaMes.toFixed(0)}%</p>
                      <p className="text-xs text-pink-700 mt-1">Meta usada: {vendedorSelecionado.metaMensalUsada.toLocaleString('pt-PT')}€</p>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-emerald-600 font-medium">Comissão (Mês)</span>
                        <DollarSign className="w-5 h-5 text-emerald-600" />
                      </div>
                      <p className="text-2xl font-bold text-emerald-900">
                        {vendedorSelecionado.comissaoMes.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
                      </p>
                      <p className="text-xs text-emerald-600 mt-1">
                        Faixa: {vendedorSelecionado.faixaPercentAtual.toFixed(1)}% ({vendedorSelecionado.faixaAtual.replace('_', ' ')}) • Regra: {vendedorSelecionado.regraOrigem}
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-orange-600 font-medium">Km rodados (Mês)</span>
                        <MapPin className="w-5 h-5 text-orange-600" />
                      </div>
                      <p className="text-2xl font-bold text-orange-900">{vendedorSelecionado.kmRodadosMes.toFixed(0)} km</p>
                      <p className="text-xs text-orange-700 mt-1">Custo: {vendedorSelecionado.custoKmMes.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€</p>
                    </div>

                    <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 p-6 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-cyan-600 font-medium">Visitas (Mês)</span>
                        <Calendar className="w-5 h-5 text-cyan-600" />
                      </div>
                      <p className="text-2xl font-bold text-cyan-900">{vendedorSelecionado.visitasMes}</p>
                      <p className="text-xs text-cyan-700 mt-1">
                        Realizadas: {vendedorSelecionado.visitasRealizadasMes} • Pendentes: {vendedorSelecionado.visitasPendentesMes} • Canceladas: {vendedorSelecionado.visitasCanceladasMes}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setMostrarModalPeriodo(true)}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
                  >
                    <Download className="w-5 h-5" />
                    Gerar Relatório (PDF)
                  </button>
                </div>
              )}

              {/* ABA CARTEIRA */}
              {abaAtiva === 'carteira' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Clientes Atribuídos</h3>
                      <p className="text-sm text-gray-600">{clientesDoVendedor.length} clientes</p>
                    </div>
                    <button
                      onClick={abrirModalAdicionarCliente}
                      className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar Cliente
                    </button>
                  </div>

                  <div className="space-y-2">
                    {clientesDoVendedor.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Nenhum cliente atribuído</p>
                      </div>
                    ) : (
                      clientesDoVendedor.map((cliente) => (
                        <div key={cliente.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                          <div className="flex items-center gap-3">
                            <Building2 className="w-5 h-5 text-gray-400" />
                            <div>
                              <p className="font-medium text-gray-900">{cliente.nome}</p>
                              <p className="text-sm text-gray-600">{cliente.localidade || 'N/A'}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                cliente.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {cliente.ativo ? 'Ativo' : 'Inativo'}
                            </span>

                            <button
                              onClick={() => removerClienteDoVendedor(cliente.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Remover cliente"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* ABA FATURAS & COMISSÃO (resumo apenas) */}
              {abaAtiva === 'vendas' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl">
                      <p className="text-sm text-green-600 font-medium mb-2">Comissão (Mês)</p>
                      <p className="text-2xl font-bold text-green-900">
                        {vendedorSelecionado.comissaoMes.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
                      </p>
                      <p className="text-xs text-green-700 mt-1">
                        Faixa atual: {vendedorSelecionado.faixaPercentAtual.toFixed(1)}% ({vendedorSelecionado.faixaAtual.replace('_', ' ')})
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl">
                      <p className="text-sm text-blue-600 font-medium mb-2">Faturação (Mês) sem IVA</p>
                      <p className="text-2xl font-bold text-blue-900">
                        {vendedorSelecionado.baseSemIvaMes.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
                      </p>
                      <p className="text-xs text-blue-700 mt-1">{vendedorSelecionado.numFaturasMes} faturas emitidas</p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl">
                      <p className="text-sm text-purple-600 font-medium mb-2">Frascos (Mês)</p>
                      <p className="text-2xl font-bold text-purple-900">{vendedorSelecionado.frascosMes}</p>
                    </div>
                  </div>

                  <div className="bg-white border rounded-xl p-4">
                    <p className="text-sm text-gray-600">
                      A listagem detalhada de faturas por vendedor é gerada no PDF (botão em “Painel Resumo”), pois o cálculo oficial da comissão usa{' '}
                      <span className="font-medium">faturas emitidas</span> e base{' '}
                      <span className="font-medium">sem IVA</span>.
                    </p>
                  </div>
                </div>
              )}

              {/* ABA KM & VISITAS */}
              {abaAtiva === 'km' && (
                <div className="space-y-6">
                  {/* KM */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900">Quilometragem</h3>
                      <button
                        onClick={abrirModalAdicionarKm}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar KM
                      </button>
                    </div>

                    <div className="space-y-2">
                      {kmDoVendedor.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p>Nenhum registro de quilometragem</p>
                        </div>
                      ) : (
                        kmDoVendedor.map((km) => (
                          <div key={km.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <MapPin className="w-5 h-5 text-gray-400" />
                              <div>
                                <p className="font-medium text-gray-900">{new Date(km.data).toLocaleDateString('pt-PT')}</p>
                                <p className="text-sm text-gray-600">{km.km} km</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <p className="font-bold text-blue-600">{km.valor.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€</p>

                              <button
                                onClick={() => abrirModalEditarKm(km)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Edit className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => excluirKm(km.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* VISITAS */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900">Visitas</h3>
                      <button
                        onClick={abrirModalAdicionarVisita}
                        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar Visita
                      </button>
                    </div>

                    <div className="space-y-2">
                      {visitasDoVendedor.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p>Nenhuma visita registrada</p>
                        </div>
                      ) : (
                        visitasDoVendedor.map((visita) => {
                          const cliente = clientes.find((c) => c.id === visita.cliente_id);

                          return (
                            <div key={visita.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <Calendar className="w-5 h-5 text-gray-400" />
                                <div>
                                  <p className="font-medium text-gray-900">{cliente?.nome || 'Cliente não encontrado'}</p>
                                  <p className="text-sm text-gray-600">{new Date(visita.data_visita).toLocaleDateString('pt-PT')}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                    String(visita.estado).toUpperCase() === 'REALIZADA'
                                      ? 'bg-green-100 text-green-800'
                                      : String(visita.estado).toUpperCase() === 'PENDENTE'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {String(visita.estado).toUpperCase()}
                                </span>

                                <button
                                  onClick={() => abrirModalEditarVisita(visita)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Editar"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>

                                <button
                                  onClick={() => excluirVisita(visita.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL PERÍODO */}
      {mostrarModalPeriodo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Período do Relatório</h2>
                <button onClick={() => setMostrarModalPeriodo(false)} className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors">
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    className="text-purple-600"
                    checked={tipoPeriodoRelatorio === 'MES_ATUAL'}
                    onChange={() => setTipoPeriodoRelatorio('MES_ATUAL')}
                  />
                  <span>Mês atual</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    className="text-purple-600"
                    checked={tipoPeriodoRelatorio === 'ULTIMOS_30'}
                    onChange={() => setTipoPeriodoRelatorio('ULTIMOS_30')}
                  />
                  <span>Últimos 30 dias</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    className="text-purple-600"
                    checked={tipoPeriodoRelatorio === 'MES_ANTERIOR'}
                    onChange={() => setTipoPeriodoRelatorio('MES_ANTERIOR')}
                  />
                  <span>Mês anterior</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    className="text-purple-600"
                    checked={tipoPeriodoRelatorio === 'PERSONALIZADO'}
                    onChange={() => setTipoPeriodoRelatorio('PERSONALIZADO')}
                  />
                  <span>Período personalizado</span>
                </label>
              </div>

              {tipoPeriodoRelatorio === 'PERSONALIZADO' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Data início</label>
                    <input
                      type="date"
                      value={dataInicioRelatorio}
                      onChange={(e) => setDataInicioRelatorio(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Data fim</label>
                    <input
                      type="date"
                      value={dataFimRelatorio}
                      onChange={(e) => setDataFimRelatorio(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setMostrarModalPeriodo(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-all"
                >
                  Cancelar
                </button>

                <button
                  onClick={async () => {
                    if (tipoPeriodoRelatorio === 'PERSONALIZADO' && (!dataInicioRelatorio || !dataFimRelatorio)) {
                      alert('Preencha as datas de início e fim.');
                      return;
                    }
                    await gerarRelatorioMensal();
                    setMostrarModalPeriodo(false);
                  }}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
                >
                  Gerar PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ADICIONAR CLIENTE */}
      {modalAdicionarCliente && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Adicionar Cliente à Carteira</h2>
                <button onClick={() => setModalAdicionarCliente(false)} className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors">
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Buscar cliente por nome ou localidade..."
                  value={buscaCliente}
                  onChange={(e) => setBuscaCliente(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {clientesDisponiveis.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhum cliente disponível</p>
                  </div>
                ) : (
                  clientesDisponiveis.map((cliente) => (
                    <div key={cliente.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <Building2 className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">{cliente.nome}</p>
                          <p className="text-sm text-gray-600">{cliente.localidade || 'N/A'}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => adicionarClienteAoVendedor(cliente.id)}
                        className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ADICIONAR KM */}
      {modalAdicionarKm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold">Adicionar Quilometragem</h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data</label>
                <input
                  type="date"
                  value={novaKm.data}
                  onChange={(e) => setNovaKm({ ...novaKm, data: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">KM Total</label>
                <input
                  type="number"
                  value={novaKm.km}
                  onChange={(e) => setNovaKm({ ...novaKm, km: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="120"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Valor Total (€)</label>
                <input
                  type="number"
                  value={valorCalculadoKm.toFixed(2)}
                  readOnly
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Calculado automaticamente: {novaKm.km} km × {safeNum(vendedorSelecionado?.custo_km).toFixed(2)}€/km
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={adicionarKm} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-all">
                  Adicionar
                </button>
                <button onClick={() => setModalAdicionarKm(false)} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-all">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR KM */}
      {modalEditarKm && kmSelecionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold">Editar Quilometragem</h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data</label>
                <input
                  type="date"
                  value={novaKm.data}
                  onChange={(e) => setNovaKm({ ...novaKm, data: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">KM Total</label>
                <input
                  type="number"
                  value={novaKm.km}
                  onChange={(e) => setNovaKm({ ...novaKm, km: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Valor Total (€)</label>
                <input
                  type="number"
                  value={valorCalculadoKm.toFixed(2)}
                  readOnly
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Calculado automaticamente: {novaKm.km} km × {safeNum(vendedorSelecionado?.custo_km).toFixed(2)}€/km
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={salvarEdicaoKm} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-all">
                  Salvar
                </button>
                <button onClick={() => setModalEditarKm(false)} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-all">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ADICIONAR VISITA */}
      {modalAdicionarVisita && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold">Adicionar Visita</h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cliente</label>
                <select
                  value={novaVisita.cliente_id}
                  onChange={(e) => setNovaVisita({ ...novaVisita, cliente_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Selecione um cliente</option>
                  {clientesDoVendedor.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nome} - {cliente.localidade || 'N/A'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data</label>
                <input
                  type="date"
                  value={novaVisita.data_visita}
                  onChange={(e) => setNovaVisita({ ...novaVisita, data_visita: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
                <select
                  value={novaVisita.estado}
                  onChange={(e) => setNovaVisita({ ...novaVisita, estado: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="PENDENTE">Pendente</option>
                  <option value="REALIZADA">Realizada</option>
                  <option value="CANCELADA">Cancelada</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notas (opcional)</label>
                <textarea
                  value={novaVisita.notas}
                  onChange={(e) => setNovaVisita({ ...novaVisita, notas: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  rows={3}
                  placeholder="Observações sobre a visita..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={adicionarVisita} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-all">
                  Adicionar
                </button>
                <button onClick={() => setModalAdicionarVisita(false)} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-all">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR VISITA */}
      {modalEditarVisita && visitaSelecionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold">Editar Visita</h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cliente</label>
                <select
                  value={novaVisita.cliente_id}
                  onChange={(e) => setNovaVisita({ ...novaVisita, cliente_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Selecione um cliente</option>
                  {clientesDoVendedor.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nome} - {cliente.localidade || 'N/A'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data</label>
                <input
                  type="date"
                  value={novaVisita.data_visita}
                  onChange={(e) => setNovaVisita({ ...novaVisita, data_visita: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
                <select
                  value={novaVisita.estado}
                  onChange={(e) => setNovaVisita({ ...novaVisita, estado: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="PENDENTE">Pendente</option>
                  <option value="REALIZADA">Realizada</option>
                  <option value="CANCELADA">Cancelada</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notas (opcional)</label>
                <textarea
                  value={novaVisita.notas}
                  onChange={(e) => setNovaVisita({ ...novaVisita, notas: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  rows={3}
                  placeholder="Observações sobre a visita..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={salvarEdicaoVisita} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-all">
                  Salvar
                </button>
                <button onClick={() => setModalEditarVisita(false)} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-all">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
