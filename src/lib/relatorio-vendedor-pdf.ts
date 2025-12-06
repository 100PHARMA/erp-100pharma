import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ======================================================================
// TIPOS
// ======================================================================

export interface VendedorRelatorioRow {
  cliente_nome: string;
  frascos: number;
  faturacao: number; // já com IVA
  comissao: number;
}

export interface VendedorRelatorioPayload {
  vendedorNome: string;
  rows: VendedorRelatorioRow[];
  totalFrascos: number;
  totalFaturacao: number; // já com IVA
  totalComissao: number;
  metaMensal?: number | null;
  percentMeta?: number | null; // 0–100 (ex: 85.3 = 85,3%)
  dataInicio: string | null;
  dataFim: string | null;
}

// ======================================================================
// FUNÇÃO PRINCIPAL
// ======================================================================

export function gerarRelatorioVendedorPdf(payload: VendedorRelatorioPayload) {
  const {
    vendedorNome,
    rows,
    totalFrascos,
    totalFaturacao,
    totalComissao,
    metaMensal,
    percentMeta,
    dataInicio,
    dataFim,
  } = payload;

  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  // -------------------- Cabeçalho --------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(37, 99, 235); // azul
  doc.text('100PHARMA', margin, y);

  y += 8;
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('Relatório de Comissões do Vendedor', margin, y);

  y += 8;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(vendedorNome, margin, y);

  y += 6;
  const periodoLabel = buildPeriodoLabel(dataInicio, dataFim);
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(periodoLabel, margin, y);

  y += 5;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // -------------------- Resumo Geral --------------------
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Resumo Geral', margin, y);
  y += 8;

  const resumoBody: (string | number)[][] = [
    ['Total de frascos', totalFrascos.toString()],
    ['Faturação total (IVA incluído)', formatarMoeda(totalFaturacao) + ' €'],
    ['Comissão total (€)', formatarMoeda(totalComissao) + ' €'],
  ];

  if (metaMensal != null) {
    resumoBody.push(['Meta mensal (€)', formatarMoeda(metaMensal) + ' €']);
  }

  if (percentMeta != null) {
    resumoBody.push([
      '% da meta atingida',
      `${percentMeta.toFixed(1).replace('.', ',')} %`,
    ]);
  }

  autoTable(doc, {
    startY: y,
    head: [],
    body: resumoBody,
    theme: 'grid',
    styles: {
      fontSize: 10,
      cellPadding: 4,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 90 },
      1: { halign: 'right', cellWidth: 80 },
    },
    margin: { left: margin, right: margin },
  });

  // @ts-ignore - propriedade injectada pelo autotable
  y = (doc as any).lastAutoTable.finalY + 12;

  // -------------------- Detalhe por Cliente --------------------
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Detalhe por Cliente / Farmácia', margin, y);
  y += 6;

  const tabelaHead = [['Cliente / Farmácia', 'Frascos', 'Faturação (€)', 'Comissão (€)']];

  const tabelaBody = rows.map((row) => [
    row.cliente_nome,
    row.frascos.toString(),
    formatarMoeda(row.faturacao) + ' €',
    formatarMoeda(row.comissao) + ' €',
  ]);

  autoTable(doc, {
    startY: y,
    head: tabelaHead,
    body: tabelaBody,
    theme: 'striped',
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: 255,
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'right', cellWidth: 35 },
      3: { halign: 'right', cellWidth: 35 },
    },
    margin: { left: margin, right: margin },
  });

  // -------------------- Rodapé --------------------
  const totalPages = doc.getNumberOfPages();
  const dataGeracao = new Date().toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150, 150, 150);

    doc.text(
      `Relatório gerado em: ${dataGeracao}`,
      margin,
      doc.internal.pageSize.getHeight() - 12
    );

    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth - margin - 25,
      doc.internal.pageSize.getHeight() - 12
    );
  }

  // Nome do ficheiro
  const fileSafeName = vendedorNome.replace(/\s+/g, '_');
  doc.save(`relatorio_vendedor_${fileSafeName}.pdf`);
}

// ======================================================================
// FUNÇÕES AUXILIARES
// ======================================================================

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-PT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function buildPeriodoLabel(
  dataInicio: string | null,
  dataFim: string | null
): string {
  const ini = formatDate(dataInicio);
  const fim = formatDate(dataFim);

  if (ini && fim) return `Período: ${ini} a ${fim}`;
  if (ini && !fim) return `Período: a partir de ${ini}`;
  if (!ini && fim) return `Período: até ${fim}`;
  return 'Período: todo o histórico válido';
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}
