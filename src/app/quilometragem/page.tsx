'use client';

import { useState } from 'react';
import { Search, Car, MapPin, DollarSign, Calendar, TrendingUp } from 'lucide-react';

interface Quilometragem {
  id: string;
  vendedor: string;
  mes: string;
  totalKm: number;
  valorPorKm: number;
  totalReembolso: number;
  status: 'PENDENTE' | 'APROVADO' | 'PAGO';
}

export default function QuilometragemPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('TODOS');

  const [quilometragens] = useState<Quilometragem[]>([
    {
      id: '1',
      vendedor: 'João Silva',
      mes: 'Março 2024',
      totalKm: 1250,
      valorPorKm: 0.20,
      totalReembolso: 250.00,
      status: 'APROVADO',
    },
    {
      id: '2',
      vendedor: 'Maria Santos',
      mes: 'Março 2024',
      totalKm: 1850,
      valorPorKm: 0.20,
      totalReembolso: 370.00,
      status: 'PAGO',
    },
    {
      id: '3',
      vendedor: 'Carlos Oliveira',
      mes: 'Março 2024',
      totalKm: 980,
      valorPorKm: 0.20,
      totalReembolso: 196.00,
      status: 'PENDENTE',
    },
  ]);

  const getStatusConfig = (status: string) => {
    const configs = {
      PENDENTE: { color: 'bg-yellow-100 text-yellow-700', label: 'Pendente' },
      APROVADO: { color: 'bg-blue-100 text-blue-700', label: 'Aprovado' },
      PAGO: { color: 'bg-green-100 text-green-700', label: 'Pago' },
    };
    return configs[status as keyof typeof configs] || configs.PENDENTE;
  };

  const filteredQuilometragens = quilometragens.filter(q => {
    const matchSearch = q.vendedor.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       q.mes.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filtroStatus === 'TODOS' || q.status === filtroStatus;
    return matchSearch && matchStatus;
  });

  const totalKm = quilometragens.reduce((sum, q) => sum + q.totalKm, 0);
  const totalReembolso = quilometragens.reduce((sum, q) => sum + q.totalReembolso, 0);
  const pendentes = quilometragens.filter(q => q.status === 'PENDENTE').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
              Quilometragem
            </h1>
            <p className="text-gray-600 mt-1">
              Controle de quilometragem e reembolsos
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-lg">
                <Car className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total KM</p>
                <p className="text-2xl font-bold text-gray-900">{totalKm.toLocaleString('pt-PT')}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Reembolso</p>
                <p className="text-2xl font-bold text-gray-900">
                  € {totalReembolso.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-4">
              <div className="bg-orange-100 p-3 rounded-lg">
                <TrendingUp className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Valor por KM</p>
                <p className="text-2xl font-bold text-gray-900">€ 0,20</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-4">
              <div className="bg-yellow-100 p-3 rounded-lg">
                <Calendar className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Pendentes</p>
                <p className="text-2xl font-bold text-gray-900">{pendentes}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Pesquisar por vendedor ou mês..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="PENDENTE">Pendente</option>
              <option value="APROVADO">Aprovado</option>
              <option value="PAGO">Pago</option>
            </select>
          </div>
        </div>

        {/* Quilometragens List */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Vendedor
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Período
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">
                    Total KM
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">
                    Valor/KM
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">
                    Total Reembolso
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredQuilometragens.map((quilometragem) => {
                  const statusConfig = getStatusConfig(quilometragem.status);

                  return (
                    <tr key={quilometragem.id} className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="font-semibold text-gray-900">{quilometragem.vendedor}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900">{quilometragem.mes}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-semibold text-gray-900">
                          {quilometragem.totalKm.toLocaleString('pt-PT')} km
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm text-gray-600">
                          € {quilometragem.valorPorKm.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-semibold text-green-600">
                          € {quilometragem.totalReembolso.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                            Ver Detalhes
                          </button>
                          {quilometragem.status === 'PENDENTE' && (
                            <button className="px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                              Aprovar
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
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Car className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Cálculo de Quilometragem
              </h3>
              <p className="text-sm text-gray-700">
                O reembolso é calculado automaticamente com base no valor configurado de <strong>€ 0,20 por quilómetro</strong>.
                Os vendedores podem registar quilometragem inicial e final de cada visita, ou inserir o total diretamente.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
