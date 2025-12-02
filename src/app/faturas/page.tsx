'use client';

import { useState, useMemo } from 'react';
import { FileText, Search, Calendar, DollarSign, CheckCircle, Clock, AlertCircle, XCircle } from 'lucide-react';
import { faturasMock } from '@/lib/data';
import { Fatura } from '@/lib/types';

export default function FaturasPage() {
  const [faturas] = useState<Fatura[]>(faturasMock);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');

  // Filtrar faturas
  const faturasFiltradas = useMemo(() => {
    return faturas.filter(fatura => {
      const matchSearch = fatura.cliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         fatura.numeroFatura?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = filtroStatus === 'todos' || fatura.status === filtroStatus;
      return matchSearch && matchStatus;
    });
  }, [faturas, searchTerm, filtroStatus]);

  // Estatísticas
  const stats = useMemo(() => {
    const totalFaturas = faturas.length;
    const faturasPagas = faturas.filter(f => f.status === 'pago').length;
    const faturasPendentes = faturas.filter(f => f.status === 'pendente').length;
    const faturasVencidas = faturas.filter(f => f.status === 'vencido').length;
    
    const valorTotal = faturas.reduce((acc, f) => acc + (f.valor || 0), 0);
    const valorRecebido = faturas
      .filter(f => f.status === 'pago')
      .reduce((acc, f) => acc + (f.valor || 0), 0);
    const valorPendente = faturas
      .filter(f => f.status === 'pendente')
      .reduce((acc, f) => acc + (f.valor || 0), 0);
    const valorVencido = faturas
      .filter(f => f.status === 'vencido')
      .reduce((acc, f) => acc + (f.valor || 0), 0);

    return {
      totalFaturas,
      faturasPagas,
      faturasPendentes,
      faturasVencidas,
      valorTotal,
      valorRecebido,
      valorPendente,
      valorVencido,
    };
  }, [faturas]);

  const getStatusConfig = (status: string) => {
    const configs = {
      pago: {
        badge: 'bg-green-100 text-green-800',
        icon: CheckCircle,
        label: 'Pago',
        color: 'text-green-600',
      },
      pendente: {
        badge: 'bg-yellow-100 text-yellow-800',
        icon: Clock,
        label: 'Pendente',
        color: 'text-yellow-600',
      },
      vencido: {
        badge: 'bg-red-100 text-red-800',
        icon: AlertCircle,
        label: 'Vencido',
        color: 'text-red-600',
      },
      cancelado: {
        badge: 'bg-gray-100 text-gray-800',
        icon: XCircle,
        label: 'Cancelado',
        color: 'text-gray-600',
      },
    };
    return configs[status as keyof typeof configs] || configs.pendente;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

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
            Valor: R$ {stats.valorTotal.toFixed(2)}
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
            R$ {stats.valorRecebido.toFixed(2)}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-yellow-100 p-3 rounded-xl">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pendentes</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.faturasPendentes}</p>
            </div>
          </div>
          <p className="text-sm text-yellow-600 font-semibold">
            R$ {stats.valorPendente.toFixed(2)}
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
            R$ {stats.valorVencido.toFixed(2)}
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
            <option value="pendente">Pendentes</option>
            <option value="vencido">Vencidas</option>
            <option value="cancelado">Canceladas</option>
          </select>
        </div>
      </div>

      {/* Lista de Faturas */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
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
              </tr>
            </thead>
            <tbody>
              {faturasFiltradas.map((fatura, index) => {
                const statusConfig = getStatusConfig(fatura.status);
                const StatusIcon = statusConfig.icon;
                
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
                          {fatura.numeroFatura || 'N/A'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 md:hidden">
                          {fatura.cliente || 'Cliente não informado'}
                        </p>
                        {fatura.formaPagamento && (
                          <p className="text-xs text-gray-400 mt-1">
                            {fatura.formaPagamento}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-900 hidden md:table-cell">
                      {fatura.cliente || 'Cliente não informado'}
                    </td>
                    <td className="py-4 px-4 text-center text-sm text-gray-600 hidden lg:table-cell">
                      <div className="flex items-center justify-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(fatura.dataEmissao)}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center text-sm text-gray-600 hidden lg:table-cell">
                      <div className="flex items-center justify-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(fatura.dataVencimento)}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-bold text-gray-900 text-sm sm:text-base">
                          R$ {(fatura.valor || 0).toFixed(2)}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${statusConfig.badge}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {faturasFiltradas.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Nenhuma fatura encontrada</p>
            <p className="text-gray-400 text-sm mt-2">Tente ajustar os filtros de busca</p>
          </div>
        )}
      </div>

      {/* Observações */}
      {faturasFiltradas.some(f => f.observacoes) && (
        <div className="mt-6 bg-blue-50 border-l-4 border-blue-500 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Observações Recentes
          </h3>
          <div className="space-y-2">
            {faturasFiltradas
              .filter(f => f.observacoes)
              .slice(0, 3)
              .map(fatura => (
                <div key={fatura.id} className="text-sm">
                  <span className="font-medium text-blue-900">{fatura.numeroFatura}:</span>
                  <span className="text-blue-700 ml-2">{fatura.observacoes}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
