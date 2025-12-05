'use server';

import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function marcarFaturaPaga(
  faturaId: string,
  dataPagamento: string,
  valorPago: number
) {
  try {
    const { data, error } = await supabase.rpc('marcar_fatura_paga', {
      p_fatura_id: faturaId,
      p_data_pagamento: dataPagamento,
      p_valor_pago: valorPago,
    });

    if (error) {
      console.error('Erro ao marcar fatura como paga:', error);
      return {
        success: false,
        error: error.message || 'Erro ao processar pagamento',
      };
    }

    // Revalidar a página de faturas para atualizar a lista
    revalidatePath('/faturas');
    revalidatePath(`/faturas/${faturaId}`);
    revalidatePath('/contas-a-receber');

    return {
      success: true,
      data,
    };
  } catch (err) {
    console.error('Erro inesperado ao marcar fatura como paga:', err);
    return {
      success: false,
      error: 'Erro inesperado ao processar pagamento',
    };
  }
}

export async function registrarPagamentoFatura(
  faturaId: string,
  valorPago: number,
  dataPagamento: string,
  metodoPagamento: string | null,
  observacoes: string | null
) {
  try {
    const { data, error } = await supabase.rpc('registrar_pagamento_fatura', {
      p_fatura_id: faturaId,
      p_valor_pago: valorPago,
      p_data_pagamento: dataPagamento,
      p_metodo_pagamento: metodoPagamento,
      p_observacoes: observacoes,
    });

    if (error) {
      console.error('Erro ao registrar pagamento:', error);
      return {
        success: false,
        error: error.message || 'Erro ao processar pagamento',
      };
    }

    // Revalidar páginas relevantes
    revalidatePath('/faturas');
    revalidatePath(`/faturas/${faturaId}`);
    revalidatePath('/contas-a-receber');
    revalidatePath('/financeiro');

    return {
      success: true,
      data,
    };
  } catch (err) {
    console.error('Erro inesperado ao registrar pagamento:', err);
    return {
      success: false,
      error: 'Erro inesperado ao processar pagamento',
    };
  }
}
