'use client';

import { useState } from 'react';
import { Plus, Search, User, TrendingUp, Award, DollarSign, X } from 'lucide-react';

interface Podologista {
  id: string;
  nome: string;
  nif: string;
  contacto: string;
  email: string;
  morada: string;
  totalVendas: number;
  totalIncentivos: number;
  ativo: boolean;
}

export default function PodologistasPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [novoPodologista, setNovoPodologista] = useState({
    nome: '',
    nif: '',
    contacto: '',
    email: '',
    morada: '',
    ativo: true,
  });

  const [podologistas, setPodologistas] = useState<Podologista[]>([
    {
      id: '1',
      nome: 'Dr. Pedro Almeida',
      nif: '123456789',
      contacto: '+351 91 234 5678',
      email: 'pedro.almeida@clinica.pt',
      morada: 'Rua das Flores, 45 - 1000-100 Lisboa',
      totalVendas: 450,
      totalIncentivos: 450.00,
      ativo: true,
    },
    {
      id: '2',
      nome: 'Dra. Sofia Costa',
      nif: '234567890',
      contacto: '+351 92 345 6789',
      email: 'sofia.costa@podologia.pt',
      morada: 'Av. da República, 123 - 4000-200 Porto',
      totalVendas: 680,
      totalIncentivos: 680.00,
      ativo: true,
    },
    {
      id: '3',
      nome: 'Dr. Miguel Santos',
      nif: '345678901',
      contacto: '+351 93 456 7890',
      email: 'miguel.santos@saude.pt',
      morada: 'Praça do Comércio, 78 - 3000-100 Coimbra',
      totalVendas: 320,
      totalIncentivos: 320.00,
      ativo: true,
    },
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoPodologista.nome || !novoPodologista.nif || !novoPodologista.contacto || !novoPodologista.email || !novoPodologista.morada) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    const podologista: Podologista = {
      id: (podologistas.length + 1).toString(),
      ...novoPodologista,
      totalVendas: 0,
      totalIncentivos: 0,
    };

    setPodologistas([...podologistas, podologista]);
    setShowModal(false);
    setNovoPodologista({
      nome: '',
      nif: '',
      contacto: '',
      email: '',
      morada: '',
      ativo: true,
    });
  };

  const filteredPodologistas = podologistas.filter(p =>
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.nif.includes(searchTerm) ||
    p.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPodologistas = podologistas.length;
  const totalVendas = podologistas.reduce((sum, p) => sum + p.totalVendas, 0);
  const totalIncentivos = podologistas.reduce((sum, p) => sum + p.totalIncentivos, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
              Podologistas
            </h1>
            <p className="text-gray-600 mt-1">
              Gestão de podologistas e incentivos
            </p>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105"
          >
            <Plus className="w-5 h-5" />
            Novo Podologista
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-lg">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Podologistas</p>
                <p className="text-2xl font-bold text-gray-900">{totalPodologistas}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Frascos</p>
                <p className="text-2xl font-bold text-gray-900">{totalVendas}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-4">
              <div className="bg-purple-100 p-3 rounded-lg">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Incentivos</p>
                <p className="text-2xl font-bold text-gray-900">
                  € {totalIncentivos.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-4">
              <div className="bg-orange-100 p-3 rounded-lg">
                <Award className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Média por Frasco</p>
                <p className="text-2xl font-bold text-gray-900">€ 1,00</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl shadow-md p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar por nome, NIF ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Podologistas List */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Podologista
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    NIF
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Contacto
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">
                    Total Frascos
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">
                    Total Incentivos
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">
                    Estado
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPodologistas.map((podologista) => (
                  <tr key={podologista.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-gray-900">{podologista.nome}</p>
                        <p className="text-sm text-gray-600">{podologista.morada}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900">{podologista.nif}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="text-sm text-gray-600">{podologista.contacto}</p>
                        <p className="text-sm text-gray-600">{podologista.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-semibold text-gray-900">{podologista.totalVendas}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-semibold text-green-600">
                        € {podologista.totalIncentivos.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          podologista.ativo
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {podologista.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                          Ver
                        </button>
                        <button className="px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                          Relatório
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Award className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Sistema de Incentivos
              </h3>
              <p className="text-sm text-gray-700 mb-3">
                Cada frasco vendido através de um podologista gera um incentivo de <strong>€ 1,00</strong>.
                Os relatórios são gerados trimestralmente e podem ser exportados em PDF ou Excel.
              </p>
              <button className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
                Gerar Relatório Trimestral
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Novo Podologista */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-2xl font-bold">Novo Podologista</h2>
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
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={novoPodologista.nome}
                  onChange={(e) => setNovoPodologista({ ...novoPodologista, nome: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Dr. João Silva"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    NIF *
                  </label>
                  <input
                    type="text"
                    value={novoPodologista.nif}
                    onChange={(e) => setNovoPodologista({ ...novoPodologista, nif: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="123456789"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contacto *
                  </label>
                  <input
                    type="tel"
                    value={novoPodologista.contacto}
                    onChange={(e) => setNovoPodologista({ ...novoPodologista, contacto: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+351 91 234 5678"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={novoPodologista.email}
                  onChange={(e) => setNovoPodologista({ ...novoPodologista, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="email@exemplo.pt"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Morada Completa *
                </label>
                <input
                  type="text"
                  value={novoPodologista.morada}
                  onChange={(e) => setNovoPodologista({ ...novoPodologista, morada: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Rua, Número - Código Postal Cidade"
                  required
                />
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={novoPodologista.ativo}
                    onChange={(e) => setNovoPodologista({ ...novoPodologista, ativo: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Podologista Ativo</span>
                </label>
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
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg font-medium transition-all"
                >
                  Cadastrar Podologista
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
