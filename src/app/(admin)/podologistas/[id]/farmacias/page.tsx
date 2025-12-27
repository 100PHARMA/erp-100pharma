'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Search, Building2, MapPin, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Farmacia {
  id: string;
  nome: string;
  nif: string | null;
  localidade: string | null;
  ativo: boolean;
  associada: boolean;
  associacaoId: string | null;
}

interface Podologista {
  id: string;
  nome: string;
}

export default function AssociarFarmaciasPage() {
  const params = useParams();
  const router = useRouter();
  const podologistaId = params.id as string;

  const [podologista, setPodologista] = useState<Podologista | null>(null);
  const [farmacias, setFarmacias] = useState<Farmacia[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [processando, setProcessando] = useState<string | null>(null);

  useEffect(() => {
    carregarDados();
  }, [podologistaId]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      // Buscar dados do podologista
      const { data: podologistaData, error: podologistaError } = await supabase
        .from('podologistas')
        .select('id, nome')
        .eq('id', podologistaId)
        .single();

      if (podologistaError) throw podologistaError;
      setPodologista(podologistaData);

      // Buscar TODAS as farmácias da tabela clientes (com ou sem filtro de ativo)
      const { data: farmaciasData, error: farmaciasError } = await supabase
        .from('clientes')
        .select('id, nome, nif, localidade, ativo')
        .order('nome');

      if (farmaciasError) {
        console.error('Erro ao buscar farmácias:', farmaciasError);
        throw farmaciasError;
      }

      console.log('Farmácias carregadas:', farmaciasData?.length || 0);

      // Buscar associações existentes para este podologista
      const { data: associacoesData, error: associacoesError } = await supabase
        .from('podologista_farmacia')
        .select('id, farmacia_id, ativo')
        .eq('podologista_id', podologistaId);

      if (associacoesError) {
        console.error('Erro ao buscar associações:', associacoesError);
        throw associacoesError;
      }

      console.log('Associações carregadas:', associacoesData?.length || 0);

      // Mapear farmácias com status de associação
      const farmaciasComAssociacao: Farmacia[] = (farmaciasData || []).map((farmacia) => {
        const associacao = (associacoesData || []).find(
          (a) => a.farmacia_id === farmacia.id && a.ativo === true
        );
        return {
          ...farmacia,
          associada: !!associacao,
          associacaoId: associacao?.id || null,
        };
      });

      console.log('Farmácias mapeadas:', farmaciasComAssociacao.length);
      setFarmacias(farmaciasComAssociacao);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAssociacao = async (farmacia: Farmacia) => {
    setProcessando(farmacia.id);
    try {
      if (farmacia.associada && farmacia.associacaoId) {
        // Desmarcar: atualizar para ativo = false
        const { error } = await supabase
          .from('podologista_farmacia')
          .update({ ativo: false })
          .eq('id', farmacia.associacaoId);

        if (error) throw error;
        toast.success(`Associação com ${farmacia.nome} removida`);
      } else {
        // Verificar se já existe um registro inativo
        const { data: existente, error: erroConsulta } = await supabase
          .from('podologista_farmacia')
          .select('id')
          .eq('podologista_id', podologistaId)
          .eq('farmacia_id', farmacia.id)
          .maybeSingle();

        if (erroConsulta) throw erroConsulta;

        if (existente) {
          // Reativar associação existente
          const { error } = await supabase
            .from('podologista_farmacia')
            .update({ ativo: true })
            .eq('id', existente.id);

          if (error) throw error;
        } else {
          // Criar nova associação
          const { error } = await supabase
            .from('podologista_farmacia')
            .insert({
              podologista_id: podologistaId,
              farmacia_id: farmacia.id,
              ativo: true,
            });

          if (error) throw error;
        }
        toast.success(`${farmacia.nome} associada com sucesso`);
      }

      // Recarregar dados
      await carregarDados();
    } catch (error) {
      console.error('Erro ao alterar associação:', error);
      toast.error('Erro ao alterar associação');
    } finally {
      setProcessando(null);
    }
  };

  const farmaciasFiltradas = farmacias.filter(
    (f) =>
      f.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.nif && f.nif.includes(searchTerm))
  );

  const totalAssociadas = farmacias.filter((f) => f.associada).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando dados...</p>
        </div>
      </div>
    );
  }

  if (!podologista) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Podologista não encontrado</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/podologistas')}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-700" />
            </button>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                Associar Farmácias
              </h1>
              <p className="text-gray-600 mt-1">
                Podologista: <span className="font-semibold">{podologista.nome}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-lg">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total de Farmácias</p>
                <p className="text-2xl font-bold text-gray-900">{farmacias.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-lg">
                <Building2 className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Farmácias Associadas</p>
                <p className="text-2xl font-bold text-gray-900">{totalAssociadas}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-4">
              <div className="bg-orange-100 p-3 rounded-lg">
                <Building2 className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Farmácias Disponíveis</p>
                <p className="text-2xl font-bold text-gray-900">
                  {farmacias.length - totalAssociadas}
                </p>
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
              placeholder="Pesquisar por nome ou NIF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Farmácias List */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Farmácia
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    NIF
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Localidade
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">
                    Atende esta Farmácia
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {farmaciasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      {farmacias.length === 0
                        ? 'Nenhuma farmácia cadastrada no sistema'
                        : 'Nenhuma farmácia encontrada com os filtros aplicados'}
                    </td>
                  </tr>
                ) : (
                  farmaciasFiltradas.map((farmacia) => (
                    <tr key={farmacia.id} className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-100 p-2 rounded-lg">
                            <Building2 className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{farmacia.nome}</p>
                            {!farmacia.ativo && (
                              <span className="text-xs text-red-600">(Inativa)</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-gray-600">
                          <FileText className="w-4 h-4" />
                          <span className="text-sm">{farmacia.nif || '-'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-gray-600">
                          <MapPin className="w-4 h-4" />
                          <span className="text-sm">{farmacia.localidade || '-'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => handleToggleAssociacao(farmacia)}
                            disabled={processando === farmacia.id}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                              farmacia.associada ? 'bg-blue-600' : 'bg-gray-200'
                            } ${processando === farmacia.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {processando === farmacia.id ? (
                              <Loader2 className="w-4 h-4 text-white animate-spin mx-auto" />
                            ) : (
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  farmacia.associada ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Gestão de Associações
              </h3>
              <p className="text-sm text-gray-700">
                Use os switches para associar ou desassociar farmácias deste podologista. As
                alterações são aplicadas imediatamente e refletem no sistema de comissões e
                relatórios.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
