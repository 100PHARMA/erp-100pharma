'use client';

import { useState, useMemo } from 'react';
import { Target, TrendingUp, Users, Calendar, Award } from 'lucide-react';
import { metasMock } from '@/lib/data';

export default function MetasPage() {
  const [mesAno, setMesAno] = useState('2024-03');

  const stats = useMemo(() => {
    const totalMetaVendas = metasMock.reduce((acc, m) => acc + (Number(m.metaVendas) || 0), 0);
    const totalRealizadoVendas = metasMock.reduce((acc, m) => acc + (Number(m.realizadoVendas) || 0), 0);
    const percentualGeral = totalMetaVendas > 0 ? (totalRealizadoVendas / totalMetaVendas) * 100 : 0;
    const vendedoresAcimaMeta = metasMock.filter((m) => (Number(m.percentualVendas) || 0) >= 100).length;

    return { 
      totalMetaVendas: Number(totalMetaVendas) || 0, 
      totalRealizadoVendas: Number(totalRealizadoVendas) || 0, 
      percentualGeral: Number(percentualGeral) || 0, 
      vendedoresAcimaMeta: Number(vendedoresAcimaMeta) || 0 
    };
  }, []);

  // Função auxiliar para calcular percentual de forma segura
  const calcularPercentual = (realizado: number, meta: number): number => {
    const r = Number(realizado) || 0;
    const m = Number(meta) || 0;
    if (m === 0) return 0;
    const percentual = (r / m) * 100;
    return Number.isFinite(percentual) ? percentual : 0;
  };

  // Função auxiliar para formatar número de forma segura
  const formatarNumero = (valor: any): string => {
    const num = Number(valor);
    return Number.isFinite(num) ? num.toFixed(0) : '0';
  };

  // Função auxiliar para formatar moeda de forma segura
  const formatarMoeda = (valor: any): string => {
    const num = Number(valor);
    return Number.isFinite(num) ? num.toLocaleString('pt-PT') : '0';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
              Metas
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Acompanhamento de metas e desempenho da equipa
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
              <Target className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm text-gray-600">Meta Total</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900">
            {formatarMoeda(stats.totalMetaVendas)}€
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-green-100 p-2 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm text-gray-600">Realizado</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-green-600">
            {formatarMoeda(stats.totalRealizadoVendas)}€
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-purple-100 p-2 rounded-lg">
              <Award className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm text-gray-600">Atingimento</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-purple-600">
            {formatarNumero(stats.percentualGeral)}%
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-orange-100 p-2 rounded-lg">
              <Users className="w-5 h-5 text-orange-600" />
            </div>
            <span className="text-sm text-gray-600">Acima da Meta</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-orange-600">
            {formatarNumero(stats.vendedoresAcimaMeta)}
          </p>
        </div>
      </div>

      {/* Metas por Vendedor */}
      <div className="space-y-6">
        {metasMock.map((meta) => {
          // Calcular percentuais de forma segura
          const percentualVendas = calcularPercentual(meta.realizadoVendas, meta.metaVendas);
          const percentualFarmacias = calcularPercentual(meta.realizadoNovasFarmacias, meta.metaNovasFarmacias);
          const percentualVisitas = calcularPercentual(meta.realizadoVisitas, meta.metaVisitas);

          return (
            <div
              key={meta.id}
              className="bg-white rounded-xl shadow-lg p-4 sm:p-6 hover:shadow-xl transition-all duration-300"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{meta.vendedorNome || 'N/A'}</h3>
                    <p className="text-sm text-gray-500">
                      {meta.mesAno || 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Atingimento Geral</p>
                  <p
                    className={`text-2xl font-bold ${
                      percentualVendas >= 100
                        ? 'text-green-600'
                        : percentualVendas >= 80
                        ? 'text-blue-600'
                        : 'text-orange-600'
                    }`}
                  >
                    {formatarNumero(percentualVendas)}%
                  </p>
                </div>
              </div>

              {/* Vendas */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">Vendas</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-900">
                      {formatarMoeda(meta.realizadoVendas)}€
                    </span>
                    <span className="text-xs text-gray-500">
                      {' '}
                      / {formatarMoeda(meta.metaVendas)}€
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${
                      percentualVendas >= 100
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                        : percentualVendas >= 80
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-600'
                        : 'bg-gradient-to-r from-orange-500 to-red-600'
                    }`}
                    style={{ width: `${Math.min(percentualVendas, 100)}%` }}
                  />
                </div>
              </div>

              {/* Novas Farmácias */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">Novas Farmácias</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-900">
                      {formatarNumero(meta.realizadoNovasFarmacias)}
                    </span>
                    <span className="text-xs text-gray-500"> / {formatarNumero(meta.metaNovasFarmacias)}</span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${
                      percentualFarmacias >= 100
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                        : percentualFarmacias >= 80
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-600'
                        : 'bg-gradient-to-r from-orange-500 to-red-600'
                    }`}
                    style={{ width: `${Math.min(percentualFarmacias, 100)}%` }}
                  />
                </div>
              </div>

              {/* Visitas */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">Visitas</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-900">
                      {formatarNumero(meta.realizadoVisitas)}
                    </span>
                    <span className="text-xs text-gray-500"> / {formatarNumero(meta.metaVisitas)}</span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${
                      percentualVisitas >= 100
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                        : percentualVisitas >= 80
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-600'
                        : 'bg-gradient-to-r from-orange-500 to-red-600'
                    }`}
                    style={{ width: `${Math.min(percentualVisitas, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
