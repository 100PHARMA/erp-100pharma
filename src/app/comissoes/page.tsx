'use client';

import { useState, useMemo } from 'react';
import { TrendingUp, DollarSign, Award, Users, Calendar } from 'lucide-react';
import { comissoesMock, vendedoresMock } from '@/lib/data';

const statusColors = {
  CALCULADA: 'bg-blue-100 text-blue-800',
  APROVADA: 'bg-green-100 text-green-800',
  PAGA: 'bg-purple-100 text-purple-800',
};

const statusLabels = {
  CALCULADA: 'Calculada',
  APROVADA: 'Aprovada',
  PAGA: 'Paga',
};

export default function ComissoesPage() {
  const [mesAno, setMesAno] = useState('2024-03');

  const stats = useMemo(() => {
    const totalComissoes = comissoesMock.reduce((acc, c) => acc + c.totalComissao, 0);
    const totalFase1 = comissoesMock.reduce((acc, c) => acc + c.comissaoFase1, 0);
    const totalFase2 = comissoesMock.reduce((acc, c) => acc + c.comissaoFase2FarmaciasNovas + c.comissaoFase2FarmaciasAtivas, 0);
    const totalBonus = comissoesMock.reduce((acc, c) => acc + c.bonusVolume + c.bonusMarcos, 0);

    return { totalComissoes, totalFase1, totalFase2, totalBonus };
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
              Comissões
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Gestão de comissões Fase 1, Fase 2 e bónus
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-gray-400" />
            <input
              type="month"
              value={mesAno}
              onChange={(e) => setMesAno(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-100 p-2 rounded-lg">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm text-gray-600">Total</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900">
            {stats.totalComissoes.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-green-100 p-2 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm text-gray-600">Fase 1</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-green-600">
            {stats.totalFase1.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-purple-100 p-2 rounded-lg">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm text-gray-600">Fase 2</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-purple-600">
            {stats.totalFase2.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-orange-100 p-2 rounded-lg">
              <Award className="w-5 h-5 text-orange-600" />
            </div>
            <span className="text-sm text-gray-600">Bónus</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-orange-600">
            {stats.totalBonus.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
          </p>
        </div>
      </div>

      {/* Comissões Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-4 px-4 sm:px-6 text-sm font-semibold text-gray-700">
                  Vendedor
                </th>
                <th className="text-right py-4 px-4 text-sm font-semibold text-gray-700 hidden md:table-cell">
                  Vendas
                </th>
                <th className="text-right py-4 px-4 text-sm font-semibold text-gray-700 hidden lg:table-cell">
                  Fase 1
                </th>
                <th className="text-right py-4 px-4 text-sm font-semibold text-gray-700 hidden lg:table-cell">
                  Fase 2
                </th>
                <th className="text-right py-4 px-4 text-sm font-semibold text-gray-700 hidden xl:table-cell">
                  Bónus
                </th>
                <th className="text-right py-4 px-4 text-sm font-semibold text-gray-700">
                  Total
                </th>
                <th className="text-center py-4 px-4 sm:px-6 text-sm font-semibold text-gray-700">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {comissoesMock.map((comissao) => {
                const fase2Total = comissao.comissaoFase2FarmaciasNovas + comissao.comissaoFase2FarmaciasAtivas;
                const bonusTotal = comissao.bonusVolume + comissao.bonusMarcos;

                return (
                  <tr key={comissao.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-4 sm:px-6">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                          <Users className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{comissao.vendedorNome}</p>
                          <p className="text-sm text-gray-500">
                            {comissao.mes.toString().padStart(2, '0')}/{comissao.ano}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right hidden md:table-cell">
                      <span className="text-sm font-medium text-gray-900">
                        {comissao.totalVendas.toLocaleString('pt-PT')}€
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right hidden lg:table-cell">
                      <span className="text-sm text-green-600 font-medium">
                        {comissao.comissaoFase1.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right hidden lg:table-cell">
                      <span className="text-sm text-purple-600 font-medium">
                        {fase2Total.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right hidden xl:table-cell">
                      <span className="text-sm text-orange-600 font-medium">
                        {bonusTotal.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="text-base font-bold text-gray-900">
                        {comissao.totalComissao.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
                      </span>
                    </td>
                    <td className="py-4 px-4 sm:px-6 text-center">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          statusColors[comissao.status]
                        }`}
                      >
                        {statusLabels[comissao.status]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detalhamento Fase 2 */}
      <div className="mt-6 bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Detalhamento Fase 2</h2>
        <div className="space-y-4">
          {comissoesMock.map((comissao) => (
            <div key={comissao.id} className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">{comissao.vendedorNome}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-purple-50 rounded-lg p-3">
                  <p className="text-sm text-gray-600 mb-1">Farmácias Novas</p>
                  <p className="text-lg font-bold text-purple-600">
                    {comissao.comissaoFase2FarmaciasNovas.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
                  </p>
                </div>
                <div className="bg-indigo-50 rounded-lg p-3">
                  <p className="text-sm text-gray-600 mb-1">Farmácias Ativas</p>
                  <p className="text-lg font-bold text-indigo-600">
                    {comissao.comissaoFase2FarmaciasAtivas.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
