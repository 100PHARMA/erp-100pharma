// src/app/vendedores/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  UserCircle,
  Plus,
  Search,
  Edit,
  Trash2,
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
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { buscarConfiguracaoFinanceira, type ConfiguracaoFinanceira } from '@/lib/configuracoes-financeiras';
import { gerarRelatorioVendedorPdf } from '@/lib/relatorio-vendedor-pdf';
import {
  getAnoMesAtualUtc,
  getVendedorMetricasMes,
  type VendedorMetricasMes,
} from '@/lib/vendedor-metricas';

// ======================================================================
// TIPOS E INTERFACES
// ======================================================================

interface Vendedor {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  salario_base: number;
  custo_km: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;

  // Dados calculados (MÊS ATUAL | SEM IVA | Faturas emitidas)
  vendasMes: number; // base_sem_iva
  comissaoMes: number; // comissao_calculada
  frascosMes: number;
  percentualMeta: number;
  clientesAtivos: number;
  kmRodadosMes: number;
  custoKmMes: number;
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
  estado: string;
  notas: string;
}

type FaturaRow = {
  id: string;
  numero: string;
  venda_id: string | null;
  cliente_id: string | null;
  tipo: string | null;
  estado: string | null;
  data_emissao: string; // timestamptz
  total_sem_iva: number | null;
  subtotal: number | null;
  vendas?: { id: string; vendedor_id: string } | null;
};

// ======================================================================
// HELPERS
// ======================================================================

function safeNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function monthRangeUtc(ano: number, mes: number) {
  // mes: 1..12
  const inicio = new Date(Date.UTC(ano, mes - 1, 1, 0, 0, 0));
  const fimExclusivo = new Date(Date.UTC(mes === 12 ? ano + 1 : ano, mes === 12 ? 0 : mes, 1, 0, 0, 0));
  const fimInclusiveDate = new Date(Date.UTC(ano, mes, 0, 0, 0, 0));

  return {
    inicioTsUtc: inicio.toISOString(),
    fimTsUtc: fimExclusivo.toISOString(),
    inicioDate: `${ano}-${pad2(mes)}-01`,
    fimDate: `${fimInclusiveDate.getUTCFullYear()}-${pad2(fimInclusiveDate.getUTCMonth() + 1)}-${pad2(
      fimInclusiveDate.getUTCDate(),
    )}`,
  };
}

function dayRangeUtcInclusive(inicioDate: string, fimDate: string) {
  // entrada: YYYY-MM-DD
  const [y1, m1, d1] = inicioDate.split('-').map(Number);
  const [y2, m2, d2] = fimDate.split('-').map(Number);

  const start = new Date(Date.UTC(y1, m1 - 1, d1, 0, 0, 0));
  const endExclusive = new Date(Date.UTC(y2, m2 - 1, d2, 0, 0, 0));
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  return { inicioTsUtc: start.toISOString(), fimTsUtc: endExclusive.toISOString() };
}

function calcComissaoProgressivaFromRegra(base: number, regra: {
  faixa1_limite: number;
  faixa1_percent: number;
  faixa2_limite: number;
  faixa2_percent: number;
  faixa3_percent: number;
}) {
  const b = Math.max(0, safeNum(base));
  const f1 = Math.max(0, safeNum(regra.faixa1_limite));
  const f2 = Math.max(0, safeNum(regra.faixa2_limite));
  const p1 = Math.max(0, safeNum(regra.faixa1_percent));
  const p2 = Math.max(0, safeNum(regra.faixa2_percent));
  const p3 = Math.max(0, safeNum(regra.faixa3_percent));

  const faixa2Valida = f2 > f1;

  if (b <= f1 || f1 === 0) return b * (p1 / 100);

  if (faixa2Valida && b <= f2) {
    const c1 = f1 * (p1 / 100);
    const c2 = (b - f1) * (p2 / 100);
    return c1 + c2;
  }

  const c1 = f1 * (p1 / 100);
  const c2 = faixa2Valida ? (f2 - f1) * (p2 / 100) : 0;
  const excedenteBase = faixa2Valida ? (b - f2) : (b - f1);
  const c3 = Math.max(0, excedenteBase) * (p3 / 100);
  return c1 + c2 + c3;
}

