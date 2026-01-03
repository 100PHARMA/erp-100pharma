import type { SupabaseClient } from '@supabase/supabase-js';

// ======================================================================
// TIPOS
// ======================================================================

export interface ConfiguracaoFinanceira {
  id: string;
  // Meta e Faixas de Comissão
  meta_mensal: number;
  faixa1_limite: number;
  comissao_faixa1: number;
  faixa2_limite: number;
  comissao_faixa2: number;
  comissao_faixa3: number;
  // Incentivos e Fundos
  incentivo_podologista: number;
  fundo_farmaceutico: number;
  // Parâmetros Financeiros
  custo_aquisicao_padrao: number;
  custo_variavel_padrao: number;
  valor_km: number;
  custo_fixo_mensal: number;
  capital_giro_ideal: number;
  // Comissões Avançadas
  comissao_farmacia_nova: number;
  comissao_farmacia_ativa: number;
  teto_mensal_farmacia_ativa: number;
  limite_farmacias_vendedor: number;
  // Timestamps
  created_at: string;
  updated_at: string;
}

// ======================================================================
// VALORES PADRÃO
// ======================================================================

const CONFIGURACAO_PADRAO: Omit<ConfiguracaoFinanceira, 'id' | 'created_at' | 'updated_at'> = {
  // Meta e Faixas
  meta_mensal: 7000,
  faixa1_limite: 3000,
  comissao_faixa1: 5,
  faixa2_limite: 7000,
  comissao_faixa2: 8,
  comissao_faixa3: 10,
  // Incentivos e Fundos
  incentivo_podologista: 1.0,
  fundo_farmaceutico: 0.28,
  // Parâmetros Financeiros
  custo_aquisicao_padrao: 0,
  custo_variavel_padrao: 0,
  valor_km: 0,
  custo_fixo_mensal: 0,
  capital_giro_ideal: 0,
  // Comissões Avançadas
  comissao_farmacia_nova: 0,
  comissao_farmacia_ativa: 0,
  teto_mensal_farmacia_ativa: 0,
  limite_farmacias_vendedor: 0,
};

// ======================================================================
// FUNÇÕES PRINCIPAIS
// ======================================================================

/**
 * Busca a configuração financeira mais recente do Supabase
 * Ordena por created_at desc e id desc, limit 1
 */
export async function buscarConfiguracaoFinanceira(supabase: SupabaseClient): Promise<ConfiguracaoFinanceira> {
  try {
    // Buscar o registro mais recente
    const { data, error } = await supabase
      .from('configuracoes_financeiras')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // Se não encontrou nenhum registro, retornar valores padrão
      if (error.code === 'PGRST116') {
        console.log('⚠️ Nenhuma configuração encontrada. Usando valores padrão.');
        return {
          id: '',
          ...CONFIGURACAO_PADRAO,
          created_at: '',
          updated_at: '',
        };
      }
      throw error;
    }

    return data;
  } catch (error: any) {
    console.error('Erro ao buscar configuração financeira:', error);
    // Em caso de erro, retornar valores padrão (fallback)
    return {
      id: '',
      ...CONFIGURACAO_PADRAO,
      created_at: '',
      updated_at: '',
    };
  }
}

/**
 * Cria uma nova configuração financeira no Supabase (INSERT)
 * NUNCA faz UPDATE - sempre cria novo registro para histórico
 */
export async function criarConfiguracaoFinanceira(
  supabase: SupabaseClient,
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
    return totalVendas * (config.comissao_faixa1 / 100);
  } else if (totalVendas <= config.faixa2_limite) {
    // Faixa 2: faixa 1 completa + excedente na faixa 2
    const comissaoFaixa1 = config.faixa1_limite * (config.comissao_faixa1 / 100);
    const excedenteFaixa2 = (totalVendas - config.faixa1_limite) * (config.comissao_faixa2 / 100);
    return comissaoFaixa1 + excedenteFaixa2;
  } else {
    // Faixa 3: faixa 1 + faixa 2 completas + excedente na faixa 3
    const comissaoFaixa1 = config.faixa1_limite * (config.comissao_faixa1 / 100);
    const comissaoFaixa2 =
      (config.faixa2_limite - config.faixa1_limite) * (config.comissao_faixa2 / 100);
    const excedenteFaixa3 = (totalVendas - config.faixa2_limite) * (config.comissao_faixa3 / 100);
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
  const percentual = (totalVendas / config.meta_mensal) * 100;
  return Math.min(Math.max(percentual, 0), 200); // Limitar entre 0% e 200%
}

/**
 * Calcula incentivo total para podologista
 */
export function calcularIncentivoPodologista(
  quantidadeFrascos: number,
  config: ConfiguracaoFinanceira
): number {
  return quantidadeFrascos * config.incentivo_podologista;
}

/**
 * Calcula fundo farmacêutico total
 */
export function calcularFundoFarmaceutico(
  quantidadeFrascos: number,
  config: ConfiguracaoFinanceira
): number {
  return quantidadeFrascos * config.fundo_farmaceutico;
}
