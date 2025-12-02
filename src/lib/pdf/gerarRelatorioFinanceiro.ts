import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface DadosRelatorioFinanceiro {
  ano: number;
  mes: number;
  faturacaoBruta: number;
  frascosVendidos: number;
  comissaoTotal: number;
  custoKm: number;
  incentivoPodologista: number;
  fundoFarmaceutico: number;
  custosFixos?: number;
  resultadoLiquido?: number;
  resultadoOperacional: number;
  vendedores?: Array<{
    nome: string;
    faturacao: number;
    frascos: number;
    comissao: number;
  }>;
  observacoes?: string;
}

export async function gerarRelatorioFinanceiro(
  dados: DadosRelatorioFinanceiro
): Promise<Blob> {
  // Criar documento PDF
  const doc = new jsPDF();

  // Configurações
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPosition = 20;

  // Helper para formatar moeda
  const formatarMoeda = (valor: number) => {
    return valor.toLocaleString('pt-PT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + '€';
  };

  // Helper para nome do mês
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // ======================================================================
  // CABEÇALHO
  // ======================================================================
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório Financeiro 100PHARMA', pageWidth / 2, yPosition, {
    align: 'center',
  });

  yPosition += 10;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${meses[dados.mes - 1]} de ${dados.ano}`,
    pageWidth / 2,
    yPosition,
    { align: 'center' }
  );

  yPosition += 15;

  // Linha separadora
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  // ======================================================================
  // RESUMO GERAL
  // ======================================================================
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMO GERAL', margin, yPosition);
  yPosition += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const resumoGeral = [
    ['Faturação Bruta (com IVA)', formatarMoeda(dados.faturacaoBruta)],
    ['Frascos Vendidos', dados.frascosVendidos.toString()],
    ['Resultado Operacional', formatarMoeda(dados.resultadoOperacional)],
  ];

  if (dados.custosFixos !== undefined) {
    resumoGeral.push(['Custos Fixos', formatarMoeda(dados.custosFixos)]);
  }

  if (dados.resultadoLiquido !== undefined) {
    resumoGeral.push([
      'Resultado Líquido',
      formatarMoeda(dados.resultadoLiquido),
    ]);
  }

  autoTable(doc, {
    startY: yPosition,
    head: [],
    body: resumoGeral,
    theme: 'grid',
    styles: { fontSize: 10 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 100 },
      1: { halign: 'right', cellWidth: 70 },
    },
    margin: { left: margin, right: margin },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 10;

  // ======================================================================
  // DETALHES DE CUSTOS E INCENTIVOS
  // ======================================================================
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('DETALHES DE CUSTOS E INCENTIVOS', margin, yPosition);
  yPosition += 8;

  const detalhesCustos = [
    ['Comissão Total (vendedores)', formatarMoeda(dados.comissaoTotal)],
    ['Custo de KM (quilometragem)', formatarMoeda(dados.custoKm)],
    ['Incentivo Podologista', formatarMoeda(dados.incentivoPodologista)],
    ['Fundo Farmacêutico', formatarMoeda(dados.fundoFarmaceutico)],
  ];

  autoTable(doc, {
    startY: yPosition,
    head: [],
    body: detalhesCustos,
    theme: 'grid',
    styles: { fontSize: 10 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 100 },
      1: { halign: 'right', cellWidth: 70 },
    },
    margin: { left: margin, right: margin },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 10;

  // ======================================================================
  // SECÇÃO DE VENDEDORES
  // ======================================================================
  if (dados.vendedores && dados.vendedores.length > 0) {
    // Verificar se precisa de nova página
    if (yPosition > 220) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DESEMPENHO DOS VENDEDORES', margin, yPosition);
    yPosition += 8;

    const vendedoresData = dados.vendedores.map((v) => [
      v.nome,
      formatarMoeda(v.faturacao),
      v.frascos.toString(),
      formatarMoeda(v.comissao),
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [['Vendedor', 'Faturação', 'Frascos', 'Comissão']],
      body: vendedoresData,
      theme: 'striped',
      styles: { fontSize: 9 },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { halign: 'right', cellWidth: 40 },
        2: { halign: 'center', cellWidth: 30 },
        3: { halign: 'right', cellWidth: 40 },
      },
      margin: { left: margin, right: margin },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 10;
  }

  // ======================================================================
  // OBSERVAÇÕES
  // ======================================================================
  if (dados.observacoes) {
    // Verificar se precisa de nova página
    if (yPosition > 240) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('OBSERVAÇÕES', margin, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    // Quebrar texto em múltiplas linhas se necessário
    const observacoesLines = doc.splitTextToSize(
      dados.observacoes,
      pageWidth - 2 * margin
    );
    doc.text(observacoesLines, margin, yPosition);
    yPosition += observacoesLines.length * 5 + 10;
  }

  // ======================================================================
  // RODAPÉ
  // ======================================================================
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);

    // Data de geração
    const dataGeracao = new Date().toLocaleString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    doc.text(
      `Gerado em: ${dataGeracao}`,
      margin,
      doc.internal.pageSize.getHeight() - 10
    );

    // Número da página
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth - margin,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'right' }
    );
  }

  // ======================================================================
  // RETORNAR BLOB
  // ======================================================================
  const pdfBlob = doc.output('blob');
  return pdfBlob;
}
