'use client';

import { useState } from 'react';
import { Trophy, Calendar, Award, Users, TrendingUp, Plus, X } from 'lucide-react';
import { concursosMock } from '@/lib/data';

interface Concurso {
  id: string;
  nome: string;
  descricao: string;
  tipo: 'VENDAS' | 'NOVAS_FARMACIAS' | 'VISITAS' | 'MISTO';
  dataInicio: string;
  dataFim: string;
  metaObjetivo: number;
  status: 'ATIVO' | 'ENCERRADO' | 'CANCELADO';
  premios: Array<{
    posicao: number;
    descricao: string;
    valor: number;
  }>;
  participantes: string[];
}

const statusColors = {
  ATIVO: 'bg-green-100 text-green-800',
  ENCERRADO: 'bg-gray-100 text-gray-800',
  CANCELADO: 'bg-red-100 text-red-800',
};

const statusLabels = {
  ATIVO: 'Ativo',
  ENCERRADO: 'Encerrado',
  CANCELADO: 'Cancelado',
};

const tipoLabels = {
  VENDAS: 'Vendas',
  NOVAS_FARMACIAS: 'Novas Farmácias',
  VISITAS: 'Visitas',
  MISTO: 'Misto',
};

export default function ConcursosPage() {
  const [showModal, setShowModal] = useState(false);
  const [concursos, setConcursos] = useState<Concurso[]>(concursosMock);
  const [novoConcurso, setNovoConcurso] = useState({
    nome: '',
    descricao: '',
    tipo: 'VENDAS' as 'VENDAS' | 'NOVAS_FARMACIAS' | 'VISITAS' | 'MISTO',
    dataInicio: '',
    dataFim: '',
    metaObjetivo: 0,
    status: 'ATIVO' as 'ATIVO' | 'ENCERRADO' | 'CANCELADO',
    premio1: 0,
    premio2: 0,
    premio3: 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoConcurso.nome || !novoConcurso.descricao || !novoConcurso.dataInicio || !novoConcurso.dataFim || novoConcurso.metaObjetivo <= 0) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    const concurso: Concurso = {
      id: (concursos.length + 1).toString(),
      nome: novoConcurso.nome,
      descricao: novoConcurso.descricao,
      tipo: novoConcurso.tipo,
      dataInicio: novoConcurso.dataInicio,
      dataFim: novoConcurso.dataFim,
      metaObjetivo: novoConcurso.metaObjetivo,
      status: novoConcurso.status,
      premios: [
        { posicao: 1, descricao: '1º Lugar', valor: novoConcurso.premio1 },
        { posicao: 2, descricao: '2º Lugar', valor: novoConcurso.premio2 },
        { posicao: 3, descricao: '3º Lugar', valor: novoConcurso.premio3 },
      ],
      participantes: [],
    };

    setConcursos([...concursos, concurso]);
    setShowModal(false);
    setNovoConcurso({
      nome: '',
      descricao: '',
      tipo: 'VENDAS',
      dataInicio: '',
      dataFim: '',
      metaObjetivo: 0,
      status: 'ATIVO',
      premio1: 0,
      premio2: 0,
      premio3: 0,
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
              Concursos
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Campanhas de incentivo e competições comerciais
            </p>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">Novo Concurso</span>
          </button>
        </div>
      </div>

      {/* Concursos List */}
      <div className="space-y-6">
        {concursos.map((concurso) => {
          const diasRestantes = Math.floor(
            (new Date(concurso.dataFim).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
          );

          return (
            <div
              key={concurso.id}
              className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300"
            >
              {/* Header com gradiente */}
              <div className="bg-gradient-to-r from-orange-500 to-red-600 p-6 text-white">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
                      <Trophy className="w-8 h-8" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold mb-1">{concurso.nome}</h2>
                      <p className="text-white/90 text-sm">{concurso.descricao}</p>
                    </div>
                  </div>
                  <span
                    className={`px-4 py-2 rounded-full text-sm font-medium ${
                      statusColors[concurso.status]
                    }`}
                  >
                    {statusLabels[concurso.status]}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4" />
                      <span className="text-xs">Início</span>
                    </div>
                    <p className="font-semibold">
                      {new Date(concurso.dataInicio).toLocaleDateString('pt-PT')}
                    </p>
                  </div>

                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4" />
                      <span className="text-xs">Fim</span>
                    </div>
                    <p className="font-semibold">
                      {new Date(concurso.dataFim).toLocaleDateString('pt-PT')}
                    </p>
                  </div>

                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-xs">Tipo</span>
                    </div>
                    <p className="font-semibold">{tipoLabels[concurso.tipo]}</p>
                  </div>

                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4" />
                      <span className="text-xs">Participantes</span>
                    </div>
                    <p className="font-semibold">{concurso.participantes.length}</p>
                  </div>
                </div>

                {concurso.status === 'ATIVO' && diasRestantes > 0 && (
                  <div className="mt-4 bg-white/10 backdrop-blur-sm rounded-lg p-3">
                    <p className="text-sm">
                      ⏱️ Faltam <span className="font-bold">{diasRestantes} dias</span> para o
                      término
                    </p>
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="p-6">
                {/* Meta */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-5 h-5 text-gray-600" />
                    <h3 className="font-semibold text-gray-900">Meta do Concurso</h3>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-3xl font-bold text-blue-600">
                      {concurso.metaObjetivo.toLocaleString('pt-PT')}
                      {concurso.tipo === 'VENDAS' ? '€' : ''}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {concurso.tipo === 'VENDAS' && 'Valor total de vendas'}
                      {concurso.tipo === 'NOVAS_FARMACIAS' && 'Novas farmácias cadastradas'}
                      {concurso.tipo === 'VISITAS' && 'Visitas realizadas'}
                      {concurso.tipo === 'MISTO' && 'Pontuação geral'}
                    </p>
                  </div>
                </div>

                {/* Prêmios */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Award className="w-5 h-5 text-gray-600" />
                    <h3 className="font-semibold text-gray-900">Premiação</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {concurso.premios.map((premio) => (
                      <div
                        key={premio.posicao}
                        className={`rounded-lg p-4 ${
                          premio.posicao === 1
                            ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white'
                            : premio.posicao === 2
                            ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-900'
                            : 'bg-gradient-to-br from-orange-300 to-orange-400 text-gray-900'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Trophy
                            className={`w-6 h-6 ${
                              premio.posicao === 1 ? 'text-white' : 'text-gray-700'
                            }`}
                          />
                          <span className="font-bold text-lg">{premio.descricao}</span>
                        </div>
                        <p className="text-2xl font-bold">
                          {premio.valor.toLocaleString('pt-PT')}€
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-6 flex gap-3">
                  <button className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors">
                    Ver Classificação
                  </button>
                  <button className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors">
                    Detalhes
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {concursos.length === 0 && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Nenhum concurso cadastrado</p>
        </div>
      )}

      {/* Modal Novo Concurso */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-red-600 text-white p-6 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-3">
                <Trophy className="w-8 h-8" />
                <h2 className="text-2xl font-bold">Novo Concurso</h2>
              </div>
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
                  Nome do Concurso *
                </label>
                <input
                  type="text"
                  value={novoConcurso.nome}
                  onChange={(e) => setNovoConcurso({ ...novoConcurso, nome: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Ex: Campanha Verão 2024"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descrição *
                </label>
                <textarea
                  value={novoConcurso.descricao}
                  onChange={(e) => setNovoConcurso({ ...novoConcurso, descricao: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  rows={3}
                  placeholder="Descreva o concurso..."
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Concurso *
                  </label>
                  <select
                    value={novoConcurso.tipo}
                    onChange={(e) => setNovoConcurso({ ...novoConcurso, tipo: e.target.value as any })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                  >
                    <option value="VENDAS">Vendas</option>
                    <option value="NOVAS_FARMACIAS">Novas Farmácias</option>
                    <option value="VISITAS">Visitas</option>
                    <option value="MISTO">Misto</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status *
                  </label>
                  <select
                    value={novoConcurso.status}
                    onChange={(e) => setNovoConcurso({ ...novoConcurso, status: e.target.value as any })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                  >
                    <option value="ATIVO">Ativo</option>
                    <option value="ENCERRADO">Encerrado</option>
                    <option value="CANCELADO">Cancelado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data de Início *
                  </label>
                  <input
                    type="date"
                    value={novoConcurso.dataInicio}
                    onChange={(e) => setNovoConcurso({ ...novoConcurso, dataInicio: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data de Término *
                  </label>
                  <input
                    type="date"
                    value={novoConcurso.dataFim}
                    onChange={(e) => setNovoConcurso({ ...novoConcurso, dataFim: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meta Objetivo *
                </label>
                <input
                  type="number"
                  value={novoConcurso.metaObjetivo}
                  onChange={(e) => setNovoConcurso({ ...novoConcurso, metaObjetivo: Number(e.target.value) })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Ex: 50000"
                  min="0"
                  required
                />
              </div>

              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Premiação</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      1º Lugar (€) *
                    </label>
                    <input
                      type="number"
                      value={novoConcurso.premio1}
                      onChange={(e) => setNovoConcurso({ ...novoConcurso, premio1: Number(e.target.value) })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="1000"
                      min="0"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      2º Lugar (€) *
                    </label>
                    <input
                      type="number"
                      value={novoConcurso.premio2}
                      onChange={(e) => setNovoConcurso({ ...novoConcurso, premio2: Number(e.target.value) })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="500"
                      min="0"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      3º Lugar (€) *
                    </label>
                    <input
                      type="number"
                      value={novoConcurso.premio3}
                      onChange={(e) => setNovoConcurso({ ...novoConcurso, premio3: Number(e.target.value) })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="250"
                      min="0"
                      required
                    />
                  </div>
                </div>
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
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg hover:shadow-lg font-medium transition-all"
                >
                  Criar Concurso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Target({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}
