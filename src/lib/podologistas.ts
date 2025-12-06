import { supabase } from './supabase';

export interface Podologista {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  nif: string | null;
  morada: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface PodologistaComEstatisticas extends Podologista {
  totalFrascos: number;
  totalIncentivos: number;
  totalFarmacias: number;
}

export interface EstatisticasPodologistas {
  totalPodologistas: number;
  totalFrascos: number;
  totalIncentivos: number;
  mediaPorFrasco: number;
}

/**
 * Busca todos os podologistas com estatísticas da view vw_incentivos_podologistas
 */
export async function buscarPodologistasComEstatisticas(
  apenasAtivos: boolean = true
): Promise<PodologistaComEstatisticas[]> {
  try {
    // Buscar podologistas
    let query = supabase
      .from('podologistas')
      .select('*')
      .order('nome', { ascending: true });

    if (apenasAtivos) {
      query = query.eq('status', 'Ativo');
    }

    const { data: podologistas, error } = await query;

    if (error) {
      console.error('Erro ao buscar podologistas:', error);
      return [];
    }

    if (!podologistas || podologistas.length === 0) {
      return [];
    }

    // Buscar estatísticas da view
    const { data: estatisticas, error: errorStats } = await supabase
      .from('vw_incentivos_podologistas')
      .select('*');

    if (errorStats) {
      console.error('Erro ao buscar estatísticas:', errorStats);
    }

    // Fazer o LEFT JOIN manualmente
    const podologistasComStats: PodologistaComEstatisticas[] = podologistas.map((pod) => {
      const stats = estatisticas?.find((s) => s.podologista_id === pod.id);

      return {
        ...pod,
        totalFrascos: stats?.total_frascos || 0,
        totalIncentivos: Number(stats?.total_incentivos || 0),
        totalFarmacias: stats?.total_farmacias || 0,
      };
    });

    return podologistasComStats;
  } catch (err) {
    console.error('Erro ao buscar podologistas com estatísticas:', err);
    return [];
  }
}

/**
 * Calcula estatísticas gerais de todos os podologistas
 */
export async function calcularEstatisticasGerais(): Promise<EstatisticasPodologistas> {
  try {
    // Buscar todos os podologistas ativos e contar
    const { data: podologistasAtivos, error: errorCount } = await supabase
      .from('podologistas')
      .select('id')
      .eq('status', 'Ativo');

    if (errorCount) {
      console.error('Erro ao contar podologistas:', errorCount);
      throw new Error(`Erro ao contar podologistas: ${errorCount.message || 'Erro desconhecido'}`);
    }

    const totalPodologistas = podologistasAtivos?.length || 0;

    // Buscar somas da view
    const { data: estatisticas, error: errorStats } = await supabase
      .from('vw_incentivos_podologistas')
      .select('total_frascos, total_incentivos');

    if (errorStats) {
      console.error('Erro ao buscar estatísticas:', errorStats);
      throw new Error(`Erro ao buscar estatísticas: ${errorStats.message || 'Erro desconhecido'}`);
    }

    // Calcular totais
    const totalFrascos = estatisticas?.reduce((sum, s) => sum + (Number(s.total_frascos) || 0), 0) || 0;
    const totalIncentivos = estatisticas?.reduce((sum, s) => sum + (Number(s.total_incentivos) || 0), 0) || 0;

    // Calcular média por frasco
    const mediaPorFrasco = totalFrascos > 0 ? totalIncentivos / totalFrascos : 0;

    return {
      totalPodologistas,
      totalFrascos,
      totalIncentivos,
      mediaPorFrasco,
    };
  } catch (err) {
    console.error('Erro ao calcular estatísticas gerais:', err);
    
    // Retornar valores padrão em caso de erro
    return {
      totalPodologistas: 0,
      totalFrascos: 0,
      totalIncentivos: 0,
      mediaPorFrasco: 0,
    };
  }
}

/**
 * Cria um novo podologista
 */
export async function criarPodologista(dados: {
  nome: string;
  telefone?: string;
  email?: string;
  nif?: string;
  morada?: string;
  status?: string;
}): Promise<{ success: boolean; data?: Podologista; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('podologistas')
      .insert([
        {
          nome: dados.nome,
          telefone: dados.telefone || null,
          email: dados.email || null,
          nif: dados.nif || null,
          morada: dados.morada || null,
          status: dados.status || 'Ativo',
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar podologista:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    console.error('Erro ao criar podologista:', err);
    return { success: false, error: 'Erro desconhecido ao criar podologista' };
  }
}

/**
 * Atualiza um podologista existente
 */
export async function atualizarPodologista(
  id: string,
  dados: Partial<Omit<Podologista, 'id' | 'created_at' | 'updated_at'>>
): Promise<{ success: boolean; data?: Podologista; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('podologistas')
      .update(dados)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar podologista:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    console.error('Erro ao atualizar podologista:', err);
    return { success: false, error: 'Erro desconhecido ao atualizar podologista' };
  }
}

/**
 * Ativa um podologista
 */
export async function ativarPodologista(id: string): Promise<{ success: boolean; error?: string }> {
  return atualizarPodologista(id, { status: 'Ativo' });
}

/**
 * Desativa um podologista
 */
export async function desativarPodologista(id: string): Promise<{ success: boolean; error?: string }> {
  return atualizarPodologista(id, { status: 'Inativo' });
}

/**
 * Busca um podologista por ID
 */
export async function buscarPodologistaPorId(id: string): Promise<Podologista | null> {
  try {
    const { data, error } = await supabase
      .from('podologistas')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Erro ao buscar podologista:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Erro ao buscar podologista:', err);
    return null;
  }
}
