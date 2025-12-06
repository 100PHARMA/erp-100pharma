// lib/relatorio-vendedor-pdf.ts

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ======================================================================
// TIPOS
// ======================================================================

interface DadosVendedor {
  nome: string;
  email: string;
  telefone: string;
  ativo: boolean;
}

interface IntervaloRelatorio {
  dataInicio: string; // 'YYYY-MM-DD'
  dataFim: string;    // 'YYYY-MM-DD'
}

interface ResumoPeriodo {
  vendasMes: number;         // faturação no período
  frascosMes: number;        // frascos vendidos
  comissaoMes: number;       // comissão no período
  percentualMeta: number;    // %
  clientesAtivos: number;
  kmRodadosMes: number;
  custoKmMes: number;
}

interface VendaRelatorio {
  id: string;
  data: string;          // 'YYYY-MM-DD'
  cliente_nome: string;
  frascos: number;
  total_com_iva: number;
}

interface QuilometragemRelatorio {
  id: string;
  data: string;          // 'YYYY-MM-DD'
  km: number;
  valor: number;
}

interface VisitaRelatorio {
  id: string;
  data_visita: string;   // 'YYYY-MM-DD'
  estado: string;
  notas: string;
  cliente_nome: string;
}

interface DadosRelatorioVendedor {
  vendedor: DadosVendedor;
  intervalo: IntervaloRelatorio;
  resumo: ResumoPeriodo;
  vendas: VendaRelatorio[];
  quilometragens: QuilometragemRelatorio[];
  visitas: VisitaRelatorio[];
}

// ======================================================================
// FUNÇÕES AUXILIARES
// ======================================================================

