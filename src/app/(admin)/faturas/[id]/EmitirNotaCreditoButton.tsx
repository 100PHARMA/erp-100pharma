'use client';

import { useState } from 'react';
import { FileText, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface EmitirNotaCreditoButtonProps {
  faturaId: string;
  faturaNumero: string;
  faturaEstado: string;
  faturaTipo: string;
}

export default function EmitirNotaCreditoButton({
  faturaId,
  faturaNumero,
  faturaEstado,
  faturaTipo,
}: EmitirNotaCreditoButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const router = useRouter();

  // Só mostrar botão se for FATURA e estiver PAGA
  if (faturaTipo !== 'FATURA' || faturaEstado !== 'PAGA') {
    return null;
  }

  const handleEmitirNotaCredito = async () => {
    if (loading) return;

    try {
      setLoading(true);

      const { data, error } = await supabase.rpc('emitir_nota_credito', {
        p_fatura_id: faturaId,
      });

      if (error) {
        console.error('Erro ao emitir nota de crédito:', error);
        toast.error(error.message || 'Erro ao emitir nota de crédito');
        return;
      }

      // Sucesso: redirecionar para a nota de crédito criada
      toast.success('Nota de crédito emitida com sucesso.');
      
      if (data && data.id) {
        router.push(`/faturas/${data.id}`);
      } else {
        // fallback: apenas recarregar a página atual
        router.refresh();
      }
    } catch (err: any) {
      console.error('Erro ao emitir nota de crédito:', err);
      toast.error(err?.message || 'Erro inesperado ao emitir nota de crédito');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl transition-colors"
      >
        <FileText className="w-5 h-5" />
        Emitir Nota de Crédito
      </button>

      {/* Dialog de Confirmação */}
      {showDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-orange-100 p-3 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Confirmar Emissão</h2>
            </div>

            <p className="text-gray-700 mb-6">
              Confirmar emissão de nota de crédito para a fatura <strong>{faturaNumero}</strong>?
              <br />
              <br />
              Esta ação irá:
            </p>

            <ul className="list-disc list-inside text-gray-700 mb-6 space-y-1">
              <li>Cancelar a fatura original</li>
              <li>Gerar estorno financeiro</li>
              <li>Reverter movimentações de estoque</li>
            </ul>

            <div className="flex gap-3">
              <button
                onClick={handleEmitirNotaCredito}
                disabled={loading}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white font-semibold rounded-xl transition-colors"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Emitindo...
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5" />
                    Confirmar
                  </>
                )}
              </button>
              <button
                onClick={() => setShowDialog(false)}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-700 font-semibold rounded-xl transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
