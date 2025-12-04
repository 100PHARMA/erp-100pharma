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
    console.log('🚀 [SERVER ACTION] Iniciando finalização da venda:', vendaId);
    console.log('📋 [SERVER ACTION] Parâmetros da RPC:', { p_venda_id: vendaId });

    // Chamar a função RPC do Supabase EXATAMENTE como funciona no SQL Editor
    const { data, error } = await supabase.rpc('finalizar_venda_e_criar_fatura', {
      p_venda_id: vendaId
    });

    console.log('📦 [SERVER ACTION] Resposta da RPC:', { data, error });

    if (error) {
      console.error('❌ [SERVER ACTION] Erro ao chamar RPC:', error);
      console.error('❌ [SERVER ACTION] Detalhes do erro:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return {
        success: false,
        error: error.message || 'Erro ao finalizar venda e criar fatura'
      };
    }

    if (!data) {
      console.error('❌ [SERVER ACTION] RPC não retornou dados');
      return {
        success: false,
        error: 'Nenhuma fatura foi criada. A RPC não retornou dados.'
      };
    }

    console.log('✅ [SERVER ACTION] Fatura criada com sucesso!');
    console.log('📄 [SERVER ACTION] Dados da fatura:', data);
    console.log('🆔 [SERVER ACTION] ID da fatura:', data.id);

    return {
      success: true,
      faturaId: data.id
    };

  } catch (error: any) {
    console.error('❌ [SERVER ACTION] Erro inesperado ao finalizar venda:', error);
    console.error('❌ [SERVER ACTION] Stack trace:', error.stack);
    return {
      success: false,
      error: error.message || 'Erro inesperado ao processar a venda'
    };
  }
}
