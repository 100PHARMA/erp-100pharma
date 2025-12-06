import { supabase } from './supabase';

export interface Podologista {
  id: string;
  nome: string;
  ativo: boolean;
}

/**
 * Busca todos os podologistas ativos do Supabase
 */
export async function buscarPodologistasAtivos(): Promise<Podologista[]> {
  try {
    const { data, error } = await supabase
      .from('podologistas')
      .select('id, nome, ativo')
      .eq('ativo', true)
      .order('nome', { ascending: true });

    if (error) {
      console.error('Erro ao buscar podologistas:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Erro ao buscar podologistas:', error);
    return [];
  }
}

/**
 * Busca o nome de um podologista pelo ID
 */
export async function buscarNomePodologista(podologistaId: string | null): Promise<string | null> {
  if (!podologistaId) return null;

  try {
    const { data, error } = await supabase
      .from('podologistas')
      .select('nome')
      .eq('id', podologistaId)
      .single();

    if (error) {
      console.error('Erro ao buscar nome do podologista:', error);
      return null;
    }

    return data?.nome || null;
  } catch (error) {
    console.error('Erro ao buscar nome do podologista:', error);
    return null;
  }
}
