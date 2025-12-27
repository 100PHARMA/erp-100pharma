import { supabase } from '@/lib/supabase';
import RelatorioClient from './RelatorioClient';

type RelatorioRow = {
  podologista_id: string;
  podologista_nome: string;
  cliente_id: string;
  cliente_nome: string;
  frascos_validos: number;
  incentivo_total: string | number;
};

type PageProps = {
  params: { id: string };
  searchParams: {
    data_inicio?: string;
    data_fim?: string;
  };
};

export default async function PodologistaRelatorioPage({
  params,
  searchParams,
}: PageProps) {
  const podologistaId = params.id;

  const dataInicio = searchParams.data_inicio || null;
  const dataFim = searchParams.data_fim || null;

  const { data, error } = await supabase.rpc<RelatorioRow>(
    'relatorio_podologista',
    {
      p_podologista_id: podologistaId,
      p_data_inicio: dataInicio,
      p_data_fim: dataFim,
    }
  );

  if (error) {
    console.error('Erro ao carregar relatório do podologista:', error);
  }

  const rows: RelatorioRow[] = data ?? [];

  const totalFarmacias = rows.length;

  const totalFrascosValidos = rows.reduce(
    (acc, row) => acc + Number(row.frascos_validos ?? 0),
    0
  );

  const totalIncentivos = rows.reduce(
    (acc, row) => acc + Number(row.incentivo_total ?? 0),
    0
  );

  const podologistaNome =
    rows[0]?.podologista_nome ?? 'Relatório do Podologista';

  return (
    <RelatorioClient
      podologistaNome={podologistaNome}
      rows={rows}
      totalFarmacias={totalFarmacias}
      totalFrascosValidos={totalFrascosValidos}
      totalIncentivos={totalIncentivos}
      dataInicio={dataInicio}
      dataFim={dataFim}
    />
  );
}

