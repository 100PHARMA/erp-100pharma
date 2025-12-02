import { supabase } from './supabase';

// ======================================================================
// TIPOS
// ======================================================================

export interface ConfiguracaoFinanceira {
  id: string;
  meta_mensal_vendedor: number;
  faixa1_limite: number;
  comissao_faixa1_percent: number;
  faixa2_limite: number;
  comissao_faixa2_percent: number;
  comissao_faixa3_percent: number;
  incentivo_podologista_por_frasco: number;
  fundo_farmaceutico_por_frasco: number;
  created_at: string;
  updated_at: string;
}

// ======================================================================
// VALORES PADRÃO
// ======================================================================

const CONFIGURACAO_PADRAO: Omit<ConfiguracaoFinanceira, 'id' | 'created_at' | 'updated_at'> = {
  meta_mensal_vendedor: 7000,
  faixa1_limite: 3000,
  comissao_faixa1_percent: 5,
  faixa2_limite: 7000,
  comissao_faixa2_percent: 8,
  comissao_faixa3_percent: 10,
  incentivo_podologista_por_frasco: 1.0,
  fundo_farmaceutico_por_frasco: 0.28,
};

// ======================================================================
// FUNÇÕES PRINCIPAIS
// ======================================================================

/**
 * Busca a configuração financeira mais recente do Supabase
 * Se não existir, cria uma com valores padrão
 */
export async function buscarConfiguracaoFinanceira(): Promise<ConfiguracaoFinanceira> {
  try {
    // Buscar o registro mais recente
    const { data, error } = await supabase
      .from('configuracoes_financeiras')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // Se não encontrou nenhum registro, criar um padrão
      if (error.code === 'PGRST116') {
        console.log('⚠️ Nenhuma configuração encontrada. Criando configuração padrão...');
        return await criarConfiguracaoPadrao();
      }
      throw error;
    }

    return data;
  } catch (error: any) {
    console.error('Erro ao buscar configuração financeira:', error);
    // Em caso de erro, retornar valores padrão (fallback)
    return {
      id: 'fallback',
      ...CONFIGURACAO_PADRAO,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
}

/**
 * Cria uma nova configuração financeira no Supabase
 */
export async function criarConfiguracaoFinanceira(
  config: Omit<ConfiguracaoFinanceira, 'id' | 'created_at' | 'updated_at'>
): Promise<ConfiguracaoFinanceira> {
  try {
    const { data, error } = await supabase
      .from('configuracoes_financeiras')
      .insert([config])
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Nova configuração financeira criada com sucesso!');
    return data;
  } catch (error: any) {
    console.error('Erro ao criar configuração financeira:', error);
    throw error;
  }
}

/**
 * Cria configuração padrão se não existir nenhuma
 */
async function criarConfiguracaoPadrao(): Promise<ConfiguracaoFinanceira> {
  return await criarConfiguracaoFinanceira(CONFIGURACAO_PADRAO);
}

// ======================================================================
// FUNÇÕES DE CÁLCULO (usando configuração dinâmica)
// ======================================================================

/**
 * Calcula comissão progressiva baseada nas faixas configuradas
 */
export function calcularComissaoProgressiva(
  totalVendas: number,
  config: ConfiguracaoFinanceira
): number {
  if (totalVendas <= config.faixa1_limite) {
    // Faixa 1: até o limite da faixa 1
    return totalVendas * (config.comissao_faixa1_percent / 100);
  } else if (totalVendas <= config.faixa2_limite) {
    // Faixa 2: faixa 1 completa + excedente na faixa 2
    const comissaoFaixa1 =
      config.faixa1_limite * (config.comissao_faixa1_percent / 100);

    const excedenteFaixa2 =
      (totalVendas - config.faixa1_limite) * (config.comissao_faixa2_percent / 100);

    return comissaoFaixa1 + excedenteFaixa2;
  } else {
    // Faixa 3: faixa 1 + faixa 2 completas + excedente na faixa 3
    const comissaoFaixa1 =
      config.faixa1_limite * (config.comissao_faixa1_percent / 100);

    const comissaoFaixa2 =
      (config.faixa2_limite - config.faixa1_limite) * (config.comissao_faixa2_percent / 100);

    const excedenteFaixa3 =
      (totalVendas - config.faixa2_limite) * (config.comissao_faixa3_percent / 100);

    return comissaoFaixa1 + comissaoFaixa2 + excedenteFaixa3;
  }
}

/**
 * Calcula percentual de meta baseado na meta configurada
 */
export function calcularPercentualMeta(
  totalVendas: number,
  config: ConfiguracaoFinanceira
): number {
  const percentual = (totalVendas / config.meta_mensal_vendedor) * 100;
  return Math.min(Math.max(percentual, 0), 200); // Limitar entre 0% e 200%
}

/**
 * Calcula incentivo total para podologista
 */
export function calcularIncentivoPodologista(
  quantidadeFrascos: number,
  config: ConfiguracaoFinanceira
): number {
  return quantidadeFrascos * config.incentivo_podologista_por_frasco;
}

/**
 * Calcula fundo farmacêutico total
 */
export function calcularFundoFarmaceutico(
  quantidadeFrascos: number,
  config: ConfiguracaoFinanceira
): number {
  return quantidadeFrascos * config.fundo_farmaceutico_por_frasco;
}
