'use client';

import { useState, useMemo, useEffect } from 'react';
import { FileText, Search, Calendar, DollarSign, CheckCircle, Clock, AlertCircle, XCircle, Eye, CreditCard } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/utils/formatCurrency';
import Link from 'next/link';
import ModalPagamento from './components/ModalPagamento';

interface Fatura {
  id: string;
  numero: string;
  cliente_id: string;
  cliente_nome?: string;
  data_emissao: string;
  data_vencimento: string;
  total: number;
  total_com_iva?: number;
  valor_pago?: number;
  estado: string;
  metodo_pagamento?: string;
}

export default function FaturasPage() {
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [modalPagamento, setModalPagamento] = useState<{
    isOpen: boolean;
    fatura: Fatura | null;
  }>({ isOpen: false, fatura: null });

  // Carregar faturas do Supabase
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
          total,
          total_com_iva,
          valor_pago,
          estado,
          metodo_pagamento,
          clientes:cliente_id (
            nome
          )
        `)
        .order('data_emissao', { ascending: false });

      if (error) {
        console.error('Erro ao carregar faturas:', error);
        setFaturas([]);
      } else {
        // Mapear dados para incluir cliente_nome
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
    const total = fatura.total_com_iva || fatura.total || 0;
    const pago = fatura.valor_pago || 0;
    
    if (pago >= total && pago > 0) {
      return 'PAGA';
    } else if (pago > 0 && pago < total) {
      return 'PARCIAL';
    } else {
      return fatura.estado.toUpperCase();
    }
  };

  // Filtrar faturas
  const faturasFiltradas = useMemo(() => {
    return faturas.filter(fatura => {
      const matchSearch = fatura.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         fatura.numero?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const estadoReal = getEstadoReal(fatura);
      let matchStatus = true;
      
      if (filtroStatus === 'pago' || filtroStatus === 'paga') {
        matchStatus = estadoReal === 'PAGA';
      } else if (filtroStatus === 'pendente') {
        matchStatus = estadoReal === 'PENDENTE';
      } else if (filtroStatus === 'parcial') {
        matchStatus = estadoReal === 'PARCIAL';
      } else if (filtroStatus === 'vencido' || filtroStatus === 'vencida') {
        matchStatus = estadoReal === 'VENCIDO' || estadoReal === 'VENCIDA';
      } else if (filtroStatus === 'cancelado') {
        matchStatus = estadoReal === 'CANCELADO';
      }
      
      return matchSearch && (filtroStatus === 'todos' || matchStatus);
    });
  }, [faturas, searchTerm, filtroStatus]);

  // Estatísticas calculadas a partir dos dados reais
  const stats = useMemo(() => {
    const totalFaturas = faturas.length;
    const faturasPagas = faturas.filter(f => getEstadoReal(f) === 'PAGA').length;
    const faturasPendentes = faturas.filter(f => getEstadoReal(f) === 'PENDENTE').length;
    const faturasParciais = faturas.filter(f => getEstadoReal(f) === 'PARCIAL').length;
    const faturasVencidas = faturas.filter(f => {
      const estado = getEstadoReal(f);
      return estado === 'VENCIDO' || estado === 'VENCIDA';
    }).length;
    
    const valorTotal = faturas.reduce((acc, f) => acc + (f.total_com_iva || f.total || 0), 0);
    const valorRecebido = faturas
      .filter(f => getEstadoReal(f) === 'PAGA')
      .reduce((acc, f) => acc + (f.valor_pago || f.total_com_iva || f.total || 0), 0);
    const valorPendente = faturas
      .filter(f => getEstadoReal(f) === 'PENDENTE')
      .reduce((acc, f) => {
        const total = f.total_com_iva || f.total || 0;
        const pago = f.valor_pago || 0;
        return acc + Math.max(total - pago, 0);
      }, 0);
    const valorParcial = faturas
      .filter(f => getEstadoReal(f) === 'PARCIAL')
      .reduce((acc, f) => {
        const total = f.total_com_iva || f.total || 0;
        const pago = f.valor_pago || 0;
        return acc + Math.max(total - pago, 0);
      }, 0);
    const valorVencido = faturas
      .filter(f => {
        const estado = getEstadoReal(f);
        return estado === 'VENCIDO' || estado === 'VENCIDA';
      })
      .reduce((acc, f) => {
        const total = f.total_com_iva || f.total || 0;
        const pago = f.valor_pago || 0;
        return acc + Math.max(total - pago, 0);
      }, 0);

    return {
      totalFaturas,
      faturasPagas,
      faturasPendentes,
      faturasParciais,
      faturasVencidas,
      valorTotal,
      valorRecebido,
      valorPendente: valorPendente + valorParcial,
      valorVencido,
    };
  }, [faturas]);

  const getStatusConfig = (fatura: Fatura) => {
    const estadoReal = getEstadoReal(fatura);
    
    const configs = {
      PAGA: {
        badge: 'bg-green-100 text-green-800',
        icon: CheckCircle,
        label: 'Paga',
        color: 'text-green-600',
      },
      PARCIAL: {
        badge: 'bg-orange-100 text-orange-800',
        icon: Clock,
        label: 'Parcial',
        color: 'text-orange-600',
      },
      PENDENTE: {
        badge: 'bg-yellow-100 text-yellow-800',
        icon: Clock,
        label: 'Pendente',
        color: 'text-yellow-600',
      },
      VENCIDO: {
        badge: 'bg-red-100 text-red-800',
        icon: AlertCircle,
        label: 'Vencido',
        color: 'text-red-600',
      },
      VENCIDA: {
        badge: 'bg-red-100 text-red-800',
        icon: AlertCircle,
        label: 'Vencida',
        color: 'text-red-600',
      },
      CANCELADO: {
        badge: 'bg-gray-100 text-gray-800',
        icon: XCircle,
        label: 'Cancelado',
        color: 'text-gray-600',
      },
    };
    return configs[estadoReal as keyof typeof configs] || configs.PENDENTE;
  };

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
    // Recarregar faturas após pagamento bem-sucedido
    carregarFaturas();
  };

  const podeRegistrarPagamento = (fatura: Fatura) => {
    const estadoReal = getEstadoReal(fatura);
    return estadoReal !== 'PAGA' && estadoReal !== 'CANCELADO';
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando faturas...</p>
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
          <FileText className="w-8 h-8 text-green-600" />
          Gestão de Faturas
        </h1>
        <p className="text-gray-600 text-sm sm:text-base">
          Controle financeiro e acompanhamento de pagamentos
        </p>
      </div>

      {/* Estatísticas Financeiras */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-blue-100 p-3 rounded-xl">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total de Faturas</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalFaturas}</p>
            </div>
          </div>
          <p className="text-sm text-gray-500">
            Valor: {formatCurrency(stats.valorTotal)}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-green-100 p-3 rounded-xl">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pagas</p>
              <p className="text-2xl font-bold text-green-600">{stats.faturasPagas}</p>
            </div>
          </div>
          <p className="text-sm text-green-600 font-semibold">
            {formatCurrency(stats.valorRecebido)}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-yellow-100 p-3 rounded-xl">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pendentes/Parciais</p>
              <p className="text-2xl font-bold text-yellow-600">
                {stats.faturasPendentes + stats.faturasParciais}
              </p>
            </div>
          </div>
          <p className="text-sm text-yellow-600 font-semibold">
            {formatCurrency(stats.valorPendente)}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-red-100 p-3 rounded-xl">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Vencidas</p>
              <p className="text-2xl font-bold text-red-600">{stats.faturasVencidas}</p>
            </div>
          </div>
          <p className="text-sm text-red-600 font-semibold">
            {formatCurrency(stats.valorVencido)}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por cliente ou número da fatura..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Filtro Status */}
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
          >
            <option value="todos">Todos os Status</option>
            <option value="pago">Pagas</option>
            <option value="parcial">Parciais</option>
            <option value="pendente">Pendentes</option>
            <option value="vencido">Vencidas</option>
            <option value="cancelado">Canceladas</option>
          </select>
        </div>
      </div>

      {/* Lista de Faturas */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        {faturas.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-semibold">Nenhuma fatura cadastrada</p>
            <p className="text-gray-400 text-sm mt-2">As faturas aparecerão aqui quando forem criadas</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-green-600 to-emerald-600 text-white">
                  <tr>
                    <th className="text-left py-4 px-4 sm:px-6 text-sm font-semibold">Fatura</th>
                    <th className="text-left py-4 px-4 text-sm font-semibold hidden md:table-cell">Cliente</th>
                    <th className="text-center py-4 px-4 text-sm font-semibold hidden lg:table-cell">Emissão</th>
                    <th className="text-center py-4 px-4 text-sm font-semibold hidden lg:table-cell">Vencimento</th>
                    <th className="text-right py-4 px-4 text-sm font-semibold">Valor</th>
                    <th className="text-center py-4 px-4 text-sm font-semibold">Status</th>
                    <th className="text-center py-4 px-4 text-sm font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {faturasFiltradas.map((fatura, index) => {
                    const statusConfig = getStatusConfig(fatura);
                    const StatusIcon = statusConfig.icon;
                    const podePagar = podeRegistrarPagamento(fatura);
                    
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
                            {fatura.metodo_pagamento && (
                              <p className="text-xs text-gray-400 mt-1">
                                {fatura.metodo_pagamento}
                              </p>
                            )}
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
                        <td className="py-4 px-4 text-center text-sm text-gray-600 hidden lg:table-cell">
                          <div className="flex items-center justify-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {fatura.data_vencimento ? formatDate(fatura.data_vencimento) : 'N/A'}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-gray-900 text-sm sm:text-base">
                              {formatCurrency(fatura.total_com_iva || fatura.total || 0)}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${statusConfig.badge}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Link
                              href={`/faturas/${fatura.id}`}
                              className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                              <span className="hidden sm:inline">Ver</span>
                            </Link>
                            {podePagar && (
                              <button
                                onClick={() => handleAbrirModalPagamento(fatura)}
                                className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                              >
                                <CreditCard className="w-4 h-4" />
                                <span className="hidden sm:inline">Pagar</span>
                              </button>
                            )}
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
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
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
            total_com_iva: modalPagamento.fatura.total_com_iva || modalPagamento.fatura.total || 0,
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