function formatDate(iso: string): string {
  if (!iso) return '-';
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

function formatCurrency(value: number | undefined | null): string {
  const numero = typeof value === 'number' ? value : 0;
  return `${numero.toLocaleString('pt-PT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

function formatKm(value: number | undefined | null): string {
  const numero = typeof value === 'number' ? value : 0;
  return `${numero.toLocaleString('pt-PT', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} km`;
}

function formatPercent(value: number | undefined | null): string {
  const numero = typeof value === 'number' ? value : 0;
  return `${numero.toLocaleString('pt-PT', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} %`;
}

// ======================================================================
// GERADOR DE PDF
// ======================================================================

export async function gerarRelatorioVendedorPdf(
  dados: DadosRelatorioVendedor
): Promise<void> {
  const { vendedor, intervalo, resumo, vendas, quilometragens, visitas } = dados;

  const doc = new jsPDF('p', 'pt', 'a4');
  const marginLeft = 40;
  let cursorY = 40;

  // --------------------------------------------------
  // TÍTULO
  // --------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Relatório Mensal do Vendedor', marginLeft, cursorY);

  cursorY += 24;

  // --------------------------------------------------
  // INFORMAÇÕES DO PERÍODO E VENDEDOR
  // --------------------------------------------------
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');

  doc.text(
    `Período: ${formatDate(intervalo.dataInicio)} a ${formatDate(
      intervalo.dataFim
    )}`,
    marginLeft,
    cursorY
  );
  cursorY += 16;

  doc.text(`Vendedor: ${vendedor.nome}`, marginLeft, cursorY);
  cursorY += 14;

  doc.text(`Email: ${vendedor.email || '-'}`, marginLeft, cursorY);
  cursorY += 14;

  doc.text(`Telefone: ${vendedor.telefone || '-'}`, marginLeft, cursorY);
  cursorY += 24;

  // --------------------------------------------------
  // RESUMO DO PERÍODO
  // --------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Resumo do Período', marginLeft, cursorY);
  cursorY += 12;

  autoTable(doc, {
    startY: cursorY + 4,
    head: [['Indicador', 'Valor']],
    body: [
      ['Faturação no período', formatCurrency(resumo.vendasMes)],
      ['Comissão no período', formatCurrency(resumo.comissaoMes)],
      ['Frascos vendidos', `${resumo.frascosMes ?? 0}`],
      ['Clientes ativos', `${resumo.clientesAtivos ?? 0}`],
      ['Km rodados', formatKm(resumo.kmRodadosMes)],
      ['Custo de km', formatCurrency(resumo.custoKmMes)],
      ['Percentual da meta', formatPercent(resumo.percentualMeta)],
    ],
    styles: {
      font: 'helvetica',
      fontSize: 10,
      cellPadding: 6,
    },
    headStyles: {
      fillColor: [30, 90, 140],
      textColor: 255,
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    margin: { left: marginLeft, right: marginLeft },
  });

  cursorY = (doc as any).lastAutoTable.finalY + 30;

  // --------------------------------------------------
  // VENDAS NO PERÍODO
  // --------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Vendas no período', marginLeft, cursorY);
  cursorY += 12;

  if (!vendas || vendas.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(
      'Nenhuma venda registrada neste período.',
      marginLeft,
      cursorY + 10
    );
    cursorY += 30;
  } else {
    const corpoVendas = vendas.map((v) => [
      formatDate(v.data),
      v.cliente_nome || '-',
      `${v.frascos ?? 0}`,
      formatCurrency(v.total_com_iva),
    ]);

    autoTable(doc, {
      startY: cursorY + 4,
      head: [['Data', 'Cliente', 'Frascos', 'Total (com IVA)']],
      body: corpoVendas,
      styles: {
        font: 'helvetica',
        fontSize: 10,
        cellPadding: 6,
      },
      headStyles: {
        fillColor: [30, 90, 140],
        textColor: 255,
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      margin: { left: marginLeft, right: marginLeft },
    });

    cursorY = (doc as any).lastAutoTable.finalY + 30;
  }

  // --------------------------------------------------
  // QUILOMETRAGEM NO PERÍODO
  // --------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Quilometragem no período', marginLeft, cursorY);
  cursorY += 12;

  if (!quilometragens || quilometragens.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(
      'Nenhum registo de quilometragem neste período.',
      marginLeft,
      cursorY + 10
    );
    cursorY += 30;
  } else {
    const corpoKm = quilometragens.map((km) => [
      formatDate(km.data),
      `${km.km ?? 0}`,
      formatCurrency(km.valor),
    ]);

    autoTable(doc, {
      startY: cursorY + 4,
      head: [['Data', 'Km', 'Valor']],
      body: corpoKm,
      styles: {
        font: 'helvetica',
        fontSize: 10,
        cellPadding: 6,
      },
      headStyles: {
        fillColor: [30, 90, 140],
        textColor: 255,
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      margin: { left: marginLeft, right: marginLeft },
    });

    cursorY = (doc as any).lastAutoTable.finalY + 30;
  }

  // --------------------------------------------------
  // VISITAS NO PERÍODO
  // --------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Visitas no período', marginLeft, cursorY);
  cursorY += 12;

  if (!visitas || visitas.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(
      'Nenhuma visita registrada neste período.',
      marginLeft,
      cursorY + 10
    );
  } else {
    const corpoVisitas = visitas.map((visita) => [
      formatDate(visita.data_visita),
      visita.cliente_nome || '-',
      visita.estado || '-',
      visita.notas || '',
    ]);

    autoTable(doc, {
      startY: cursorY + 4,
      head: [['Data', 'Cliente', 'Estado', 'Notas']],
      body: corpoVisitas,
      styles: {
        font: 'helvetica',
        fontSize: 10,
        cellPadding: 6,
      },
      headStyles: {
        fillColor: [30, 90, 140],
        textColor: 255,
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      margin: { left: marginLeft, right: marginLeft },
    });
  }

  // --------------------------------------------------
  // DOWNLOAD
  // --------------------------------------------------
  const nomeFicheiro = `relatorio-vendedor-${vendedor.nome
    .toLowerCase()
    .replace(/\s+/g, '-')}-${intervalo.dataInicio}-${intervalo.dataFim}.pdf`;

  doc.save(nomeFicheiro);
}
