'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, FileText, Calendar, User, CreditCard, 
  CheckCircle, Clock, AlertCircle, Download, Printer
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Fatura {
  id: string;
  numero: string;
  venda_id: string;
  cliente_nome: string;
  data_emissao: string;
  data_vencimento: string;
  total_sem_iva: number;
  total_iva: number;
  total_com_iva: number;
  valor_total: number;
  estado_pagamento: string;
  forma_pagamento: string;
  observacoes?: string;
}

export default function FaturaDetalhesPage() {
  const params = useParams();
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [fatura, setFatura] = useState<Fatura | null>(null);

  useEffect(() => {
    carregarFatura();
  }, [params.id]);

  const carregarFatura = async () => {
    try {
      setCarregando(true);
      
      const { data, error } = await supabase
        .from('faturas')
        .select('*')
        .eq('id', params.id)
        .single();

      if (error) throw error;
      setFatura(data);

    } catch (error: any) {
      console.error('Erro ao carregar fatura:', error);
      alert('Erro ao carregar fatura: ' + error.message);
    } finally {
      setCarregando(false);
    }
  };

  if (carregando) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando fatura...</p>
        </div>
      </div>
    );
  }

  if (!fatura) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <p className="text-lg font-semibold text-gray-900 mb-2">Fatura não encontrada</p>
          <button
            onClick={() => router.push('/faturas')}
            className="text-blue-600 hover:underline"
          >
            Voltar para faturas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/faturas')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar para Faturas
          </button>
        </div>

        {/* Fatura Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header da Fatura */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-8">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold mb-2">Fatura {fatura.numero}</h1>
                <p className="text-blue-100">ID: {fatura.id}</p>
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold ${
                  fatura.estado_pagamento === 'PAGA' ? 'bg-green-500 text-white' :
                  fatura.estado_pagamento === 'PENDENTE' ? 'bg-yellow-500 text-white' :
                  'bg-red-500 text-white'
                }`}>
                  {fatura.estado_pagamento === 'PAGA' && <CheckCircle className="w-4 h-4 mr-2" />}
                  {fatura.estado_pagamento === 'PENDENTE' && <Clock className="w-4 h-4 mr-2" />}
                  {fatura.estado_pagamento === 'VENCIDA' && <AlertCircle className="w-4 h-4 mr-2" />}
                  {fatura.estado_pagamento}
                </span>
              </div>
            </div>
          </div>

          {/* Conteúdo da Fatura */}
          <div className="p-8 space-y-6">
            {/* Informações do Cliente */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-blue-600 p-2 rounded-lg">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Cliente</h3>
                </div>
                <p className="text-gray-900 font-medium">{fatura.cliente_nome}</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-blue-600 p-2 rounded-lg">
                    <CreditCard className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Pagamento</h3>
                </div>
                <p className="text-gray-900 font-medium">{fatura.forma_pagamento || 'Não especificado'}</p>
              </div>
            </div>

            {/* Datas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center gap-4 bg-blue-50 rounded-xl p-4">
                <div className="bg-blue-600 p-3 rounded-lg">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Data de Emissão</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {new Date(fatura.data_emissao).toLocaleDateString('pt-PT')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-orange-50 rounded-xl p-4">
                <div className="bg-orange-600 p-3 rounded-lg">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Data de Vencimento</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {new Date(fatura.data_vencimento).toLocaleDateString('pt-PT')}
                  </p>
                </div>
              </div>
            </div>

            {/* Valores */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Valores</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total sem IVA</span>
                  <span className="text-lg font-semibold text-gray-900">
                    €{fatura.total_sem_iva.toFixed(2)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">IVA (23%)</span>
                  <span className="text-lg font-semibold text-gray-900">
                    €{fatura.total_iva.toFixed(2)}
                  </span>
                </div>
                
                <div className="border-t border-blue-300 pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-bold text-gray-900">Total com IVA</span>
                    <span className="text-3xl font-bold text-blue-600">
                      €{fatura.total_com_iva.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Observações */}
            {fatura.observacoes && (
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Observações</h3>
                <p className="text-gray-700">{fatura.observacoes}</p>
              </div>
            )}

            {/* Ações */}
            <div className="flex gap-4 pt-6 border-t border-gray-200">
              <button
                onClick={() => window.print()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Printer className="w-5 h-5" />
                Imprimir
              </button>
              
              <button
                onClick={() => alert('Funcionalidade de download em desenvolvimento')}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
