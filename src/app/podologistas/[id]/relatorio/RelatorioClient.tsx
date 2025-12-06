'use client';

import Link from 'next/link';
import { useCallback } from 'react';

type RelatorioRow = {
  podologista_id: string;
  podologista_nome: string;
  cliente_id: string;
  cliente_nome: string;
  frascos_validos: number;
  incentivo_total: string | number;
};

type RelatorioClientProps = {
  podologistaNome: string;
  rows: RelatorioRow[];
  totalFarmacias: number;
  totalFrascosValidos: number;
  totalIncentivos: number;
  dataInicio: string | null;
  dataFim: string | null;
};

function formatDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  // data no formato YYYY-MM-DD
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

export default function RelatorioClient(props: RelatorioClientProps) {
  const {
    podologistaNome,
    rows,
    totalFarmacias,
    totalFrascosValidos,
    totalIncentivos,
    dataInicio,
    dataFim,
  } = props;

  const periodoLabel = (() => {
    const ini = formatDate(dataInicio);
    const fim = formatDate(dataFim);

    if (ini && fim) return `Período: ${ini} a ${fim}`;
    if (ini && !fim) return `Período: a partir de ${ini}`;
    if (!ini && fim) return `Período: até ${fim}`;
    return 'Período: todo o histórico válido';
  })();

  const handleExportPdf = useCallback(async () => {
    try {
      // import dinâmico para garantir que só corre no browser
      const pdfMakeModule: any = await import('pdfmake/build/pdfmake');
      const pdfFonts: any = await import('pdfmake/build/vfs_fonts');
      const pdfMake = pdfMakeModule.default || pdfMakeModule;

      pdfMake.vfs = pdfFonts.pdfMake.vfs;

      const body: any[] = [];
      // cabeçalho da tabela
      body.push([
        { text: 'Farmácia', style: 'tableHeader' },
        { text: 'Frascos válidos', style: 'tableHeader', alignment: 'right' },
        { text: 'Incentivo (€)', style: 'tableHeader', alignment: 'right' },
      ]);

      rows.forEach((row) => {
        body.push([
          { text: row.cliente_nome, alignment: 'left' },
          {
            text: String(row.frascos_validos),
            alignment: 'right',
          },
          {
            text: Number(row.incentivo_total)
              .toFixed(2)
              .replace('.', ','),
            alignment: 'right',
          },
        ]);
      });

      const docDefinition: any = {
        info: {
          title: `Relatório - ${podologistaNome}`,
          subject: 'Relatório de incentivos por farmácia',
        },
        content: [
          {
            text: 'Relatório de Incentivos por Farmácia',
            style: 'title',
          },
          {
            text: podologistaNome,
            style: 'podologistName',
            margin: [0, 2, 0, 0],
          },
          {
            text: periodoLabel,
            style: 'period',
            margin: [0, 8, 0, 16],
          },
          {
            columns: [
              {
                width: '*',
                stack: [
                  { text: 'Total de farmácias', style: 'cardLabel' },
                  { text: String(totalFarmacias), style: 'cardValue' },
                ],
              },
              {
                width: '*',
                stack: [
                  { text: 'Total de frascos válidos', style: 'cardLabel' },
                  { text: String(totalFrascosValidos), style: 'cardValue' },
                ],
              },
              {
                width: '*',
                stack: [
                  { text: 'Total de incentivos (€)', style: 'cardLabel' },
                  {
                    text: totalIncentivos.toFixed(2).replace('.', ',') + ' €',
                    style: 'cardValue',
                  },
                ],
              },
            ],
            columnGap: 10,
            margin: [0, 0, 0, 20],
          },
          {
            style: 'tableBlock',
            table: {
              headerRows: 1,
              widths: ['*', 'auto', 'auto'],
              body,
            },
            layout: 'lightHorizontalLines',
          },
          {
            text: `Gerado em ${new Date().toLocaleString('pt-PT')}`,
            style: 'footer',
            margin: [0, 16, 0, 0],
          },
        ],
        styles: {
          title: {
            fontSize: 16,
            bold: true,
          },
          podologistName: {
            fontSize: 12,
            bold: true,
            color: '#2563eb',
          },
          period: {
            fontSize: 10,
            color: '#4b5563',
          },
          cardLabel: {
            fontSize: 9,
            color: '#6b7280',
          },
          cardValue: {
            fontSize: 12,
            bold: true,
            color: '#111827',
            margin: [0, 4, 0, 0],
          },
          tableHeader: {
            bold: true,
            fontSize: 10,
            color: '#111827',
          },
          tableBlock: {
            fontSize: 9,
          },
          footer: {
            fontSize: 8,
            color: '#6b7280',
          },
        },
        defaultStyle: {
          fontSize: 9,
        },
        pageMargins: [40, 40, 40, 40],
      };

      const fileNameSafe = podologistaNome
        .replace(/\s+/g, '_')
        .replace(/[^\w_-]/g, '');

      pdfMake.createPdf(docDefinition).download(
        `relatorio_podologista_${fileNameSafe || 'podologista'}.pdf`
      );
    } catch (err) {
      console.error('Erro ao gerar PDF do podologista:', err);
      alert('Erro ao gerar o PDF. Verifique a consola do navegador.');
    }
  }, [
    podologistaNome,
    rows,
    totalFarmacias,
    totalFrascosValidos,
    totalIncentivos,
    periodoLabel,
  ]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{podologistaNome}</h1>
          <p className="text-sm text-gray-500">
            Relatório de incentivos por farmácia
          </p>
          <p className="text-xs text-gray-400 mt-1">{periodoLabel}</p>
        </div>

        <Link
          href="/podologistas"
          className="text-sm px-3 py-2 rounded border border-gray-300 hover:bg-gray-50"
        >
          Voltar aos Podologistas
        </Link>
      </div>

      {/* Filtros (GET, tratados no server) */}
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
            defaultValue={dataInicio ?? ''}
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
            defaultValue={dataFim ?? ''}
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

          <button
            type="button"
            onClick={handleExportPdf}
            className="px-3 py-2 text-xs font-medium rounded border border-gray-300 hover:bg-gray-50"
          >
            Exportar PDF
          </button>

          <button
            type="button"
            className="px-3 py-2 text-xs font-medium rounded border border-gray-300 text-gray-400 cursor-not-allowed"
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
            {totalIncentivos.toFixed(2).replace('.', ',')} €
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
                    .replace('.', ',')}{' '}
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
