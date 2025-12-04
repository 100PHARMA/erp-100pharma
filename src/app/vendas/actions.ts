'use server';

import { supabase } from '@/lib/supabase';

export interface FinalizarVendaResult {
  success: boolean;
  faturaId?: string;
  error?: string;
}

/**
 * Finaliza uma venda e cria automaticamente a fatura correspondente
 * usando a função RPC do Supabase
 */
export async function finalizarVendaECriarFatura(vendaId: string): Promise<FinalizarVendaResult> {
  try {
    console.log('🚀 Iniciando finalização da venda:', vendaId);

    // Chamar a função RPC do Supabase
    const { data, error } = await supabase.rpc('finalizar_venda_e_criar_fatura', {
      p_venda_id: vendaId
    });

    if (error) {
      console.error('❌ Erro ao chamar RPC:', error);
      return {
        success: false,
        error: error.message || 'Erro ao finalizar venda e criar fatura'
      };
    }

    if (!data) {
      console.error('❌ RPC não retornou dados');
      return {
        success: false,
        error: 'Nenhuma fatura foi criada'
      };
    }

    console.log('✅ Fatura criada com sucesso:', data);

    return {
      success: true,
      faturaId: data.id
    };

  } catch (error: any) {
    console.error('❌ Erro inesperado ao finalizar venda:', error);
    return {
      success: false,
      error: error.message || 'Erro inesperado ao processar a venda'
    };
  }
}
