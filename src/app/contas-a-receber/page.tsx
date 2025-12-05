'use client';

import { useState, useMemo, useEffect } from 'react';
import { DollarSign, Search, Calendar, AlertCircle, Clock, Eye, CreditCard, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/utils/formatCurrency';
import Link from 'next/link';
import ModalPagamento from '../faturas/components/ModalPagamento';

interface Fatura {
  id: string;
  numero: string;
  cliente_id: string;
  cliente_nome?: string;
  data_emissao: string;
  data_vencimento: string;
  total_com_iva: number;
  valor_pago: number;
  estado: string;
}

export default function ContasAReceberPage() {
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroVencimento, setFiltroVencimento] = useState('todas');
  const [modalPagamento, setModalPagamento] = useState<{
    isOpen: boolean;
    fatura: Fatura | null;
  }>({ isOpen: false, fatura: null });

  // Carregar faturas em aberto do Supabase (PENDENTE e PARCIAL)
  const carregarFaturas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('faturas')
        .select(`
          id,
          numero,
          cliente_id,
          data_emissao,
          data_vencimento,
          total_com_iva,
          valor_pago,
          estado,
          clientes:cliente_id (
            nome
          )
        `)
        .neq('estado', 'PAGA')
        .order('data_vencimento', { ascending: true });

      if (error) {
        console.error('Erro ao carregar faturas:', error);
        setFaturas([]);
      } else {
        const faturasComCliente = (data || []).map((fatura: any) => ({
          ...fatura,
          cliente_nome: fatura.clientes?.nome || 'Cliente não informado',
          valor_pago: fatura.valor_pago || 0,
        }));
        setFaturas(faturasComCliente);
      }
    } catch (err) {
      console.error('Erro ao buscar faturas:', err);
      setFaturas([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarFaturas();
  }, []);

  // Determinar estado real baseado em valor_pago
  const getEstadoReal = (fatura: Fatura) => {
    const total = fatura.total_com_iva || 0;
    const pago = fatura.valor_pago || 0;
    
    if (pago >= total && pago > 0) {
      return 'PAGA';
    } else if (pago > 0 && pago < total) {
      return 'PARCIAL';
    } else {
      return 'PENDENTE';
    }
  };

  // Verificar se fatura está vencida
  const isVencida = (dataVencimento: string) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const vencimento = new Date(dataVencimento);
    vencimento.setHours(0, 0, 0, 0);
    return vencimento < hoje;
  };

  // Calcular dias
  const calcularDias = (dataVencimento: string) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const vencimento = new Date(dataVencimento);
    vencimento.setHours(0, 0, 0, 0);
    const diffTime = vencimento.getTime() - hoje.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Verificar se está no mês atual
  const isNoMesAtual = (dataVencimento: string) => {
    const hoje = new Date();
    const vencimento = new Date(dataVencimento);
    return vencimento.getMonth() === hoje.getMonth() && 
           vencimento.getFullYear() === hoje.getFullYear();
  };

  // Cards de resumo
  const resumo = useMemo(() => {
    const totalAReceber = faturas.reduce((acc, f) => {
      const saldo = (f.total_com_iva || 0) - (f.valor_pago || 0);
      return acc + Math.max(saldo, 0);
    }, 0);
    
    const aReceberNoMes = faturas
      .filter(f => isNoMesAtual(f.data_vencimento))
      .reduce((acc, f) => {
        const saldo = (f.total_com_iva || 0) - (f.valor_pago || 0);
        return acc + Math.max(saldo, 0);
      }, 0);
    
    const vencidas = faturas
      .filter(f => isVencida(f.data_vencimento))
      .reduce((acc, f) => {
        const saldo = (f.total_com_iva || 0) - (f.valor_pago || 0);
        return acc + Math.max(saldo, 0);
      }, 0);
    
    const percentualVencido = totalAReceber > 0 ? (vencidas / totalAReceber) * 100 : 0;

    return {
      totalAReceber,
      aReceberNoMes,
      vencidas,
      percentualVencido,
      quantidadeTotal: faturas.length,
      quantidadeVencidas: faturas.filter(f => isVencida(f.data_vencimento)).length,
    };
  }, [faturas]);

  // Filtrar faturas
  const faturasFiltradas = useMemo(() => {
    return faturas.filter(fatura => {
      // Filtro de busca
      const matchSearch = fatura.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         fatura.numero?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Filtro de status
      let matchStatus = true;
      if (filtroStatus === 'pendentes') {
        matchStatus = getEstadoReal(fatura) === 'PENDENTE' && !isVencida(fatura.data_vencimento);
      } else if (filtroStatus === 'parciais') {
        matchStatus = getEstadoReal(fatura) === 'PARCIAL';
      } else if (filtroStatus === 'vencidas') {
        matchStatus = isVencida(fatura.data_vencimento);
      }
      
      // Filtro de vencimento
      let matchVencimento = true;
      if (filtroVencimento === 'mes') {
        matchVencimento = isNoMesAtual(fatura.data_vencimento);
      }
      
      return matchSearch && matchStatus && matchVencimento;
    });
  }, [faturas, searchTerm, filtroStatus, filtroVencimento]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const handleAbrirModalPagamento = (fatura: Fatura) => {
    setModalPagamento({ isOpen: true, fatura });
  };

  const handleFecharModal = () => {
    setModalPagamento({ isOpen: false, fatura: null });
  };

  const handlePagamentoSucesso = () => {
    carregarFaturas();
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando contas a receber...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
          <DollarSign className="w-8 h-8 text-blue-600" />
          Contas a Receber
        </h1>
        <p className="text-gray-600 text-sm sm:text-base">
          Gestão de faturas em aberto
        </p>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-blue-100 p-3 rounded-xl">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total a Receber</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(resumo.totalAReceber)}
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-500">
            {resumo.quantidadeTotal} {resumo.quantidadeTotal === 1 ? 'fatura' : 'faturas'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-green-100 p-3 rounded-xl">
              <Calendar className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">A Receber no Mês</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(resumo.aReceberNoMes)}
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-500">
            Vencimento em {new Date().toLocaleDateString('pt-PT', { month: 'long' })}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-red-100 p-3 rounded-xl">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Vencidas</p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(resumo.vencidas)}
              </p>
            </div>
          </div>
          <p className="text-sm text-red-600 font-semibold">
            {resumo.quantidadeVencidas} {resumo.quantidadeVencidas === 1 ? 'fatura' : 'faturas'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-orange-100 p-3 rounded-xl">
              <TrendingDown className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">% Vencido</p>
              <p className="text-2xl font-bold text-orange-600">
                {resumo.percentualVencido.toFixed(1)}%
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-500">
            Do total a receber
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por cliente ou número..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Filtro Status */}
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          >
            <option value="todos">Todos os Status</option>
            <option value="pendentes">Pendentes</option>
            <option value="parciais">Parciais</option>
            <option value="vencidas">Vencidas</option>
          </select>

          {/* Filtro Vencimento */}
          <select
            value={filtroVencimento}
            onChange={(e) => setFiltroVencimento(e.target.value)}
            className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          >
            <option value="todas">Todas</option>
            <option value="mes">Somente este mês</option>
          </select>
        </div>
      </div>

      {/* Tabela de Faturas */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        {faturas.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-semibold">Nenhuma fatura em aberto</p>
            <p className="text-gray-400 text-sm mt-2">Todas as faturas estão pagas!</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                  <tr>
                    <th className="text-left py-4 px-4 sm:px-6 text-sm font-semibold">Número</th>
                    <th className="text-left py-4 px-4 text-sm font-semibold hidden md:table-cell">Cliente</th>
                    <th className="text-center py-4 px-4 text-sm font-semibold hidden lg:table-cell">Emissão</th>
                    <th className="text-center py-4 px-4 text-sm font-semibold">Vencimento</th>
                    <th className="text-center py-4 px-4 text-sm font-semibold hidden sm:table-cell">Dias</th>
                    <th className="text-right py-4 px-4 text-sm font-semibold">Total</th>
                    <th className="text-right py-4 px-4 text-sm font-semibold hidden lg:table-cell">Pago</th>
                    <th className="text-right py-4 px-4 text-sm font-semibold">Em Aberto</th>
                    <th className="text-center py-4 px-4 text-sm font-semibold">Status</th>
                    <th className="text-center py-4 px-4 text-sm font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {faturasFiltradas.map((fatura, index) => {
                    const vencida = isVencida(fatura.data_vencimento);
                    const dias = calcularDias(fatura.data_vencimento);
                    const estadoReal = getEstadoReal(fatura);
                    const total = fatura.total_com_iva || 0;
                    const pago = fatura.valor_pago || 0;
                    const emAberto = Math.max(total - pago, 0);
                    
                    return (
                      <tr 
                        key={fatura.id} 
                        className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                          index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                        }`}
                      >
                        <td className="py-4 px-4 sm:px-6">
                          <div>
                            <p className="font-semibold text-gray-900 text-sm sm:text-base">
                              {fatura.numero || 'N/A'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1 md:hidden">
                              {fatura.cliente_nome || 'Cliente não informado'}
                            </p>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-sm text-gray-900 hidden md:table-cell">
                          {fatura.cliente_nome || 'Cliente não informado'}
                        </td>
                        <td className="py-4 px-4 text-center text-sm text-gray-600 hidden lg:table-cell">
                          <div className="flex items-center justify-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(fatura.data_emissao)}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center text-sm text-gray-600">
                          <div className="flex items-center justify-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(fatura.data_vencimento)}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center text-sm hidden sm:table-cell">
                          {vencida ? (
                            <span className="text-red-600 font-semibold">
                              {Math.abs(dias)} {Math.abs(dias) === 1 ? 'dia' : 'dias'} em atraso
                            </span>
                          ) : (
                            <span className="text-green-600 font-semibold">
                              {dias} {dias === 1 ? 'dia' : 'dias'} para vencer
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span className="font-bold text-gray-900 text-sm sm:text-base">
                            {formatCurrency(total)}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right hidden lg:table-cell">
                          <span className="font-semibold text-green-600 text-sm">
                            {formatCurrency(pago)}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span className="font-bold text-blue-600 text-sm sm:text-base">
                            {formatCurrency(emAberto)}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          {vencida ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                              <AlertCircle className="w-3 h-3" />
                              Vencida
                            </span>
                          ) : estadoReal === 'PARCIAL' ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
                              <Clock className="w-3 h-3" />
                              Parcial
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                              <Clock className="w-3 h-3" />
                              Pendente
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Link
                              href={`/faturas/${fatura.id}`}
                              className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                              <span className="hidden sm:inline">Ver</span>
                            </Link>
                            <button
                              onClick={() => handleAbrirModalPagamento(fatura)}
                              className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                              <CreditCard className="w-4 h-4" />
                              <span className="hidden sm:inline">Pagar</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {faturasFiltradas.length === 0 && faturas.length > 0 && (
              <div className="text-center py-12">
                <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">Nenhuma fatura encontrada</p>
                <p className="text-gray-400 text-sm mt-2">Tente ajustar os filtros de busca</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de Pagamento */}
      {modalPagamento.fatura && (
        <ModalPagamento
          fatura={{
            id: modalPagamento.fatura.id,
            numero: modalPagamento.fatura.numero,
            total_com_iva: modalPagamento.fatura.total_com_iva || 0,
            valor_pago: modalPagamento.fatura.valor_pago || 0,
          }}
          isOpen={modalPagamento.isOpen}
          onClose={handleFecharModal}
          onSuccess={handlePagamentoSucesso}
        />
      )}
    </div>
  );
}
