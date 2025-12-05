'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type FinalizarVendaButtonProps = {
  vendaId: string;        // UUID da venda
  estadoInicial: string;  // 'ABERTA' ou 'FECHADA'
  vendaNumero: string;    // Número da venda (ex: VD-001) para exibição
};

export default function FinalizarVendaButton({
  vendaId,
  estadoInicial,
  vendaNumero,
}: FinalizarVendaButtonProps) {
  const [estado, setEstado] = useState(estadoInicial);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleClick = async () => {
    if (loading) return;
    if (estado === 'FECHADA') return;

    // Confirmação do usuário
    const confirmar = confirm(
      `Deseja finalizar a venda ${vendaNumero} e emitir a fatura?\n\n` +
      'Esta ação irá:\n' +
      '- Fechar a venda\n' +
      '- Criar a fatura\n' +
      '- Registrar saídas no estoque\n' +
      '- Atualizar quantidades dos produtos'
    );

    if (!confirmar) return;

    try {
      setLoading(true);

      console.log('🎯 Chamando RPC finalizar_venda_e_criar_fatura');
      console.log('📋 Venda ID (UUID):', vendaId);
      console.log('📋 Venda Número:', vendaNumero);

      // Chamar a RPC do Supabase
      const { data, error } = await supabase.rpc('finalizar_venda_e_criar_fatura', {
        p_venda_id: vendaId, // IMPORTANTE: usar o UUID da venda, não o número
      });

      if (error) {
        console.error('❌ Erro ao finalizar venda:', error);
        toast.error(error.message || 'Erro ao finalizar venda');
        return;
      }

      console.log('✅ Fatura criada com sucesso:', data);

      // data é a fatura criada
      if (data) {
        // Atualizar estado local
        setEstado('FECHADA');

        toast.success('Venda finalizada e fatura emitida com sucesso!');

        // Recarregar a página para atualizar todos os dados
        router.refresh();

        // Perguntar se deseja visualizar a fatura
        const irParaFatura = confirm('Deseja visualizar a fatura criada?');
        if (irParaFatura && data.id) {
          router.push(`/faturas/${data.id}`);
        }
      }
    } catch (error: any) {
      console.error('❌ Erro ao processar venda:', error);
      toast.error(`Erro ao finalizar venda: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Se já está fechada, não mostrar o botão
  if (estado === 'FECHADA') {
    return null;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 flex items-center gap-2 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
    >
      {loading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          Finalizando...
        </>
      ) : (
        <>
          <CheckCircle className="w-5 h-5" />
          Finalizar venda e emitir fatura
        </>
      )}
    </button>
  );
}
