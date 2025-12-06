import { supabase } from "@/lib/supabase";
import Link from "next/link";

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
    "relatorio_podologista",
    {
      p_podologista_id: podologistaId,
      p_data_inicio: dataInicio,
      p_data_fim: dataFim,
    }
  );

  if (error) {
    console.error("Erro ao carregar relatório do podologista:", error);
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
    rows[0]?.podologista_nome ?? "Relatório do Podologista";

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{podologistaNome}</h1>
          <p className="text-sm text-gray-500">
            Relatório de incentivos por farmácia
          </p>
        </div>

        <Link
          href="/podologistas"
          className="text-sm px-3 py-2 rounded border border-gray-300 hover:bg-gray-50"
        >
          Voltar aos Podologistas
        </Link>
      </div>

      {/* Filtros */}
      <form
        className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end"
        method="get"
      >
        <div className="flex flex-col space-y-1">
          <label htmlFor="data_inicio" className="text-sm font-medium">
            Data inicial
          </label>
          <input
            id="data_inicio"
            name="data_inicio"
            type="date"
            defaultValue={searchParams.data_inicio ?? ""}
            className="border rounded px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col space-y-1">
          <label htmlFor="data_fim" className="text-sm font-medium">
            Data final
          </label>
          <input
            id="data_fim"
            name="data_fim"
            type="date"
            defaultValue={searchParams.data_fim ?? ""}
            className="border rounded px-3 py-2 text-sm"
          />
        </div>

        <div className="hidden sm:block" />

        <div className="flex space-x-2 justify-end">
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Aplicar filtros
          </button>

          {/* Reservado para exportações futuras */}
          <button
            type="button"
            className="px-3 py-2 text-xs font-medium rounded border border-gray-300 hover:bg-gray-50"
            disabled
          >
            Exportar PDF
          </button>
          <button
            type="button"
            className="px-3 py-2 text-xs font-medium rounded border border-gray-300 hover:bg-gray-50"
            disabled
          >
            Exportar Excel
          </button>
        </div>
      </form>

      {/* Cards resumo */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="border rounded-lg p-4 bg-white shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">
            Total de farmácias
          </p>
          <p className="mt-2 text-2xl font-semibold">{totalFarmacias}</p>
        </div>

        <div className="border rounded-lg p-4 bg-white shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">
            Total de frascos válidos
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {totalFrascosValidos}
          </p>
        </div>

        <div className="border rounded-lg p-4 bg-white shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">
            Total de incentivos (€)
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {totalIncentivos.toFixed(2).replace(".", ",")} €
          </p>
        </div>
      </section>

      {/* Tabela detalhada por farmácia */}
      <section className="border rounded-lg bg-white shadow-sm overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-600">
                Farmácia
              </th>
              <th className="px-4 py-2 text-right font-medium text-gray-600">
                Frascos válidos
              </th>
              <th className="px-4 py-2 text-right font-medium text-gray-600">
                Incentivo (€)
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-6 text-center text-gray-500"
                >
                  Nenhum frasco válido encontrado para os filtros
                  selecionados.
                </td>
              </tr>
            )}

            {rows.map((row) => (
              <tr key={row.cliente_id} className="border-t">
                <td className="px-4 py-2">
                  <span className="font-medium">{row.cliente_nome}</span>
                </td>
                <td className="px-4 py-2 text-right">
                  {row.frascos_validos}
                </td>
                <td className="px-4 py-2 text-right">
                  {Number(row.incentivo_total)
                    .toFixed(2)
                    .replace(".", ",")}{" "}
                  €
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
