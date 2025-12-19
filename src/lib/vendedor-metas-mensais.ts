import { supabase } from './supabase';

export type VendedorMetaMensalRow = {
  id?: string;
  vendedor_id: string;
  ano: number;
  mes: number;
  meta_mensal: number | null;

  // Atenção: no teu print está "faixa*_percent" (não "percentual")
  faixa1_limite: number | null;
  faixa1_percent: number | null;

  faixa2_limite: number | null;
  faixa2_percent: number | null;

  faixa3_limite: number | null;
  faixa3_percent: number | null;

  created_at?: string;
  updated_at?: string;
};

export type VendedorRow = {
  id: string;
  nome: string;
};

export async function listarVendedores(): Promise<VendedorRow[]> {
  const { data, error } = await supabase
    .from('vendedores')
    .select('id,nome')
    .order('nome', { ascending: true });

  if (error) throw error;
  return (data ?? []) as VendedorRow[];
}

export async function listarMetasMensaisDoMes(ano: number, mes: number): Promise<VendedorMetaMensalRow[]> {
  const { data, error } = await supabase
    .from('vendedor_metas_mensais')
    .select('*')
    .eq('ano', ano)
    .eq('mes', mes);

  if (error) throw error;
  return (data ?? []) as VendedorMetaMensalRow[];
}

export async function upsertMetaMensal(payload: VendedorMetaMensalRow): Promise<void> {
  const { error } = await supabase
    .from('vendedor_metas_mensais')
    .upsert(payload, { onConflict: 'vendedor_id,ano,mes' });

  if (error) throw error;
}