function calcPercentualMeta(base: number, meta: number) {
  const b = Math.max(0, safeNum(base));
  const m = safeNum(meta);
  if (m <= 0) return 0;
  const pct = (b / m) * 100;
  return Math.min(Math.max(pct, 0), 200);
}

// ======================================================================
// COMPONENTE PRINCIPAL
// ======================================================================

export default function VendedoresPage() {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vendedorClientes, setVendedorClientes] = useState<VendedorCliente[]>([]);
  const [quilometragens, setQuilometragens] = useState<Quilometragem[]>([]);
  const [visitas, setVisitas] = useState<Visita[]>([]);

  // Faturas do mês atual (emitidas, sem canceladas) para alimentar a aba "Vendas"
  const [faturasMes, setFaturasMes] = useState<FaturaRow[]>([]);
  const [frascosPorVendaMes, setFrascosPorVendaMes] = useState<Map<string, number>>(new Map());

  const [configFinanceira, setConfigFinanceira] = useState<ConfiguracaoFinanceira | null>(null);
  const [metricasMes, setMetricasMes] = useState<VendedorMetricasMes[]>([]);
  const metricasByVendedorId = useMemo(() => {
    const m = new Map<string, VendedorMetricasMes>();
    for (const r of metricasMes) m.set(r.vendedor_id, r);
    return m;
  }, [metricasMes]);

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

  const [vendedorSelecionado, setVendedorSelecionado] = useState<Vendedor | null>(null);
  const [kmSelecionada, setKmSelecionada] = useState<Quilometragem | null>(null);
  const [visitaSelecionada, setVisitaSelecionada] = useState<Visita | null>(null);

  const [abaAtiva, setAbaAtiva] = useState<'resumo' | 'carteira' | 'vendas' | 'km'>('resumo');
  const [buscaCliente, setBuscaCliente] = useState('');

  // Período do relatório do vendedor
  const [tipoPeriodoRelatorio, setTipoPeriodoRelatorio] = useState<
    'MES_ATUAL' | 'ULTIMOS_30' | 'MES_ANTERIOR' | 'PERSONALIZADO'
  >('MES_ATUAL');

  const [dataInicioRelatorio, setDataInicioRelatorio] = useState<string>('');
  const [dataFimRelatorio, setDataFimRelatorio] = useState<string>('');
  const [mostrarModalPeriodo, setMostrarModalPeriodo] = useState(false);

  // Estados para formulários
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
    estado: 'PENDENTE',
    notas: '',
  });

  // ======================================================================
  // INTERVALO DO RELATÓRIO (datas em UTC)
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
      case 'ULTIMOS_30': {
        fim = hoje;
        inicio = new Date(hoje);
        inicio.setDate(inicio.getDate() - 29);
        break;
      }
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
  // CARREGAMENTO DE DADOS DO SUPABASE (FONTE ÚNICA = vendedor-metricas)
  // ======================================================================

  useEffect(() => {
    carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const carregarDados = async () => {
    try {
      setCarregando(true);
      setErro(null);

      // 0) Ano/mês atual (UTC)
      const { ano, mes } = getAnoMesAtualUtc();
      const periodoMes = monthRangeUtc(ano, mes);

      // 1) Config global (para telas e fallback)
      const cfg = await buscarConfiguracaoFinanceira();
      setConfigFinanceira(cfg);

      // 2) Métricas do mês (SEM IVA, por faturas emitidas)
      const metricas = await getVendedorMetricasMes(ano, mes);
      setMetricasMes(metricas);

      // 3) Vendedores (dados cadastrais)
      const { data: vendedoresData, error: vendedoresError } = await supabase
        .from('vendedores')
        .select('*')
        .order('nome', { ascending: true });

      if (vendedoresError) throw vendedoresError;

      // 4) Clientes
      const { data: clientesData, error: clientesError } = await supabase
        .from('clientes')
        .select('*')
        .order('nome', { ascending: true });

      if (clientesError) throw clientesError;

      // 5) vendedor_clientes
      const { data: vendedorClientesData, error: vendedorClientesError } = await supabase
        .from('vendedor_clientes')
        .select('*');

      if (vendedorClientesError) throw vendedorClientesError;

      // 6) KM (mês e geral, para detalhe)
      const { data: quilometragensData, error: quilometragensError } = await supabase
        .from('vendedor_km')
        .select('*')
        .order('data', { ascending: false });

      if (quilometragensError) throw quilometragensError;

      // 7) Visitas (mês e geral, para detalhe)
      const { data: visitasData, error: visitasError } = await supabase
        .from('vendedor_visitas')
        .select('*')
        .order('data_visita', { ascending: false });

      if (visitasError) throw visitasError;

      // 8) Faturas emitidas do mês atual (para lista "Vendas Recentes" no modal)
      const { data: faturasData, error: faturasErr } = await supabase
        .from('faturas')
        .select('id, numero, venda_id, cliente_id, tipo, estado, data_emissao, total_sem_iva, subtotal, vendas!inner(id, vendedor_id)')
        .eq('tipo', 'FATURA')
        .neq('estado', 'CANCELADA')
        .gte('data_emissao', periodoMes.inicioTsUtc)
        .lt('data_emissao', periodoMes.fimTsUtc)
        .order('data_emissao', { ascending: false });

      if (faturasErr) throw faturasErr;

      const faturas = (faturasData ?? []) as FaturaRow[];
      setFaturasMes(faturas);

      // 8.1) frascos por venda_id (mês) — para mostrar frascos por fatura
      const vendaIds = Array.from(
        new Set(
          faturas
            .map((f) => f.venda_id)
            .filter((id): id is string => !!id),
        ),
      );

      const frascosMap = new Map<string, number>();
      if (vendaIds.length > 0) {
        const BATCH = 500;
        for (let i = 0; i < vendaIds.length; i += BATCH) {
          const chunk = vendaIds.slice(i, i + BATCH);
          const { data: itensData, error: itensErr } = await supabase
            .from('venda_itens')
            .select('venda_id, quantidade')
            .in('venda_id', chunk);

          if (itensErr) throw itensErr;

          for (const it of itensData ?? []) {
            const vid = it.venda_id as string;
            const q = safeNum((it as any).quantidade);
            frascosMap.set(vid, (frascosMap.get(vid) ?? 0) + q);
          }
        }
      }
      setFrascosPorVendaMes(frascosMap);

      // 9) Merge: vendedores + métricas (fonte única)
      const metricasById = new Map<string, VendedorMetricasMes>();
      for (const r of metricas) metricasById.set(r.vendedor_id, r);

      const vendedoresComMetricas = (vendedoresData || []).map((vendedor: any) => {
        const m = metricasById.get(vendedor.id);

        const vendasMes = safeNum(m?.base_sem_iva ?? 0);
        const comissaoMes = safeNum(m?.comissao_calculada ?? 0);
        const frascosMes = Math.trunc(safeNum(m?.frascos ?? 0));
        const percentualMeta = safeNum(m?.percentual_meta ?? 0);
        const clientesAtivos = Math.trunc(safeNum(m?.clientes_unicos ?? 0));
        const kmRodadosMes = safeNum(m?.km_rodados ?? 0);
        const custoKmMes = safeNum(m?.custo_km ?? 0);

        return {
          ...vendedor,
          vendasMes,
          comissaoMes,
          frascosMes,
          percentualMeta,
          clientesAtivos,
          kmRodadosMes,
          custoKmMes,
        } as Vendedor;
      });

      setVendedores(vendedoresComMetricas);
      setClientes((clientesData || []) as any);
      setVendedorClientes((vendedorClientesData || []) as any);
      setQuilometragens((quilometragensData || []) as any);
      setVisitas((visitasData || []) as any);
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
    const q = busca.trim().toLowerCase();
    if (!q) return vendedores;
    return vendedores.filter(
      (v) => v.nome.toLowerCase().includes(q) || (v.email || '').toLowerCase().includes(q),
    );
  }, [busca, vendedores]);

  // ======================================================================
  // FUNÇÕES DE MANIPULAÇÃO
  // ======================================================================

  const salvarNovoVendedor = async () => {
    if (!novoVendedor.nome || !novoVendedor.email) {
      alert('Preencha nome e email obrigatórios!');
      return;
    }

    try {
      const { error } = await supabase.from('vendedores').insert([
        {
          nome: novoVendedor.nome,
          email: novoVendedor.email,
          telefone: novoVendedor.telefone,
          salario_base: novoVendedor.salario_base,
          custo_km: novoVendedor.custo_km,
          ativo: true,
        },
      ]);

      if (error) throw error;

      setModalNovo(false);
      setNovoVendedor({
        nome: '',
        email: '',
        telefone: '',
        salario_base: 0,
        custo_km: 0.4,
      });

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

  const abrirDetalhes = (vendedor: Vendedor) => {
    setVendedorSelecionado(vendedor);
    setAbaAtiva('resumo');
    setModalDetalhes(true);
  };

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
      estado: visita.estado,
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
  // CARTEIRA: ADICIONAR/REMOVER
  // ======================================================================

  const abrirModalAdicionarCliente = () => {
    setBuscaCliente('');
    setModalAdicionarCliente(true);
  };

  const adicionarClienteAoVendedor = async (clienteId: string) => {
    if (!vendedorSelecionado) return;

    try {
      const { data: existente } = await supabase
        .from('vendedor_clientes')
        .select('*')
        .eq('vendedor_id', vendedorSelecionado.id)
        .eq('cliente_id', clienteId)
        .maybeSingle();

      if (existente?.id) {
        const { error } = await supabase.from('vendedor_clientes').update({ ativo: true }).eq('id', existente.id);
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
  // DADOS DO VENDEDOR SELECIONADO (DETALHES)
  // ======================================================================

  const clientesDoVendedor = useMemo(() => {
    if (!vendedorSelecionado) return [];
    return vendedorClientes
      .filter((vc) => vc.vendedor_id === vendedorSelecionado.id && vc.ativo)
      .map((vc) => clientes.find((c) => c.id === vc.cliente_id))
      .filter((c): c is Cliente => !!c);
  }, [vendedorSelecionado, vendedorClientes, clientes]);

  const kmDoVendedor = useMemo(() => {
    if (!vendedorSelecionado) return [];
    return quilometragens.filter((k) => k.vendedor_id === vendedorSelecionado.id);
  }, [vendedorSelecionado, quilometragens]);

  const visitasDoVendedor = useMemo(() => {
    if (!vendedorSelecionado) return [];
    return visitas.filter((v) => v.vendedor_id === vendedorSelecionado.id);
  }, [vendedorSelecionado, visitas]);

  const faturasDoVendedorMesAtual = useMemo(() => {
    if (!vendedorSelecionado) return [];
    return faturasMes.filter((f) => (f.vendas as any)?.vendedor_id === vendedorSelecionado.id);
  }, [vendedorSelecionado, faturasMes]);

  const clientesJaNaCarteira = useMemo(() => {
    if (!vendedorSelecionado) return [];
    return vendedorClientes
      .filter((vc) => vc.vendedor_id === vendedorSelecionado.id && vc.ativo)
      .map((vc) => vc.cliente_id);
  }, [vendedorSelecionado, vendedorClientes]);

  const clientesDisponiveis = useMemo(() => {
    const q = buscaCliente.trim().toLowerCase();
    return clientes
      .filter((c) => !clientesJaNaCarteira.includes(c.id))
      .filter((c) => c.nome.toLowerCase().includes(q) || (c.localidade || '').toLowerCase().includes(q));
  }, [clientes, clientesJaNaCarteira, buscaCliente]);

  const valorCalculadoKm = vendedorSelecionado ? novaKm.km * safeNum(vendedorSelecionado.custo_km) : 0;

  // ======================================================================
  // RELATÓRIO DO VENDEDOR (SEM IVA / FATURAS EMITIDAS)
  // ======================================================================

  const gerarRelatorioMensal = async () => {
    if (!vendedorSelecionado) return;
    if (!configFinanceira) {
      alert('Configuração financeira não carregada. Tente recarregar a página.');
      return;
    }

    try {
      const { dataInicio, dataFim } = calcularIntervaloRelatorio();
      const rangeTs = dayRangeUtcInclusive(dataInicio, dataFim);

      // 1) Buscar faturas emitidas no período (SEM IVA)
      const { data: faturasData, error: faturasErr } = await supabase
        .from('faturas')
        .select('id, numero, venda_id, cliente_id, tipo, estado, data_emissao, total_sem_iva, subtotal, vendas!inner(id, vendedor_id)')
        .eq('tipo', 'FATURA')
        .neq('estado', 'CANCELADA')
        .eq('vendas.vendedor_id', vendedorSelecionado.id)
        .gte('data_emissao', rangeTs.inicioTsUtc)
        .lt('data_emissao', rangeTs.fimTsUtc)
        .order('data_emissao', { ascending: true });

      if (faturasErr) throw faturasErr;

      const faturasPeriodo = (faturasData ?? []) as FaturaRow[];

      // 2) Frascos por venda_id (período)
      const vendaIds = Array.from(
        new Set(
          faturasPeriodo
            .map((f) => f.venda_id)
            .filter((id): id is string => !!id),
        ),
      );

      const frascosMap = new Map<string, number>();
      if (vendaIds.length > 0) {
        const BATCH = 500;
        for (let i = 0; i < vendaIds.length; i += BATCH) {
          const chunk = vendaIds.slice(i, i + BATCH);
          const { data: itensData, error: itensErr } = await supabase
            .from('venda_itens')
            .select('venda_id, quantidade')
            .in('venda_id', chunk);

          if (itensErr) throw itensErr;

          for (const it of itensData ?? []) {
            const vid = it.venda_id as string;
            const q = safeNum((it as any).quantidade);
            frascosMap.set(vid, (frascosMap.get(vid) ?? 0) + q);
          }
        }
      }

      const vendasPeriodo = faturasPeriodo.map((fat) => {
        const cliente = clientes.find((c) => c.id === fat.cliente_id);
        const frascos = fat.venda_id ? safeNum(frascosMap.get(fat.venda_id) ?? 0) : 0;
        const base = safeNum(fat.total_sem_iva ?? fat.subtotal ?? 0);
        return {
          id: fat.id,
          data: fat.data_emissao,
          cliente_nome: cliente?.nome || 'N/A',
          total_com_iva: base, // mantemos o campo que o PDF espera, mas aqui é SEM IVA
          frascos,
        };
      });

      const faturacaoPeriodo = vendasPeriodo.reduce((t, v) => t + safeNum(v.total_com_iva), 0);
      const frascosPeriodo = vendasPeriodo.reduce((t, v) => t + safeNum(v.frascos), 0);

      // 3) KM do período (tabela date)
      const { data: kmData, error: kmErr } = await supabase
        .from('vendedor_km')
        .select('id, vendedor_id, data, km, valor')
        .eq('vendedor_id', vendedorSelecionado.id)
        .gte('data', dataInicio)
        .lte('data', dataFim);

      if (kmErr) throw kmErr;

      const quilometragensPeriodo = (kmData ?? []) as Quilometragem[];
      const kmRodadosPeriodo = quilometragensPeriodo.reduce((t, r) => t + safeNum(r.km), 0);
      const custoKmPeriodo = quilometragensPeriodo.reduce((t, r) => t + safeNum(r.valor), 0);

      // 4) Visitas do período (tabela date)
      const { data: visitasData, error: visitasErr } = await supabase
        .from('vendedor_visitas')
        .select('id, vendedor_id, cliente_id, data_visita, estado, notas')
        .eq('vendedor_id', vendedorSelecionado.id)
        .gte('data_visita', dataInicio)
        .lte('data_visita', dataFim)
        .order('data_visita', { ascending: true });

      if (visitasErr) throw visitasErr;

      const visitasPeriodo = (visitasData ?? []).map((vis: any) => {
        const cliente = clientes.find((c) => c.id === vis.cliente_id);
        return {
          id: vis.id,
          data_visita: vis.data_visita,
          estado: vis.estado,
          notas: vis.notas,
          cliente_nome: cliente?.nome || 'N/A',
        };
      });

      // 5) Comissão/meta do período:
      //    Preferimos a regra do mês atual (quando aplicável) para consistência com o dashboard.
      let comissaoPeriodo = 0;
      let percentualMetaPeriodo = 0;

      const { ano: anoAtual, mes: mesAtual } = getAnoMesAtualUtc();
      const m = metricasByVendedorId.get(vendedorSelecionado.id);

      if (
        (tipoPeriodoRelatorio === 'MES_ATUAL' && m && m.ano === anoAtual && m.mes === mesAtual) ||
        (tipoPeriodoRelatorio === 'MES_ANTERIOR' && m) ||
        (tipoPeriodoRelatorio === 'ULTIMOS_30' && m) ||
        (tipoPeriodoRelatorio === 'PERSONALIZADO' && m && tipoPeriodoRelatorio !== 'PERSONALIZADO')
      ) {
        // Se existir métrica carregada, usamos a regra dela (faixas + meta usada) e recalculamos sobre o período.
        comissaoPeriodo = calcComissaoProgressivaFromRegra(faturacaoPeriodo, {
          faixa1_limite: m.faixa1_limite,
          faixa1_percent: m.faixa1_percent,
          faixa2_limite: m.faixa2_limite,
          faixa2_percent: m.faixa2_percent,
          faixa3_percent: m.faixa3_percent,
        });
        percentualMetaPeriodo = calcPercentualMeta(faturacaoPeriodo, m.meta_mensal_usada);
      } else {
        // Fallback global (aqui pode não refletir overrides mensais do vendedor em períodos “fora do mês atual”)
        comissaoPeriodo = calcComissaoProgressivaFromRegra(faturacaoPeriodo, {
          faixa1_limite: safeNum((configFinanceira as any).faixa1_limite),
          faixa1_percent: safeNum((configFinanceira as any).comissao_faixa1 ?? (configFinanceira as any).comissao_faixa1),
          faixa2_limite: safeNum((configFinanceira as any).faixa2_limite),
          faixa2_percent: safeNum((configFinanceira as any).comissao_faixa2 ?? (configFinanceira as any).comissao_faixa2),
          faixa3_percent: safeNum((configFinanceira as any).comissao_faixa3 ?? (configFinanceira as any).comissao_faixa3),
        });
        percentualMetaPeriodo = calcPercentualMeta(faturacaoPeriodo, safeNum((configFinanceira as any).meta_mensal));
      }

      const vendedorInfo = {
        nome: vendedorSelecionado.nome,
        email: vendedorSelecionado.email,
        telefone: vendedorSelecionado.telefone,
        ativo: vendedorSelecionado.ativo,
      };

      const resumo = {
        vendasMes: faturacaoPeriodo, // SEM IVA
        frascosMes: frascosPeriodo,
        comissaoMes: comissaoPeriodo,
        clientesAtivos: vendedorSelecionado.clientesAtivos,
        kmRodadosMes: kmRodadosPeriodo,
        custoKmMes: custoKmPeriodo,
        percentualMeta: percentualMetaPeriodo,

        vendasPeriodo: faturacaoPeriodo,
        frascosPeriodo,
        comissaoPeriodo,
        kmRodadosPeriodo,
        custoKmPeriodo,
        percentualMetaPeriodo,
      };

      await gerarRelatorioVendedorPdf({
        vendedor: vendedorInfo,
        intervalo: { dataInicio, dataFim },
        resumo,
        vendas: vendasPeriodo,
        quilometragens: quilometragensPeriodo,
        visitas: visitasPeriodo,
      });
    } catch (error: any) {
      console.error('Erro ao gerar relatório do vendedor:', error);
      alert('Erro ao gerar relatório do vendedor: ' + (error.message || 'Erro desconhecido'));
    }
  };

  // ======================================================================
  // RENDERIZAÇÃO
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
                <button
                  onClick={carregarDados}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Tentar Novamente
                </button>
                <button
                  onClick={() => (window.location.href = '/')}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                >
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
            <p className="text-gray-600">Gestão da equipa comercial (métricas por faturas emitidas, € sem IVA)</p>
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

      {/* Cards de Vendedores */}
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
            <div
              key={vendedor.id}
              className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300"
            >
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

                {/* Métricas (MÊS ATUAL / SEM IVA) */}
                <div className="border-t pt-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Faturas Emitidas (Mês)</span>
                    <span className="font-bold text-purple-600">
                      {vendedor.vendasMes.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                      €
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Frascos Vendidos</span>
                    <span className="font-bold text-blue-600">{vendedor.frascosMes}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Comissão (progressiva)</span>
                    <span className="font-bold text-green-600">
                      {vendedor.comissaoMes.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                      €
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-600">Meta Mensal</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {vendedor.percentualMeta.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(vendedor.percentualMeta, 100)}%` }}
                      />
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
                      vendedor.ativo
                        ? 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                        : 'bg-green-50 text-green-600 hover:bg-green-100'
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

      {/* Modal Novo Vendedor */}
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

      {/* Modal Detalhes do Vendedor */}
      {modalDetalhes && vendedorSelecionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{vendedorSelecionado.nome}</h2>
                  <p className="text-sm opacity-90">{vendedorSelecionado.email}</p>
                </div>
                <button
                  onClick={() => setModalDetalhes(false)}
                  className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
                >
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
                  { id: 'vendas', label: 'Faturas & Comissões', icon: DollarSign },
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
              {/* ABA: RESUMO */}
              {abaAtiva === 'resumo' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-blue-600 font-medium">Faturas Emitidas (Mês)</span>
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                      </div>
                      <p className="text-2xl font-bold text-blue-900">
                        {vendedorSelecionado.vendasMes.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
                      </p>
                      <p className="text-xs text-blue-700 mt-1">Base sem IVA</p>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-green-600 font-medium">Frascos Vendidos</span>
                        <Package className="w-5 h-5 text-green-600" />
                      </div>
                      <p className="text-2xl font-bold text-green-900">{vendedorSelecionado.frascosMes}</p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-purple-600 font-medium">Clientes Únicos (Mês)</span>
                        <Building2 className="w-5 h-5 text-purple-600" />
                      </div>
                      <p className="text-2xl font-bold text-purple-900">{vendedorSelecionado.clientesAtivos}</p>
                    </div>

                    <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-6 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-pink-600 font-medium">Meta Mensal</span>
                        <Target className="w-5 h-5 text-pink-600" />
                      </div>
                      <p className="text-2xl font-bold text-pink-900">{vendedorSelecionado.percentualMeta.toFixed(0)}%</p>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-emerald-600 font-medium">Comissão (Mês)</span>
                        <DollarSign className="w-5 h-5 text-emerald-600" />
                      </div>
                      <p className="text-2xl font-bold text-emerald-900">
                        {vendedorSelecionado.comissaoMes.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
                      </p>
                      <p className="text-xs text-emerald-600 mt-1">Progressiva, sem IVA</p>
                    </div>

                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-orange-600 font-medium">Km rodados no mês</span>
                        <MapPin className="w-5 h-5 text-orange-600" />
                      </div>
                      <p className="text-2xl font-bold text-orange-900">{vendedorSelecionado.kmRodadosMes.toFixed(0)} km</p>
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

              {/* ABA: CARTEIRA */}
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
                        <div
                          key={cliente.id}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
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

              {/* ABA: FATURAS & COMISSÕES */}
              {abaAtiva === 'vendas' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl">
                      <p className="text-sm text-green-600 font-medium mb-2">Comissão do Mês</p>
                      <p className="text-2xl font-bold text-green-900">
                        {vendedorSelecionado.comissaoMes.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
                      </p>
                      <p className="text-xs text-green-700 mt-1">Progressiva, base sem IVA</p>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl">
                      <p className="text-sm text-blue-600 font-medium mb-2">Faturas Emitidas (Mês)</p>
                      <p className="text-2xl font-bold text-blue-900">
                        {vendedorSelecionado.vendasMes.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
                      </p>
                      <p className="text-xs text-blue-700 mt-1">Sem IVA</p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl">
                      <p className="text-sm text-purple-600 font-medium mb-2">Frascos Vendidos (Mês)</p>
                      <p className="text-2xl font-bold text-purple-900">{vendedorSelecionado.frascosMes}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Faturas Recentes (Mês Atual)</h3>
                    <div className="space-y-2">
                      {faturasDoVendedorMesAtual.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p>Nenhuma fatura emitida no mês atual</p>
                        </div>
                      ) : (
                        faturasDoVendedorMesAtual.map((fat) => {
                          const cliente = clientes.find((c) => c.id === fat.cliente_id);
                          const base = safeNum(fat.total_sem_iva ?? fat.subtotal ?? 0);
                          const frascos = fat.venda_id ? safeNum(frascosPorVendaMes.get(fat.venda_id) ?? 0) : 0;

                          return (
                            <div key={fat.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                              <div>
                                <p className="font-medium text-gray-900">{cliente?.nome || 'Cliente não encontrado'}</p>
                                <p className="text-sm text-gray-600">
                                  {new Date(fat.data_emissao).toLocaleDateString('pt-PT')} • {frascos} frascos •{' '}
                                  {(fat.estado || 'N/A').toString()}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-purple-600">
                                  {base.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
                                </p>
                                <p className="text-sm text-gray-600">sem IVA</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ABA: QUILOMETRAGEM & VISITAS */}
              {abaAtiva === 'km' && (
                <div className="space-y-6">
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
                                <p className="font-medium text-gray-900">
                                  {new Date(km.data).toLocaleDateString('pt-PT')}
                                </p>
                                <p className="text-sm text-gray-600">{km.km} km</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-blue-600">
                                {safeNum(km.valor).toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
                              </p>
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
                                  <p className="text-sm text-gray-600">
                                    {new Date(visita.data_visita).toLocaleDateString('pt-PT')}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                    visita.estado === 'REALIZADA'
                                      ? 'bg-green-100 text-green-800'
                                      : visita.estado === 'PENDENTE'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {visita.estado}
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

      {/* Modal Período do Relatório */}
      {mostrarModalPeriodo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Período do Relatório</h2>
                <button
                  onClick={() => setMostrarModalPeriodo(false)}
                  className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
                >
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

      {/* Modal Adicionar Cliente */}
      {modalAdicionarCliente && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Adicionar Cliente à Carteira</h2>
                <button
                  onClick={() => setModalAdicionarCliente(false)}
                  className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
                >
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
                    <div
                      key={cliente.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
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

      {/* Modal Adicionar KM */}
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
                <button
                  onClick={adicionarKm}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-all"
                >
                  Adicionar
                </button>
                <button
                  onClick={() => setModalAdicionarKm(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar KM */}
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
                <button
                  onClick={salvarEdicaoKm}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-all"
                >
                  Salvar
                </button>
                <button
                  onClick={() => setModalEditarKm(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar Visita */}
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
                  onChange={(e) => setNovaVisita({ ...novaVisita, estado: e.target.value })}
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
                <button
                  onClick={adicionarVisita}
                  className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-all"
                >
                  Adicionar
                </button>
                <button
                  onClick={() => setModalAdicionarVisita(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Visita */}
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
                  onChange={(e) => setNovaVisita({ ...novaVisita, estado: e.target.value })}
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
                <button
                  onClick={salvarEdicaoVisita}
                  className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-all"
                >
                  Salvar
                </button>
                <button
                  onClick={() => setModalEditarVisita(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-all"
                >
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

