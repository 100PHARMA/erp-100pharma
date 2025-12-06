// src/lib/relatorio-podologista-pdf.ts

// Estes imports são o padrão do pdfmake em apps React/Next
// Se o TypeScript reclamar, os @ts-ignore garantem que compila.
 
// @ts-ignore
import pdfMake from 'pdfmake/build/pdfmake';
// @ts-ignore
import pdfFonts from 'pdfmake/build/vfs_fonts';

(pdfMake as any).vfs = (pdfFonts as any).pdfMake.vfs;

export type RelatorioRow = {
  podologista_id: string;
  podologista_nome: string;
  cliente_id: string;
  cliente_nome: string;
  frascos_validos: number;
  incentivo_total: string | number;
};

function formatDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

export function gerarRelatorioPodologistaPdf(args: {
  podologistaNome: string;
  rows: RelatorioRow[];
  totalFarmacias: number;
  totalFrascosValidos: number;
  totalIncentivos: number;
  dataInicio: string | null;
  dataFim: string | null;
}) {
  const {
    podologistaNome,
    rows,
    totalFarmacias,
    totalFrascosValidos,
    totalIncentivos,
    dataInicio,
    dataFim,
  } = args;

  const ini = formatDate(dataInicio);
  const fim = formatDate(dataFim);

  const periodoLabel =
    ini && fim
      ? `Período: ${ini} a ${fim}`
      : ini && !fim
      ? `Período: a partir de ${ini}`
      : !ini && fim
      ? `Período: até ${fim}`
      : 'Período: todo o histórico válido';

  const body: any[] = [];

  // Cabeçalho da tabela
  body.push([
    { text: 'Farmácia', style: 'tableHeader' },
    { text: 'Frascos válidos', style: 'tableHeader', alignment: 'right' },
    { text: 'Incentivo (€)', style: 'tableHeader', alignment: 'right' },
  ]);

  rows.forEach((row) => {
    body.push([
      { text: row.cliente_nome, alignment: 'left' },
      { text: String(row.frascos_validos), alignment: 'right' },
      {
        text: Number(row.incentivo_total).toFixed(2).replace('.', ','),
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

  (pdfMake as any)
    .createPdf(docDefinition)
    .download(
      `relatorio_podologista_${fileNameSafe || 'podologista'}.pdf`
    );
}
