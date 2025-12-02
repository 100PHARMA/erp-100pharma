'use client';

import { useState, useMemo } from 'react';
import { DollarSign, FileText, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { contasReceberMock } from '@/lib/data';

const statusColors = {
  ABERTO: 'bg-blue-100 text-blue-800',
  PARCIAL: 'bg-yellow-100 text-yellow-800',
  PAGO: 'bg-green-100 text-green-800',
  VENCIDO: 'bg-red-100 text-red-800',
};

const statusLabels = {
  ABERTO: 'Em Aberto',
  PARCIAL: 'Parcial',
  PAGO: 'Pago',
  VENCIDO: 'Vencido',
};

export default function ContasReceberPage() {
  const [filterStatus, setFilterStatus] = useState<'TODOS' | 'ABERTO' | 'PARCIAL' | 'PAGO' | 'VENCIDO'>('TODOS');

  const contasFiltradas = useMemo(() => {
    if (filterStatus === 'TODOS') return contasReceberMock;
    return contasReceberMock.filter((c) => c.status === filterStatus);
  }, [filterStatus]);

  const stats = useMemo(() => {
    const totalReceber = contasReceberMock.reduce((acc, c) => acc + c.valorPendente, 0);
    const totalRecebido = contasReceberMock.reduce((acc, c) => acc + c.valorPago, 0);
    const totalVencido = contasReceberMock
      .filter((c) => c.status === 'VENCIDO')
      .reduce((acc, c) => acc + c.valorPendente, 0);
    const totalAberto = contasReceberMock
      .filter((c) => c.status === 'ABERTO')
      .reduce((acc, c) => acc + c.valorPendente, 0);

    return { totalReceber, totalRecebido, totalVencido, totalAberto };
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
          Contas a Receber
        </h1>
        <p className="text-gray-600 text-sm sm:text-base">
          Gestão financeira e controlo de recebimentos
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm text-gray-600">A Receber</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-blue-600">
            {stats.totalReceber.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-green-100 p-2 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm text-gray-600">Recebido</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-green-600">
            {stats.totalRecebido.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-red-100 p-2 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <span className="text-sm text-gray-600">Vencido</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-red-600">
            {stats.totalVencido.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-orange-100 p-2 rounded-lg">
              <FileText className="w-5 h-5 text-orange-600" />
            </div>
            <span className="text-sm text-gray-600">Em Aberto</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-orange-600">
            {stats.totalAberto.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-6">
        <div className="flex flex-wrap gap-2">
          {(['TODOS', 'ABERTO', 'PARCIAL', 'PAGO', 'VENCIDO'] as const).map((status) => (
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

      {/* Contas Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-4 px-4 sm:px-6 text-sm font-semibold text-gray-700">
                  Fatura
                </th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700 hidden md:table-cell">
                  Cliente
                </th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700 hidden lg:table-cell">
                  Emissão
                </th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700 hidden lg:table-cell">
                  Vencimento
                </th>
                <th className="text-right py-4 px-4 text-sm font-semibold text-gray-700">
                  Valor
                </th>
                <th className="text-right py-4 px-4 text-sm font-semibold text-gray-700 hidden xl:table-cell">
                  Pendente
                </th>
                <th className="text-center py-4 px-4 sm:px-6 text-sm font-semibold text-gray-700">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contasFiltradas.map((conta) => {
                const diasVencimento = Math.floor(
                  (new Date(conta.dataVencimento).getTime() - new Date().getTime()) /
                    (1000 * 60 * 60 * 24)
                );

                return (
                  <tr key={conta.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-4 sm:px-6">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{conta.numeroFatura}</p>
                          {conta.diasAtraso > 0 && (
                            <p className="text-xs text-red-600 font-medium">
                              {conta.diasAtraso} dias de atraso
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 hidden md:table-cell">
                      <span className="text-sm text-gray-900">{conta.clienteNome}</span>
                    </td>
                    <td className="py-4 px-4 hidden lg:table-cell">
                      <span className="text-sm text-gray-600">
                        {new Date(conta.dataEmissao).toLocaleDateString('pt-PT')}
                      </span>
                    </td>
                    <td className="py-4 px-4 hidden lg:table-cell">
                      <div>
                        <span className="text-sm text-gray-600">
                          {new Date(conta.dataVencimento).toLocaleDateString('pt-PT')}
                        </span>
                        {diasVencimento > 0 && diasVencimento <= 7 && (
                          <p className="text-xs text-orange-600 font-medium mt-1">
                            Vence em {diasVencimento} dias
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="text-sm font-medium text-gray-900">
                        {conta.valor.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right hidden xl:table-cell">
                      <span
                        className={`text-sm font-medium ${
                          conta.valorPendente > 0 ? 'text-orange-600' : 'text-green-600'
                        }`}
                      >
                        {conta.valorPendente.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
                      </span>
                    </td>
                    <td className="py-4 px-4 sm:px-6 text-center">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          statusColors[conta.status]
                        }`}
                      >
                        {statusLabels[conta.status]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {contasFiltradas.length === 0 && (
          <div className="text-center py-12">
            <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Nenhuma conta encontrada</p>
          </div>
        )}
      </div>
    </div>
  );
}
