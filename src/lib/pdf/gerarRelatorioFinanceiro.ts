import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface DadosFinanceirosMensais {
  ano: number;
  mesNumero: number; // 1-12
  mesNome: string;

  // Observação importante:
  // Estes valores devem vir já calculados corretamente pelo frontend/backend.
  // Este PDF NÃO recalcula nada, só renderiza.
  faturacaoBruta: number; // conforme tua regra atual (com IVA, ou sem IVA) — o label abaixo reflete "com IVA"
  frascosVendidos: number;
  comissaoTotal: number;
  custoKm: number;
  incentivoPodologista: number;
  fundoFarmaceutico: number;
  custoFixo: number;
  resultadoOperacional: number;
  resultadoLiquido: number;

  // opcional: permite imprimir observações do fechamento do mês
  observacoes?: string | null;
}

export function gerarRelatorioFinanceiroPDF(dados: DadosFinanceirosMensais): void {
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;

  let yPosition = 20;

  const formatarMoeda = (valor: number) => {
    const n = Number.isFinite(valor) ? valor : 0;
    return (
      n.toLocaleString("pt-PT", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + " €"
    );
  };

  const formatarInteiro = (valor: number) => {
    const n = Number.isFinite(valor) ? valor : 0;
    return Math.round(n).toString();
  };

  const dataGeracao = new Date();
  const dataGeracaoFormatada = dataGeracao.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // ======================================================================
  // CABEÇALHO
  // ======================================================================
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Relatório Financeiro 100PHARMA", pageWidth / 2, yPosition, {
    align: "center",
  });

  yPosition += 10;

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`Mês de ${dados.mesNome} de ${dados.ano}`, pageWidth / 2, yPosition, {
    align: "center",
  });

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Gerado em: ${dataGeracaoFormatada}`, pageWidth - margin, 15, {
    align: "right",
  });

  yPosition += 8;

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 12;

  // ======================================================================
  // ESTILO BASE TABELAS
  // ======================================================================
  const estiloBaseTabela = {
    theme: "grid" as const,
    styles: {
      font: "helvetica" as const,
      fontSize: 10,
      cellPadding: 3,
      textColor: [40, 40, 40] as [number, number, number],
    },
    headStyles: {
      fillColor: [30, 64, 175] as [number, number, number],
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: "bold" as const,
      halign: "left" as const,
    },
    margin: { left: margin, right: margin },
  };

  // ======================================================================
  // SEÇÃO 1: RESUMO GERAL
  // ======================================================================
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("RESUMO GERAL", margin, yPosition);
  yPosition += 6;

  const resumoGeral = [
    ["Faturação Bruta (com IVA)", formatarMoeda(dados.faturacaoBruta)],
    ["Frascos Vendidos", formatarInteiro(dados.frascosVendidos)],
    ["Resultado Operacional", formatarMoeda(dados.resultadoOperacional)],
    ["Custos Fixos", formatarMoeda(dados.custoFixo)],
    ["Resultado Líquido", formatarMoeda(dados.resultadoLiquido)],
  ];

  autoTable(doc, {
    startY: yPosition,
    head: [["Descrição", "Valor"]],
    body: resumoGeral,
    ...estiloBaseTabela,
    columnStyles: {
      0: { halign: "left" },
      1: { halign: "right" },
    },
    didParseCell: (data) => {
      // Resultado Líquido negativo em vermelho
      if (data.row.index === 4 && data.column.index === 1 && dados.resultadoLiquido < 0) {
        data.cell.styles.textColor = [220, 38, 38];
      }
    },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 12;

  // ======================================================================
  // SEÇÃO 2: DETALHES DE CUSTOS E INCENTIVOS
  // ======================================================================
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("DETALHES DE CUSTOS E INCENTIVOS", margin, yPosition);
  yPosition += 6;

  const detalhesCustos = [
    ["Comissão Total (vendedores)", formatarMoeda(dados.comissaoTotal)],
    ["Custo de KM (quilometragem)", formatarMoeda(dados.custoKm)],
    ["Incentivo Podologista", formatarMoeda(dados.incentivoPodologista)],
    ["Fundo Farmacêutico", formatarMoeda(dados.fundoFarmaceutico)],
  ];

  autoTable(doc, {
    startY: yPosition,
    head: [["Descrição", "Valor"]],
    body: detalhesCustos,
    ...estiloBaseTabela,
    columnStyles: {
      0: { halign: "left" },
      1: { halign: "right" },
    },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 12;

  // ======================================================================
  // SEÇÃO 3: OBSERVAÇÕES
  // ======================================================================
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("OBSERVAÇÕES", margin, yPosition);
  yPosition += 6;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40, 40, 40);

  const observacoes =
    (dados.observacoes && dados.observacoes.trim()) ||
    "Sem observações registadas para este mês.";

  const linhas = doc.splitTextToSize(observacoes, pageWidth - 2 * margin);
  doc.text(linhas, margin, yPosition);

  // ======================================================================
  // RODAPÉ EM TODAS AS PÁGINAS
  // ======================================================================
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);

    const rodapeY = pageHeight - 10;

    doc.text(
      "Relatório gerado automaticamente pelo sistema 100PHARMA – Uso interno",
      pageWidth / 2,
      rodapeY,
      { align: "center" }
    );

    doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, rodapeY, {
      align: "right",
    });
  }

  // ======================================================================
  // GUARDAR PDF
  // ======================================================================
  const nomeDoFicheiro = `Relatorio_Financeiro_100PHARMA_${dados.ano}_${dados.mesNumero
    .toString()
    .padStart(2, "0")}.pdf`;

  doc.save(nomeDoFicheiro);
}
