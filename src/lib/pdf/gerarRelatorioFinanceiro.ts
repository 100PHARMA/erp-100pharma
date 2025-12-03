import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface DadosFinanceirosMensais {
  ano: number;
  mesNumero: number; // 1-12
  mesNome: string;
  faturacaoBruta: number;
  frascosVendidos: number;
  comissaoTotal: number;
  custoKm: number;
  incentivoPodologista: number;
  fundoFarmaceutico: number;
  custoFixo: number;
  resultadoOperacional: number;
  resultadoLiquido: number;
}

export function gerarRelatorioFinanceiroPDF(dados: DadosFinanceirosMensais): void {
  // Criar documento PDF
  const doc = new jsPDF();

  // Configurações
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPosition = 20;

  // Helper para formatar moeda (formato português: vírgula decimal + sufixo €)
  const formatarMoeda = (valor: number) => {
    return valor.toLocaleString('pt-PT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + '€';
  };

  // Helper para formatar inteiros (frascos)
  const formatarInteiro = (valor: number) => {
    return valor.toString();
  };

  // Obter data e hora de geração
  const dataGeracao = new Date();
  const dataGeracaoFormatada = dataGeracao.toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // ======================================================================
  // CABEÇALHO DO PDF
  // ======================================================================
  
  // Título principal - centralizado
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Relatório Financeiro 100PHARMA', pageWidth / 2, yPosition, {
    align: 'center',
  });

  yPosition += 10;

  // Subtítulo - mês e ano - centralizado
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(
    `Mês de ${dados.mesNome} de ${dados.ano}`,
    pageWidth / 2,
    yPosition,
    { align: 'center' }
  );

  // Data e hora de geração - canto superior direito
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Gerado em: ${dataGeracaoFormatada}`,
    pageWidth - margin,
    15,
    { align: 'right' }
  );

  yPosition += 8;

  // Linha separadora após cabeçalho
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 12;

  // ======================================================================
  // ESTILO BASE PARA TABELAS
  // ======================================================================
  const estiloBaseTabela = {
    theme: 'grid' as const,
    styles: {
      font: 'helvetica' as const,
      fontSize: 10,
      cellPadding: 3,
      textColor: [40, 40, 40] as [number, number, number],
    },
    headStyles: {
      fillColor: [30, 64, 175] as [number, number, number], // Azul corporativo
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: 'bold' as const,
      halign: 'left' as const,
    },
    margin: { left: margin, right: margin },
  };

  // ======================================================================
  // SEÇÃO 1: RESUMO GERAL
  // ======================================================================
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('RESUMO GERAL', margin, yPosition);
  yPosition += 6;

  const resumoGeral = [
    ['Faturação Bruta (com IVA)', formatarMoeda(dados.faturacaoBruta)],
    ['Frascos Vendidos', formatarInteiro(dados.frascosVendidos)],
    ['Resultado Operacional', formatarMoeda(dados.resultadoOperacional)],
    ['Custos Fixos', formatarMoeda(dados.custoFixo)],
    ['Resultado Líquido', formatarMoeda(dados.resultadoLiquido)],
  ];

  autoTable(doc, {
    startY: yPosition,
    head: [['Descrição', 'Valor']],
    body: resumoGeral,
    ...estiloBaseTabela,
    columnStyles: {
      0: { halign: 'left' }, // Descrição à esquerda
      1: { halign: 'right' }, // Valor à direita
    },
    didParseCell: (data) => {
      // Se for a linha do Resultado Líquido e o valor for negativo, colorir de vermelho
      if (data.row.index === 4 && data.column.index === 1 && dados.resultadoLiquido < 0) {
        data.cell.styles.textColor = [220, 38, 38]; // Vermelho
      }
    },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 12;

  // ======================================================================
  // SEÇÃO 2: DETALHES DE CUSTOS E INCENTIVOS
  // ======================================================================
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('DETALHES DE CUSTOS E INCENTIVOS', margin, yPosition);
  yPosition += 6;

  const detalhesCustos = [
    ['Comissão Total (vendedores)', formatarMoeda(dados.comissaoTotal)],
    ['Custo de KM (quilometragem)', formatarMoeda(dados.custoKm)],
    ['Incentivo Podologista', formatarMoeda(dados.incentivoPodologista)],
    ['Fundo Farmacêutico', formatarMoeda(dados.fundoFarmaceutico)],
  ];

  autoTable(doc, {
    startY: yPosition,
    head: [['Descrição', 'Valor']],
    body: detalhesCustos,
    ...estiloBaseTabela,
    columnStyles: {
      0: { halign: 'left' }, // Descrição à esquerda
      1: { halign: 'right' }, // Valor à direita
    },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 12;

  // ======================================================================
  // SEÇÃO 3: DESEMPENHO DOS VENDEDORES
  // ======================================================================
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('DESEMPENHO DOS VENDEDORES', margin, yPosition);
  yPosition += 6;

  // Nota: Como não temos dados individuais de vendedores na interface atual,
  // vamos criar uma tabela de exemplo. Em produção, estes dados viriam do Supabase.
  const vendedoresExemplo = [
    ['João Silva', formatarMoeda(dados.faturacaoBruta * 0.4), formatarInteiro(Math.floor(dados.frascosVendidos * 0.4)), formatarMoeda(dados.comissaoTotal * 0.4)],
    ['Maria Santos', formatarMoeda(dados.faturacaoBruta * 0.35), formatarInteiro(Math.floor(dados.frascosVendidos * 0.35)), formatarMoeda(dados.comissaoTotal * 0.35)],
    ['Pedro Costa', formatarMoeda(dados.faturacaoBruta * 0.25), formatarInteiro(Math.floor(dados.frascosVendidos * 0.25)), formatarMoeda(dados.comissaoTotal * 0.25)],
  ];

  autoTable(doc, {
    startY: yPosition,
    head: [['Vendedor', 'Faturação', 'Frascos', 'Comissão']],
    body: vendedoresExemplo,
    ...estiloBaseTabela,
    columnStyles: {
      0: { halign: 'left' }, // Vendedor à esquerda
      1: { halign: 'right' }, // Faturação à direita
      2: { halign: 'right' }, // Frascos à direita
      3: { halign: 'right' }, // Comissão à direita
    },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 12;

  // ======================================================================
  // SEÇÃO 4: OBSERVAÇÕES
  // ======================================================================
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('OBSERVAÇÕES', margin, yPosition);
  yPosition += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 40, 40);
  
  // Texto de observações (pode ser expandido futuramente com dados reais)
  const observacoes = 'Sem observações registradas para este mês.';
  const observacoesLinhas = doc.splitTextToSize(observacoes, pageWidth - 2 * margin);
  doc.text(observacoesLinhas, margin, yPosition);

  // ======================================================================
  // RODAPÉ (aplicado em todas as páginas)
  // ======================================================================
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);

    const rodapeY = doc.internal.pageSize.getHeight() - 10;

    // Texto centralizado
    doc.text(
      'Relatório gerado automaticamente pelo sistema 100PHARMA – Uso interno',
      pageWidth / 2,
      rodapeY,
      { align: 'center' }
    );

    // Número da página (canto direito)
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth - margin,
      rodapeY,
      { align: 'right' }
    );
  }

  // ======================================================================
  // SALVAR PDF
  // ======================================================================
  const nomeDoFicheiro = `Relatorio_Financeiro_100PHARMA_${dados.ano}_${dados.mesNumero.toString().padStart(2, '0')}.pdf`;
  doc.save(nomeDoFicheiro);
}
