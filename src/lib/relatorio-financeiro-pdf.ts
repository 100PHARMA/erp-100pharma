import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ======================================================================
// TIPOS
// ======================================================================

export interface VendedorResumo {
  nome: string;
  faturacao: number;
  frascos: number;
  comissao: number;
}

export interface ClienteTop {
  nome: string;
  faturacao: number;
}

export interface RelatorioFinanceiroMensal {
  ano: number;
  mes: number;
  faturacaoBruta: number;
  frascosVendidos: number;
  resultadoOperacional: number;
  comissaoTotal: number;
  custoKm: number;
  incentivoPodologista: number;
  fundoFarmaceutico: number;
  custosFixos?: number;
  resultadoLiquido?: number;
  pontoEquilibrioFrascos?: number;
  pontoEquilibrioValor?: number;
  vendedores: VendedorResumo[];
  topClientes?: ClienteTop[];
  observacoes?: string;
}

// ======================================================================
// FUNÇÃO PRINCIPAL DE GERAÇÃO DE PDF
// ======================================================================

export async function gerarRelatorioFinanceiroPdf(
  dados: RelatorioFinanceiroMensal
): Promise<Blob> {
  try {
    // Criar documento PDF
    const doc = new jsPDF();
    
    // Configurações
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPosition = margin;

    // ======================================================================
    // CABEÇALHO
    // ======================================================================
    
    // Logo/Nome da empresa
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235); // Azul
    doc.text('100PHARMA', margin, yPosition);
    
    yPosition += 8;
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('Relatório Financeiro Mensal', margin, yPosition);
    
    yPosition += 6;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    const nomeMes = obterNomeMes(dados.mes);
    doc.text(`${nomeMes} de ${dados.ano}`, margin, yPosition);
    
    // Linha separadora
    yPosition += 5;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    // ======================================================================
    // RESUMO GERAL
    // ======================================================================
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Resumo Geral', margin, yPosition);
    yPosition += 8;

    // Tabela de resumo geral
    const resumoData = [
      ['Faturação Bruta (com IVA)', formatarMoeda(dados.faturacaoBruta) + '€'],
      ['Frascos Vendidos', dados.frascosVendidos.toString()],
      ['Resultado Operacional', formatarMoeda(dados.resultadoOperacional) + '€'],
    ];

    if (dados.custosFixos !== undefined) {
      resumoData.push(['Custos Fixos', formatarMoeda(dados.custosFixos) + '€']);
    }

    if (dados.resultadoLiquido !== undefined) {
      resumoData.push([
        'Resultado Líquido',
        formatarMoeda(dados.resultadoLiquido) + '€',
      ]);
    }

    autoTable(doc, {
      startY: yPosition,
      head: [],
      body: resumoData,
      theme: 'grid',
      styles: {
        fontSize: 10,
        cellPadding: 4,
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 100 },
        1: { halign: 'right', cellWidth: 80 },
      },
      margin: { left: margin, right: margin },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 10;

    // ======================================================================
    // DETALHES DE CUSTOS E INCENTIVOS
    // ======================================================================
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Detalhes de Custos e Incentivos', margin, yPosition);
    yPosition += 8;

    const custosData = [
      ['Comissão Total (vendedores)', formatarMoeda(dados.comissaoTotal) + '€'],
      ['Custo de KM (quilometragem)', formatarMoeda(dados.custoKm) + '€'],
      [
        'Incentivo Podologista',
        formatarMoeda(dados.incentivoPodologista) + '€',
      ],
      ['Fundo Farmacêutico', formatarMoeda(dados.fundoFarmaceutico) + '€'],
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [],
      body: custosData,
      theme: 'grid',
      styles: {
        fontSize: 10,
        cellPadding: 4,
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 100 },
        1: { halign: 'right', cellWidth: 80 },
      },
      margin: { left: margin, right: margin },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 10;

    // ======================================================================
    // PONTO DE EQUILÍBRIO (se disponível)
    // ======================================================================
    
    if (dados.pontoEquilibrioFrascos && dados.pontoEquilibrioValor) {
      // Verificar se precisa de nova página
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = margin;
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Ponto de Equilíbrio', margin, yPosition);
      yPosition += 8;

      const pontoEquilibrioData = [
        [
          'Frascos necessários',
          Math.round(dados.pontoEquilibrioFrascos).toString(),
        ],
        [
          'Faturação necessária',
          formatarMoeda(dados.pontoEquilibrioValor) + '€',
        ],
      ];

      autoTable(doc, {
        startY: yPosition,
        head: [],
        body: pontoEquilibrioData,
        theme: 'grid',
        styles: {
          fontSize: 10,
          cellPadding: 4,
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 100 },
          1: { halign: 'right', cellWidth: 80 },
        },
        margin: { left: margin, right: margin },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;
    }

    // ======================================================================
    // SECÇÃO DE VENDEDORES
    // ======================================================================
    
    // Verificar se precisa de nova página
    if (yPosition > pageHeight - 80) {
      doc.addPage();
      yPosition = margin;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Desempenho por Vendedor', margin, yPosition);
    yPosition += 8;

    if (dados.vendedores.length > 0) {
      const vendedoresData = dados.vendedores.map((v) => [
        v.nome,
        formatarMoeda(v.faturacao) + '€',
        v.frascos.toString(),
        formatarMoeda(v.comissao) + '€',
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [['Vendedor', 'Faturação', 'Frascos', 'Comissão']],
        body: vendedoresData,
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
          0: { cellWidth: 60 },
          1: { halign: 'right', cellWidth: 40 },
          2: { halign: 'center', cellWidth: 30 },
          3: { halign: 'right', cellWidth: 40 },
        },
        margin: { left: margin, right: margin },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;
    } else {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      doc.text('Nenhum vendedor com vendas neste mês.', margin, yPosition);
      yPosition += 10;
    }

    // ======================================================================
    // TOP CLIENTES (se disponível)
    // ======================================================================
    
    if (dados.topClientes && dados.topClientes.length > 0) {
      // Verificar se precisa de nova página
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = margin;
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Top Clientes do Mês', margin, yPosition);
      yPosition += 8;

      const clientesData = dados.topClientes.map((c) => [
        c.nome,
        formatarMoeda(c.faturacao) + '€',
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [['Cliente', 'Faturação']],
        body: clientesData,
        theme: 'striped',
        headStyles: {
          fillColor: [16, 185, 129],
          textColor: 255,
          fontStyle: 'bold',
        },
        styles: {
          fontSize: 9,
          cellPadding: 3,
        },
        columnStyles: {
          0: { cellWidth: 100 },
          1: { halign: 'right', cellWidth: 60 },
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
      if (yPosition > pageHeight - 40) {
        doc.addPage();
        yPosition = margin;
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Observações', margin, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      
      // Quebrar texto em múltiplas linhas se necessário
      const observacoesLinhas = doc.splitTextToSize(
        dados.observacoes,
        pageWidth - 2 * margin
      );
      doc.text(observacoesLinhas, margin, yPosition);
      yPosition += observacoesLinhas.length * 5 + 10;
    }

    // ======================================================================
    // RODAPÉ
    // ======================================================================
    
    // Ir para o final da página
    yPosition = pageHeight - 20;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150, 150, 150);
    const dataGeracao = new Date().toLocaleString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    doc.text(
      `Relatório gerado em: ${dataGeracao}`,
      margin,
      yPosition
    );

    // Número de página
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Página ${i} de ${totalPages}`,
        pageWidth - margin - 20,
        pageHeight - 10
      );
    }

    // ======================================================================
    // RETORNAR BLOB
    // ======================================================================
    
    const pdfBlob = doc.output('blob');
    return pdfBlob;
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    throw new Error('Falha ao gerar relatório PDF: ' + (error as Error).message);
  }
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

function obterNomeMes(mes: number): string {
  const meses = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];
  return meses[mes - 1] || 'Mês Inválido';
}
