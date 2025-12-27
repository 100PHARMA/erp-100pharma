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
    console.log('🚀 [SERVER ACTION] ========================================');
    console.log('🚀 [SERVER ACTION] INICIANDO FINALIZAÇÃO DA VENDA');
    console.log('🚀 [SERVER ACTION] ========================================');
    console.log('🚀 [SERVER ACTION] vendaId recebido:', vendaId);
    console.log('🚀 [SERVER ACTION] Tipo do vendaId:', typeof vendaId);
    console.log('🚀 [SERVER ACTION] Valor exato:', JSON.stringify(vendaId));
    console.log('🚀 [SERVER ACTION] Timestamp:', new Date().toISOString());

    // Verificar se o client Supabase está configurado
    if (!supabase) {
      console.error('❌ [SERVER ACTION] Client Supabase não está configurado!');
      return {
        success: false,
        error: 'Client Supabase não está configurado'
      };
    }

    console.log('✅ [SERVER ACTION] Client Supabase OK');

    // Verificar se a venda existe antes de tentar finalizar
    console.log('🔍 [SERVER ACTION] Verificando se a venda existe...');
    const { data: vendaExiste, error: vendaError } = await supabase
      .from('vendas')
      .select('id, numero, estado')
      .eq('id', vendaId)
      .single();

    if (vendaError) {
      console.error('❌ [SERVER ACTION] Erro ao buscar venda:', vendaError);
      return {
        success: false,
        error: `Erro ao buscar venda: ${vendaError.message}`
      };
    }

    if (!vendaExiste) {
      console.error('❌ [SERVER ACTION] Venda não encontrada');
      return {
        success: false,
        error: 'Venda não encontrada'
      };
    }

    console.log('✅ [SERVER ACTION] Venda encontrada:', {
      id: vendaExiste.id,
      numero: vendaExiste.numero,
      estado: vendaExiste.estado
    });

    // Chamar a função RPC do Supabase EXATAMENTE como especificado
    console.log('🔄 [SERVER ACTION] ========================================');
    console.log('🔄 [SERVER ACTION] CHAMANDO RPC');
    console.log('🔄 [SERVER ACTION] ========================================');
    console.log('🔄 [SERVER ACTION] Função: finalizar_venda_e_criar_fatura');
    console.log('🔄 [SERVER ACTION] Parâmetros:', { p_venda_id: vendaId });
    console.log('🔄 [SERVER ACTION] Comando SQL equivalente:');
    console.log(`🔄 [SERVER ACTION] SELECT finalizar_venda_e_criar_fatura('${vendaId}');`);
    
    // CHAMADA RPC EXATAMENTE COMO ESPECIFICADO
    const { data, error } = await supabase
      .rpc('finalizar_venda_e_criar_fatura', { p_venda_id: vendaId });

    console.log('📦 [SERVER ACTION] ========================================');
    console.log('📦 [SERVER ACTION] RESPOSTA DA RPC');
    console.log('📦 [SERVER ACTION] ========================================');
    console.log('📦 [SERVER ACTION] data:', data);
    console.log('📦 [SERVER ACTION] data (JSON):', JSON.stringify(data, null, 2));
    console.log('📦 [SERVER ACTION] error:', error);
    console.log('📦 [SERVER ACTION] error (JSON):', JSON.stringify(error, null, 2));

    if (error) {
      console.error('❌ [SERVER ACTION] ========================================');
      console.error('❌ [SERVER ACTION] ERRO AO CHAMAR RPC');
      console.error('❌ [SERVER ACTION] ========================================');
      console.error('❌ [SERVER ACTION] Erro completo:', error);
      console.error('❌ [SERVER ACTION] Detalhes:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return {
        success: false,
        error: `Erro RPC: ${error.message}${error.details ? ' - ' + error.details : ''}${error.hint ? ' (Dica: ' + error.hint + ')' : ''}`
      };
    }

    if (!data) {
      console.error('❌ [SERVER ACTION] ========================================');
      console.error('❌ [SERVER ACTION] RPC NÃO RETORNOU DADOS');
      console.error('❌ [SERVER ACTION] ========================================');
      console.error('❌ [SERVER ACTION] Possíveis causas:');
      console.error('❌ [SERVER ACTION] 1. A função não existe no Supabase');
      console.error('❌ [SERVER ACTION] 2. Você não tem permissão para executá-la');
      console.error('❌ [SERVER ACTION] 3. A função retornou NULL');
      return {
        success: false,
        error: 'Nenhuma fatura foi criada. A RPC não retornou dados. Verifique se a função existe no Supabase e se você tem permissão para executá-la.'
      };
    }

    console.log('✅ [SERVER ACTION] ========================================');
    console.log('✅ [SERVER ACTION] SUCESSO! FATURA CRIADA');
    console.log('✅ [SERVER ACTION] ========================================');
    console.log('✅ [SERVER ACTION] Dados da fatura:', data);
    console.log('✅ [SERVER ACTION] ID da fatura:', data.id);
    console.log('✅ [SERVER ACTION] Número da fatura:', data.numero);

    return {
      success: true,
      faturaId: data.id
    };

  } catch (error: any) {
    console.error('❌ [SERVER ACTION] ========================================');
    console.error('❌ [SERVER ACTION] ERRO INESPERADO');
    console.error('❌ [SERVER ACTION] ========================================');
    console.error('❌ [SERVER ACTION] Erro:', error);
    console.error('❌ [SERVER ACTION] Nome:', error.name);
    console.error('❌ [SERVER ACTION] Mensagem:', error.message);
    console.error('❌ [SERVER ACTION] Stack trace:', error.stack);
    return {
      success: false,
      error: `Erro inesperado: ${error.message}`
    };
  }
}
