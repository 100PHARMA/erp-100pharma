'use server';

import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function atualizarDataVencimento(faturaId: string, novaData: string) {
  try {
    const { data, error } = await supabase
      .from('faturas')
      .update({ data_vencimento: novaData })
      .eq('id', faturaId)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar data de vencimento:', error);
      return { 
        success: false, 
        error: error.message || 'Erro ao atualizar data de vencimento' 
      };
    }

    // Revalidar as páginas que usam faturas
    revalidatePath('/faturas');
    revalidatePath(`/faturas/${faturaId}`);
    revalidatePath('/contas-a-receber');

    return { 
      success: true, 
      data 
    };
  } catch (err: any) {
    console.error('Erro inesperado ao atualizar data de vencimento:', err);
    return { 
      success: false, 
      error: err?.message || 'Erro inesperado ao atualizar data de vencimento' 
    };
  }
}
