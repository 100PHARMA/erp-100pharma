'use client';

import { useState, useMemo } from 'react';
import { MapPin, Calendar, Clock, Navigation, CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';
import { visitasMock } from '@/lib/data';

const statusColors = {
  AGENDADA: 'bg-blue-100 text-blue-800',
  REALIZADA: 'bg-green-100 text-green-800',
  CANCELADA: 'bg-red-100 text-red-800',
};

const statusIcons = {
  AGENDADA: AlertCircle,
  REALIZADA: CheckCircle,
  CANCELADA: XCircle,
};

const statusLabels = {
  AGENDADA: 'Agendada',
  REALIZADA: 'Realizada',
  CANCELADA: 'Cancelada',
};

interface Visita {
  id: string;
  clienteNome: string;
  vendedorNome: string;
  dataVisita: string;
  horaInicio: string;
  horaFim: string;
  objetivo: string;
  resultado?: string;
  proximaAcao?: string;
  kmPercorridos: number;
  status: 'AGENDADA' | 'REALIZADA' | 'CANCELADA';
}

export default function VisitasPage() {
  const [filterStatus, setFilterStatus] = useState<'TODOS' | 'AGENDADA' | 'REALIZADA' | 'CANCELADA'>('TODOS');
  const [showModal, setShowModal] = useState(false);
  const [visitas, setVisitas] = useState<Visita[]>(visitasMock);
  const [novaVisita, setNovaVisita] = useState({
    clienteNome: '',
    vendedorNome: '',
    dataVisita: '',
    horaInicio: '',
    horaFim: '',
    objetivo: '',
  });

  const visitasFiltradas = useMemo(() => {
    if (filterStatus === 'TODOS') return visitas;
    return visitas.filter((v) => v.status === filterStatus);
  }, [filterStatus, visitas]);

  const stats = useMemo(() => {
    const total = visitas.length;
    const agendadas = visitas.filter((v) => v.status === 'AGENDADA').length;
    const realizadas = visitas.filter((v) => v.status === 'REALIZADA').length;
    const totalKm = visitas
      .filter((v) => v.status === 'REALIZADA')
      .reduce((acc, v) => acc + v.kmPercorridos, 0);

    return { total, agendadas, realizadas, totalKm };
  }, [visitas]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaVisita.clienteNome || !novaVisita.vendedorNome || !novaVisita.dataVisita || !novaVisita.horaInicio || !novaVisita.horaFim || !novaVisita.objetivo) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    const visita: Visita = {
      id: (visitas.length + 1).toString(),
      ...novaVisita,
      kmPercorridos: 0,
      status: 'AGENDADA',
    };

    setVisitas([...visitas, visita]);
    setShowModal(false);
    setNovaVisita({
      clienteNome: '',
      vendedorNome: '',
      dataVisita: '',
      horaInicio: '',
      horaFim: '',
      objetivo: '',
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
              Visitas
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Gestão de visitas comerciais e acompanhamento
            </p>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105"
          >
            <Calendar className="w-5 h-5" />
            <span className="font-medium">Agendar Visita</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-100 p-2 rounded-lg">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm text-gray-600">Total</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.total}</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-orange-100 p-2 rounded-lg">
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </div>
            <span className="text-sm text-gray-600">Agendadas</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-orange-600">{stats.agendadas}</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-green-100 p-2 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm text-gray-600">Realizadas</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-green-600">{stats.realizadas}</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-purple-100 p-2 rounded-lg">
              <Navigation className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm text-gray-600">Total KM</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-purple-600">{stats.totalKm}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-6">
        <div className="flex flex-wrap gap-2">
          {(['TODOS', 'AGENDADA', 'REALIZADA', 'CANCELADA'] as const).map((status) => (
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

      {/* Visitas List */}
      <div className="space-y-4">
        {visitasFiltradas.map((visita) => {
          const StatusIcon = statusIcons[visita.status];
          return (
            <div
              key={visita.id}
              className="bg-white rounded-xl shadow-lg p-4 sm:p-6 hover:shadow-xl transition-all duration-300"
            >
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                {/* Left Section */}
                <div className="flex-1">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <MapPin className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 mb-1">{visita.clienteNome}</h3>
                      <p className="text-sm text-gray-600">Vendedor: {visita.vendedorNome}</p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                        statusColors[visita.status]
                      }`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {statusLabels[visita.status]}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(visita.dataVisita).toLocaleDateString('pt-PT')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>
                        {visita.horaInicio} - {visita.horaFim}
                      </span>
                    </div>
                    {visita.kmPercorridos > 0 && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Navigation className="w-4 h-4" />
                        <span>{visita.kmPercorridos} km</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-gray-600 mb-1">Objetivo</p>
                      <p className="text-sm text-gray-900">{visita.objetivo}</p>
                    </div>

                    {visita.resultado && (
                      <div className="bg-green-50 rounded-lg p-3">
                        <p className="text-xs text-gray-600 mb-1">Resultado</p>
                        <p className="text-sm text-gray-900">{visita.resultado}</p>
                      </div>
                    )}

                    {visita.proximaAcao && (
                      <div className="bg-orange-50 rounded-lg p-3">
                        <p className="text-xs text-gray-600 mb-1">Próxima Ação</p>
                        <p className="text-sm text-gray-900">{visita.proximaAcao}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {visitasFiltradas.length === 0 && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Nenhuma visita encontrada</p>
        </div>
      )}

      {/* Modal Agendar Visita */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-6 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-2xl font-bold">Agendar Nova Visita</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cliente *
                </label>
                <input
                  type="text"
                  value={novaVisita.clienteNome}
                  onChange={(e) => setNovaVisita({ ...novaVisita, clienteNome: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nome do cliente"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vendedor *
                </label>
                <input
                  type="text"
                  value={novaVisita.vendedorNome}
                  onChange={(e) => setNovaVisita({ ...novaVisita, vendedorNome: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nome do vendedor"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data da Visita *
                </label>
                <input
                  type="date"
                  value={novaVisita.dataVisita}
                  onChange={(e) => setNovaVisita({ ...novaVisita, dataVisita: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hora Início *
                  </label>
                  <input
                    type="time"
                    value={novaVisita.horaInicio}
                    onChange={(e) => setNovaVisita({ ...novaVisita, horaInicio: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hora Fim *
                  </label>
                  <input
                    type="time"
                    value={novaVisita.horaFim}
                    onChange={(e) => setNovaVisita({ ...novaVisita, horaFim: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Objetivo da Visita *
                </label>
                <textarea
                  value={novaVisita.objetivo}
                  onChange={(e) => setNovaVisita({ ...novaVisita, objetivo: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Descreva o objetivo da visita..."
                  rows={4}
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:shadow-lg font-medium transition-all"
                >
                  Agendar Visita
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
