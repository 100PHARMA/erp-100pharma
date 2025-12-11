'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Stethoscope,
  Search,
  Calendar,
  TrendingUp,
  Package,
  AlertCircle
} from 'lucide-react';
import { formatCurrency } from '@/utils/formatCurrency';

// Deve ser exatamente o mesmo valor que usas na lógica das vendas
const INCENTIVO_PODOLOGISTA_PADRAO = 1.0; // € por frasco

type EstadoVenda = 'ORCAMENTO' | 'ABERTA' | 'FECHADA' | 'CANCELADA';

interface Podologista {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
}

interface Cliente {
  id: string;
  nome: string;
  tipo: string; // 'FARMACIA', 'CLINICA', etc.
}

interface VendaRelacionada {
  data: string;
  estado: EstadoVenda;
  clientes?: Cliente | null;
}

interface VendaItemComRelacoes {
  id: string;
  quantidade: number;
  total_linha: number;
  podologista_id: string | null;
  vendas?: VendaRelacionada | null;
}

export default function RelatorioPodologistasPage() {
  const [carregando, setCarregando] = useState(true);
  const [carregandoRelatorio, setCarregandoRelatorio] = useState(false);

  const [podologistas, setPodologistas] = useState<Podologista[]>([]);
  const [podologistaSelecionado, setPodologistaSelecionado] = useState('');

  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');

  const [itens, setItens] = useState<VendaItemComRelacoes[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  // ============================================================
  // CARREGAR LISTA DE PODOLOGISTAS
  // ============================================================

  useEffect(() => {
    const carregarPodologistas = async () => {
      try {
        setCarregando(true);
        setErro(null);

        const { data, error } = await supabase
          .from('podologistas')
          .select('id, nome, email, telefone')
          .order('nome', { ascending: true });

        if (error) throw error;

        setPodologistas(data || []);
      } catch (e: any) {
        console.error('Erro ao carregar podologistas:', e);
        setErro('Erro ao carregar lista de podologistas.');
      } finally {
        setCarregando(false);
      }
    };

    carregarPodologistas();
  }, []);

  // ============================================================
  // CARREGAR RELATÓRIO DO PODOLOGISTA SELECIONADO
  // ============================================================

  const carregarRelatorio = async () => {
    try {
      if (!podologistaSelecionado) {
        alert('Selecione um podologista.');
        return;
      }

      setCarregandoRelatorio(true);
      setErro(null);

      // Busca TODOS os itens ligados a esse podologista
      const { data, error } = await supabase
        .from('venda_itens')
        .select(`
          id,
          quantidade,
          total_linha,
          podologista_id,
          vendas (
            data,
            estado,
            clientes (
              id,
              nome,
              tipo
            )
          )
        `)
        .eq('podologista_id', podologistaSelecionado);

      if (error) throw error;

      const itensBrutos = (data || []) as any[];

      // Filtrar por data e por estado da venda (aqui considero só FECHADA)
      const itensFiltrados: VendaItemComRelacoes[] = itensBrutos.filter(
        (item: any) => {
          const venda = item.vendas as VendaRelacionada | null;
          if (!venda) return false;
          if (venda.estado !== 'FECHADA') return false;

          const dataVenda = new Date(venda.data);

          if (dataInicio) {
            const di = new Date(dataInicio);
            if (dataVenda < di) return false;
          }

          if (dataFim) {
            // incluir o dia final completo
            const df = new Date(dataFim);
            df.setHours(23, 59, 59, 999);
            if (dataVenda > df) return false;
          }

          return true;
        }
      );

      setItens(itensFiltrados);
    } catch (e: any) {
      console.error('Erro ao carregar relatório de podologista:', e);
      setErro('Erro ao carregar relatório. Verifique os dados e tente novamente.');
    } finally {
      setCarregandoRelatorio(false);
    }
  };

  // ============================================================
  // CÁLCULOS DO RESUMO
  // ============================================================

  const resumo = useMemo(() => {
    if (!itens || itens.length === 0) {
      return {
        totalFrascos: 0,
        incentivoTotal: 0,
        totalVendas: 0,
        totalFarmacias: 0
      };
    }

    const totalFrascos = itens.reduce(
      (acc, item) => acc + (item.quantidade || 0),
      0
    );

    const incentivoTotal = totalFrascos * INCENTIVO_PODOLOGISTA_PADRAO;

    // Número de vendas (contando venda única por data+cliente)
    const chavesVendas = new Set<string>();
    const farmacias = new Set<string>();

    itens.forEach((item) => {
      const venda = item.vendas;
      const cliente = venda?.clientes;

      if (venda) {
        const chave = `${venda.data}-${cliente?.id ?? ''}`;
        chavesVendas.add(chave);
      }

      if (cliente && cliente.tipo === 'FARMACIA') {
        farmacias.add(cliente.id);
      }
    });

    return {
      totalFrascos,
      incentivoTotal,
      totalVendas: chavesVendas.size,
      totalFarmacias: farmacias.size
    };
  }, [itens]);

  const podologistaAtual = podologistas.find(
    (p) => p.id === podologistaSelecionado
  );

  // ============================================================
  // RENDER
  // ============================================================

  if (carregando) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* HEADER */}
        <div className="bg-white rounded-2xl shadow-xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Stethoscope className="w-8 h-8 text-blue-600" />
              Relatório por Podologista
            </h1>
            <p className="text-gray-600 mt-1 text-sm">
              Total de frascos e incentivos pagos por podologista, com base nas vendas FECHADAS.
            </p>
          </div>
        </div>

        {/* FILTROS */}
        <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Podologista */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Podologista
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  value={podologistaSelecionado}
                  onChange={(e) => setPodologistaSelecionado(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">Selecione um podologista</option>
                  {podologistas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Data início */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Data início
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            {/* Data fim */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Data fim
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={carregarRelatorio}
              disabled={carregandoRelatorio}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-semibold flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              {carregandoRelatorio ? 'Gerando...' : 'Gerar Relatório'}
            </button>
          </div>

          {erro && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4" />
              <span>{erro}</span>
            </div>
          )}
        </div>

        {/* RESUMO */}
        {podologistaSelecionado && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">
                  Podologista selecionado
                </p>
                <p className="text-lg font-bold text-gray-900">
                  {podologistaAtual?.nome || '—'}
                </p>
              </div>
              <div className="text-right text-xs text-gray-500">
                {dataInicio || dataFim ? (
                  <span>
                    Período:{' '}
                    <strong>
                      {dataInicio || 'início'} até {dataFim || 'hoje'}
                    </strong>
                  </span>
                ) : (
                  <span>Período: todas as vendas FECHADAS</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-xs text-gray-600">Total de frascos</p>
                <p className="text-2xl font-bold text-blue-700 mt-1">
                  {resumo.totalFrascos}
                </p>
              </div>

              <div className="bg-green-50 rounded-xl p-4">
                <p className="text-xs text-gray-600">Incentivo total</p>
                <p className="text-2xl font-bold text-green-700 mt-1">
                  {formatCurrency(resumo.incentivoTotal)}
                </p>
                <p className="text-[11px] text-green-700 mt-1">
                  {INCENTIVO_PODOLOGISTA_PADRAO.toFixed(2)} € / frasco
                </p>
              </div>

              <div className="bg-orange-50 rounded-xl p-4">
                <p className="text-xs text-gray-600">N.º de vendas</p>
                <p className="text-2xl font-bold text-orange-700 mt-1">
                  {resumo.totalVendas}
                </p>
              </div>

              <div className="bg-purple-50 rounded-xl p-4">
                <p className="text-xs text-gray-600">Farmácias distintas</p>
                <p className="text-2xl font-bold text-purple-700 mt-1">
                  {resumo.totalFarmacias}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TABELA DETALHADA */}
        {podologistaSelecionado && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Detalhamento por venda / farmácia
                </h2>
              </div>
              <p className="text-xs text-gray-500">
                Total de linhas: {itens.length}
              </p>
            </div>

            {itens.length === 0 ? (
              <div className="py-10 text-center text-gray-500">
                <Package className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">
                  Nenhuma venda encontrada para os filtros selecionados.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                        Data
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                        Cliente
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                        Tipo
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">
                        Qtd frascos
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">
                        Incentivo linha
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {itens.map((item) => {
                      const venda = item.vendas;
                      const cliente = venda?.clientes;
                      const dataVenda = venda
                        ? new Date(venda.data).toLocaleDateString('pt-PT')
                        : '-';
                      const incentivoLinha =
                        (item.quantidade || 0) * INCENTIVO_PODOLOGISTA_PADRAO;

                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-xs text-gray-800">
                            {dataVenda}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-800">
                            {cliente?.nome || '-'}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {cliente?.tipo || '-'}
                          </td>
                          <td className="px-4 py-3 text-xs text-center font-semibold text-gray-900">
                            {item.quantidade}
                          </td>
                          <td className="px-4 py-3 text-xs text-right font-semibold text-gray-900">
                            {formatCurrency(incentivoLinha)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

