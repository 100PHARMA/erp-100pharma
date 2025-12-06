// src/lib/ranking-farmacias-pdf.ts

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export type RankingFarmaciaRow = {
  farmacia_id: string;
  farmacia_nome: string;
  frascos_validos: number;
  fundo_acumulado: number; // em €
};

type GerarPdfArgs = {
  rows: RankingFarmaciaRow[];
  totalFarmacias: number;
  totalFrascosValidos: number;
  fundoTotal: number;
  tituloCampanha?: string; // opcional, ex: "Campanha 100FUNGO - Primavera 2024"
};

export function gerarRankingFarmaciasPdf({
  rows,
  totalFarmacias,
  totalFrascosValidos,
  fundoTotal,
  tituloCampanha,
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
    doc.text('Ranking de Farmácias', margin, y);

    if (tituloCampanha) {
      y += 6;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(tituloCampanha, margin, y);
    }

    // Linha separadora
    y += 8;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // ============================================================
    // RESUMO GERAL (cards)
    // ============================================================
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Resumo Geral', margin, y);
    y += 7;

    const resumoData = [
      ['Total de farmácias no ranking', String(totalFarmacias)],
      ['Total de frascos válidos', String(totalFrascosValidos)],
      ['Fundo farmacêutico total (€)', formatCurrency(fundoTotal) + ' €'],
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
        0: { fontStyle: 'bold', cellWidth: 90 },
        1: { halign: 'right', cellWidth: 70 },
      },
      margin: { left: margin, right: margin },
    });

    // @ts-expect-error exposto pelo plugin
    y = (doc as any).lastAutoTable.finalY + 12;

    // ============================================================
    // TABELA DO RANKING
    // ============================================================

    if (y > pageHeight - 60) {
      doc.addPage();
      y = margin;
    }

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Classificação', margin, y);
    y += 7;

    if (rows.length === 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(120, 120, 120);
      doc.text('Nenhuma farmácia encontrada no ranking.', margin, y);
      y += 10;
    } else {
      // garante que está ordenado
      const ordenado = [...rows].sort(
        (a, b) => b.frascos_validos - a.frascos_validos
      );

      const body = ordenado.map((row, index) => [
        String(index + 1),
        row.farmacia_nome,
        String(row.frascos_validos),
        formatCurrency(row.fundo_acumulado) + ' €',
      ]);

      autoTable(doc, {
        startY: y,
        head: [['Posição', 'Farmácia', 'Frascos válidos', 'Fundo acumulado (€)']],
        body,
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
          0: { halign: 'center', cellWidth: 18 },
          1: { cellWidth: 80 },
          2: { halign: 'center', cellWidth: 30 },
          3: { halign: 'right', cellWidth: 40 },
        },
        margin: { left: margin, right: margin },
      });

      // @ts-expect-error exposto pelo plugin
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // ============================================================
    // RODAPÉ (data + nº página)
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

      doc.text(`Relatório gerado em: ${dataGeracao}`, margin, pageHeight - 12);

      doc.text(
        `Página ${i} de ${totalPages}`,
        pageWidth - margin - 30,
        pageHeight - 12
      );
    }

    // ============================================================
    // DOWNLOAD
    // ============================================================

    const nomeArquivoBase = tituloCampanha
      ? 'ranking_farmacias_' + sanitizeFilename(tituloCampanha)
      : 'ranking_farmacias';

    doc.save(`${nomeArquivoBase}.pdf`);
  } catch (error) {
    console.error('Erro ao gerar PDF do ranking de farmácias:', error);
    alert('Erro ao gerar o PDF do ranking de farmácias.');
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

function sanitizeFilename(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '_')
    .toLowerCase();
}
