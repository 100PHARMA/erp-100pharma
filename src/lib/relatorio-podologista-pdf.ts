// src/lib/relatorio-podologista-pdf.ts

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Mesmo formato de linha usado no relatório do podologista
export type RelatorioRow = {
  podologista_id: string;
  podologista_nome: string;
  cliente_id: string;
  cliente_nome: string;
  frascos_validos: number;
  incentivo_total: string | number;
};

type GerarPdfArgs = {
  podologistaNome: string;
  rows: RelatorioRow[];
  totalFarmacias: number;
  totalFrascosValidos: number;
  totalIncentivos: number;
  dataInicio: string | null;
  dataFim: string | null;
};

/**
 * Gera e faz download do PDF de incentivos por podologista.
 * Esta função é chamada apenas no browser (a partir de um componente `use client`).
 */
export function gerarRelatorioPodologistaPdf({
  podologistaNome,
  rows,
  totalFarmacias,
  totalFrascosValidos,
  totalIncentivos,
  dataInicio,
  dataFim,
}: GerarPdfArgs) {
  try {
    const doc = new jsPDF();

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let y = margin;

    // ============================================================
    // CABEÇALHO
    // ============================================================
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(37, 99, 235); // azul
    doc.text('100PHARMA', margin, y);

    y += 8;
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Relatório de Incentivos do Podologista', margin, y);

    y += 7;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(podologistaNome, margin, y);

    // Período
    const iniFmt = formatDate(dataInicio);
    const fimFmt = formatDate(dataFim);

    let periodo = 'Período: todo o histórico';
    if (iniFmt && fimFmt) {
      periodo = `Período: ${iniFmt} a ${fimFmt}`;
    } else if (iniFmt) {
      periodo = `Período: a partir de ${iniFmt}`;
    } else if (fimFmt) {
      periodo = `Período: até ${fimFmt}`;
    }

    y += 6;
    doc.setFontSize(10);
    doc.text(periodo, margin, y);

    // Linha separadora
    y += 5;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // ============================================================
    // RESUMO GERAL (CARDS)
    // ============================================================
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.text('Resumo Geral', margin, y);
    y += 7;

    const resumoData = [
      ['Total de farmácias', String(totalFarmacias)],
      ['Total de frascos válidos', String(totalFrascosValidos)],
      ['Total de incentivos (€)', formatCurrency(totalIncentivos) + ' €'],
    ];

    autoTable(doc, {
      startY: y,
      head: [],
      body: resumoData,
      theme: 'grid',
      styles: {
        fontSize: 10,
        cellPadding: 4,
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 80 },
        1: { halign: 'right', cellWidth: 60 },
      },
      margin: { left: margin, right: margin },
    });

    // posição logo a seguir à tabela
    // @ts-expect-error lastAutoTable é exposto pelo plugin
    y = (doc as any).lastAutoTable.finalY + 12;

    // ============================================================
    // TABELA DETALHADA POR FARMÁCIA
    // ============================================================
    if (y > pageHeight - 60) {
      doc.addPage();
      y = margin;
    }

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Detalhe por Farmácia', margin, y);
    y += 7;

    if (rows.length === 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(120, 120, 120);
      doc.text(
        'Nenhum frasco válido encontrado para os filtros selecionados.',
        margin,
        y
      );
      y += 10;
    } else {
      const tabelaBody = rows.map((row) => [
        row.cliente_nome,
        String(row.frascos_validos),
        formatCurrency(Number(row.incentivo_total)) + ' €',
      ]);

      autoTable(doc, {
        startY: y,
        head: [['Farmácia', 'Frascos válidos', 'Incentivo (€)']],
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
          0: { cellWidth: 90 },
          1: { halign: 'center', cellWidth: 30 },
          2: { halign: 'right', cellWidth: 40 },
        },
        margin: { left: margin, right: margin },
      });

      // @ts-expect-error lastAutoTable é exposto pelo plugin
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // ============================================================
    // RODAPÉ
    // ============================================================
    const dataGeracao = new Date().toLocaleString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const totalPages = doc.getNumberOfPages();

    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(130, 130, 130);

      // data no rodapé
      doc.text(`Relatório gerado em: ${dataGeracao}`, margin, pageHeight - 12);

      // numeração de página
      doc.text(
        `Página ${i} de ${totalPages}`,
        pageWidth - margin - 30,
        pageHeight - 12
      );
    }

    // ============================================================
    // DOWNLOAD
    // ============================================================

    const nomeArquivo =
      'relatorio_podologista_' +
      sanitizeFilename(podologistaNome || 'podologista') +
      '.pdf';

    doc.save(nomeArquivo);
  } catch (error) {
    console.error('Erro ao gerar PDF do podologista:', error);
    alert('Erro ao gerar o PDF do podologista.');
  }
}

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

function formatCurrency(valor: number): string {
  return valor.toLocaleString('pt-PT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  // esperamos formato "YYYY-MM-DD" vindo dos searchParams
  const [ano, mes, dia] = dateStr.split('-');
  if (!ano || !mes || !dia) return dateStr;
  return `${dia}/${mes}/${ano}`;
}

function sanitizeFilename(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '_')
    .toLowerCase();
}
