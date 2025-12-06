// lib/relatorio-vendedor-pdf.ts

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// -----------------------------------------------------------------------------
// TIPOS SIMPLES (flexíveis) PARA O RELATÓRIO
// -----------------------------------------------------------------------------

interface IntervaloDatas {
  dataInicio: string;
  dataFim: string;
}

interface RelatorioVendedorParams {
  vendedor: any;
  intervalo: IntervaloDatas;
  resumo: any;
  vendas: any[];
  quilometragens: any[];
  visitas: any[];
}

// -----------------------------------------------------------------------------
// HELPERS SEGUROS (EVITAM UNDEFINED.toLocaleString)
// -----------------------------------------------------------------------------

function formatCurrency(value: number | null | undefined): string {
  const numero = Number(value || 0);
  return numero.toLocaleString('pt-PT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' €';
}

function formatNumber(value: number | null | undefined): string {
  const numero = Number(value || 0);
  return numero.toLocaleString('pt-PT');
}

function formatKm(value: number | null | undefined): string {
  const numero = Number(value || 0);
  return numero.toLocaleString('pt-PT', {
    maximumFractionDigits: 2,
  }) + ' km';
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-PT');
}

// -----------------------------------------------------------------------------
// FUNÇÃO PRINCIPAL
// -----------------------------------------------------------------------------

export async function gerarRelatorioVendedorPdf({
  vendedor,
  intervalo,
  resumo,
  vendas,
  quilometragens,
  visitas,
}: RelatorioVendedorParams): Promise<void> {
  try {
    const doc = new jsPDF();

    // -------------------------------------------------------------------------
    // CABEÇALHO
    // -------------------------------------------------------------------------
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Relatório Mensal do Vendedor', 14, 18);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Período: ${formatDate(intervalo.dataInicio)} a ${formatDate(intervalo.dataFim)}`,
      14,
      26
    );

    doc.text(`Vendedor: ${vendedor?.nome || '-'}`, 14, 32);
    doc.text(`Email: ${vendedor?.email || '-'}`, 14, 38);
    if (vendedor?.telefone) {
      doc.text(`Telefone: ${vendedor.telefone}`, 14, 44);
    }

    let posY = vendedor?.telefone ? 52 : 48;

    // -------------------------------------------------------------------------
    // RESUMO GERAL
    // -------------------------------------------------------------------------
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Resumo do Período', 14, posY);
    posY += 6;

    autoTable(doc, {
      startY: posY,
      styles: { fontSize: 10 },
      head: [['Indicador', 'Valor']],
      body: [
        ['Faturação no período', formatCurrency(resumo?.vendasMes)],
        ['Comissão no período', formatCurrency(resumo?.comissaoMes)],
        ['Frascos vendidos', formatNumber(resumo?.frascosMes)],
        ['Clientes ativos', formatNumber(resumo?.clientesAtivos)],
        ['Km rodados', formatKm(resumo?.kmRodadosMes)],
        ['Custo de km', formatCurrency(resumo?.custoKmMes)],
        [
          'Percentual da meta',
          `${Number(resumo?.percentualMeta || 0).toFixed(0)} %`,
        ],
      ],
    });

    // Posição após a tabela de resumo
    // @ts-ignore: autoTable adiciona lastAutoTable em runtime
    posY = doc.lastAutoTable.finalY + 10;

    // -------------------------------------------------------------------------
    // VENDAS
    // -------------------------------------------------------------------------
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Vendas no período', 14, posY);
    posY += 6;

    if (!vendas || vendas.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('Nenhuma venda registrada neste período.', 14, posY);
      posY += 10;
    } else {
      autoTable(doc, {
        startY: posY,
        styles: { fontSize: 9 },
        head: [['Data', 'Cliente', 'Frascos', 'Total (com IVA)']],
        body: vendas.map((venda: any) => {
          const data = formatDate(venda.data);
          const clienteNome =
            venda.cliente?.nome ||
            venda.cliente_nome ||
            venda.cliente ||
            '-';
          const frascos = formatNumber(venda.frascos || venda.total_frascos);
          const total = formatCurrency(
            venda.total_com_iva ?? venda.total ?? venda.valor_total
          );
          return [data, clienteNome, frascos, total];
        }),
      });
      // @ts-ignore
      posY = doc.lastAutoTable.finalY + 10;
    }

    // -------------------------------------------------------------------------
    // QUILOMETRAGEM
    // -------------------------------------------------------------------------
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Quilometragem no período', 14, posY);
    posY += 6;

    if (!quilometragens || quilometragens.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('Nenhum registo de quilometragem neste período.', 14, posY);
      posY += 10;
    } else {
      autoTable(doc, {
        startY: posY,
        styles: { fontSize: 9 },
        head: [['Data', 'Km', 'Valor (€)']],
        body: quilometragens.map((km: any) => [
          formatDate(km.data),
          formatKm(km.km),
          formatCurrency(km.valor),
        ]),
      });
      // @ts-ignore
      posY = doc.lastAutoTable.finalY + 10;
    }

    // -------------------------------------------------------------------------
    // VISITAS
    // -------------------------------------------------------------------------
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Visitas no período', 14, posY);
    posY += 6;

    if (!visitas || visitas.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('Nenhuma visita registrada neste período.', 14, posY);
      posY += 10;
    } else {
      autoTable(doc, {
        startY: posY,
        styles: { fontSize: 9 },
        head: [['Data', 'Cliente', 'Estado', 'Notas']],
        body: visitas.map((visita: any) => {
          const clienteNome =
            visita.cliente?.nome ||
            visita.cliente_nome ||
            visita.cliente ||
            '-';
          return [
            formatDate(visita.data_visita),
            clienteNome,
            visita.estado || '-',
            visita.notas || '',
          ];
        }),
        bodyStyles: {
          cellWidth: 'wrap',
        },
        columnStyles: {
          3: { cellWidth: 80 }, // coluna de notas
        },
      });
    }

    // -------------------------------------------------------------------------
    // FOOTER E DOWNLOAD
    // -------------------------------------------------------------------------
    const dataAgora = new Date();
    const nomeArquivo = `Relatorio_${(vendedor?.nome || 'vendedor')
      .replace(/\s+/g, '_')
      .replace(/[^\w_]/g, '')}_${dataAgora
      .toISOString()
      .slice(0, 10)}.pdf`;

    doc.save(nomeArquivo);
  } catch (error) {
    console.error('Erro dentro de gerarRelatorioVendedorPdf:', error);
    throw error;
  }
}
