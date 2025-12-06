'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Trophy, Award, TrendingUp, Search, Download } from 'lucide-react';
import {
  gerarRankingFarmaciasPdf,
  RankingFarmaciaRow,
} from '@/lib/ranking-farmacias-pdf';

interface IncentivoFarmacia {
  cliente_id: string;
  cliente_nome: string;
  total_frascos: number;
  total_fundo_farmaceutico: number;
}

export default function RankingFarmaciasPage() {
  const [loading, setLoading] = useState(true);
  const [farmacias, setFarmacias] = useState<IncentivoFarmacia[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [totalFarmacias, setTotalFarmacias] = useState(0);
  const [totalFrascos, setTotalFrascos] = useState(0);
  const [totalFundo, setTotalFundo] = useState(0);

  useEffect(() => {
    carregarRanking();
  }, []);

  const carregarRanking = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('vw_incentivos_farmacias')
        .select('cliente_id, cliente_nome, total_frascos, total_fundo_farmaceutico')
        .order('total_fundo_farmaceutico', { ascending: false });

      if (error) {
        console.error('Erro ao carregar ranking de farmácias:', error);
        toast.error('Erro ao carregar ranking de farmácias');
        setLoading(false);
        return;
      }

      const lista = (data || []).map((row) => ({
        cliente_id: row.cliente_id,
        cliente_nome: row.cliente_nome,
        total_frascos: Number(row.total_frascos || 0),
        total_fundo_farmaceutico: Number(row.total_fundo_farmaceutico || 0),
      })) as IncentivoFarmacia[];

      setFarmacias(lista);

      const totalFarms = lista.length;
      const totalFras = lista.reduce((sum, f) => sum + f.total_frascos, 0);
      const totalFund = lista.reduce(
        (sum, f) => sum + f.total_fundo_farmaceutico,
        0
      );

      setTotalFarmacias(totalFarms);
      setTotalFrascos(totalFras);
      setTotalFundo(totalFund);
    } catch (err) {
      console.error('Erro inesperado ao carregar ranking de farmácias:', err);
      toast.error('Erro inesperado ao carregar ranking');
    } finally {
      setLoading(false);
    }
  };

  const farmaciasFiltradas = farmacias.filter((f) =>
    f.cliente_nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportPdf = useCallback(() => {
    if (!farmacias || farmacias.length === 0) {
      alert('Não há dados no ranking para exportar.');
      return;
    }

    const rows: RankingFarmaciaRow[] = farmacias
      .slice()
      .sort((a, b) => b.total_frascos - a.total_frascos)
      .map((f) => ({
        farmacia_id: f.cliente_id,
        farmacia_nome: f.cliente_nome,
        frascos_validos: f.total_frascos,
        fundo_acumulado: f.total_fundo_farmaceutico,
      }));

    gerarRankingFarmaciasPdf({
      rows,
      totalFarmacias,
      totalFrascosValidos: totalFrascos,
      fundoTotal: totalFundo,
      tituloCampanha: 'Ranking Geral de Farmácias 100PHARMA',
    });
  }, [farmacias, totalFarmacias, totalFrascos, totalFundo]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando ranking de farmácias...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 flex items-center gap-3">
              <Trophy className="w-8 h-8 text-yellow-500" />
              Ranking de Farmácias
            </h1>
            <p className="text-gray-600 mt-1">
              Desempenho das farmácias com base em frascos vendidos e fundo farmacêutico acumulado.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleExportPdf}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              <Download className="w-4 h-4" />
              Exportar PDF
            </button>
          </div>
        </div>

        {/* Cards resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-md p-6 flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Award className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total de Farmácias no Ranking</p>
              <p className="text-2xl font-bold text-gray-900">{totalFarmacias}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 flex items-center gap-4">
            <div className="bg-green-100 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total de Frascos Válidos</p>
              <p className="text-2xl font-bold text-gray-900">{totalFrascos}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 flex items-center gap-4">
            <div className="bg-purple-100 p-3 rounded-lg">
              <Trophy className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Fundo Farmacêutico Total (€)</p>
              <p className="text-2xl font-bold text-gray-900">
                € {totalFundo.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {/* Pesquisa */}
        <div className="bg-white rounded-xl shadow-md p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar por nome da farmácia..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Tabela de ranking */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Posição
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Farmácia
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">
                    Frascos válidos
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">
                    Fundo acumulado (€)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {farmaciasFiltradas.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-8 text-center text-gray-500 text-sm"
                    >
                      Nenhuma farmácia encontrada para os critérios de pesquisa.
                    </td>
                  </tr>
                ) : (
                  farmaciasFiltradas
                    .slice()
                    .sort((a, b) => b.total_frascos - a.total_frascos)
                    .map((farmacia, index) => (
                      <tr
                        key={farmacia.cliente_id}
                        className="hover:bg-blue-50/50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-gray-900">
                            {farmacia.cliente_nome}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm font-semibold text-gray-900">
                            {farmacia.total_frascos}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-semibold text-purple-700">
                            €{' '}
                            {farmacia.total_fundo_farmaceutico.toLocaleString(
                              'pt-PT',
                              {
                                minimumFractionDigits: 2,
                              }
                            )}
                          </span>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info box */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <p className="text-sm text-gray-700">
            O ranking considera todas as faturas do tipo <strong>FATURA</strong> com estado{' '}
            <strong>PAGA</strong>. O valor do fundo farmacêutico por frasco respeita o histórico
            definido nas Configurações Financeiras, ou seja, cada fatura usa o valor que estava em
            vigor na data da venda/pagamento.
          </p>
        </div>
      </div>
    </div>
  );
}
