// src/lib/relatorio-vendedor-pdf.ts
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ======================================================================
// TIPOS
// ======================================================================

export interface VendedorInfo {
  nome: string;
  email: string;
  telefone?: string | null;
  ativo: boolean;
}

export interface ResumoVendedorMensal {
  faturacaoMes: number;
  frascosMes: number;
  comissaoMes: number;
  percentualMeta: number;
  clientesAtivos: number;
  kmRodadosMes: number;
  custoKmMes: number;
}

export interface VendaResumo {
  data: string; // ISO: 'YYYY-MM-DD'
  cliente_nome: string;
  total_com_iva: number;
  frascos: number;
}

export interface QuilometragemResumo {
  data: string; // ISO
  km: number;
  valor: number;
}

export interface VisitaResumo {
  data: string; // ISO
  cliente_nome: string;
  estado: string;
  notas?: string | null;
}

export interface RelatorioVendedorPayload {
  vendedor: VendedorInfo;
  resumo: ResumoVendedorMensal;

  // estes arrays serão usados nas próximas etapas
  vendas: VendaResumo[];
  quilometragens: QuilometragemResumo[];
  visitas: VisitaResumo[];

  dataInicio?: string | null; // 'YYYY-MM-DD'
  dataFim?: string | null;    // 'YYYY-MM-DD'
}

// ======================================================================
// FUNÇÃO PRINCIPAL
// ======================================================================

export function gerarRelatorioVendedorPdf(payload: RelatorioVendedorPayload) {
  const {
    vendedor,
    resumo,
    vendas,
    quilometragens,
    visitas,
    dataInicio,
    dataFim,
  } = payload;

  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let y = margin;

    // ==================================================================
    // CABEÇALHO 100PHARMA + VENDEDOR + PERÍODO
    // ==================================================================

    // Logo / Nome da empresa
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(37, 99, 235); // azul
    doc.text('100PHARMA', margin, y);

    // Título do relatório
    y += 8;
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('Relatório de Vendas do Vendedor', margin, y);

    // Nome do vendedor
    y += 7;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    doc.text(vendedor.nome, margin, y);

    // Email + telefone (se existir)
    y += 5;
    const linhaContato = vendedor.telefone
      ? `${vendedor.email} • ${vendedor.telefone}`
      : vendedor.email;
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text(linhaContato, margin, y);

    // Período
    y += 5;
    const periodoLabel = construirPeriodoLabel(dataInicio, dataFim);
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text(`Período: ${periodoLabel}`, margin, y);

    // Linha separadora
    y += 6;
    doc.setDrawColor(210, 210, 210);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // ==================================================================
    // RESUMO GERAL
    // ==================================================================

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Resumo Geral', margin, y);

    y += 6;

    const corpoResumo = [
      ['Faturação do mês (com IVA)', formatarMoeda(resumo.faturacaoMes) + ' €'],
      ['Frascos vendidos no mês', resumo.frascosMes.toString()],
      ['Comissão estimada', formatarMoeda(resumo.comissaoMes) + ' €'],
      ['Percentual de meta', resumo.percentualMeta.toFixed(0) + ' %'],
      ['Clientes ativos na carteira', resumo.clientesAtivos.toString()],
      ['Km rodados no mês', resumo.kmRodadosMes.toFixed(0) + ' km'],
      ['Custo de km no mês', formatarMoeda(resumo.custoKmMes) + ' €'],
    ];

    autoTable(doc, {
      startY: y,
      head: [],
      body: corpoResumo,
      theme: 'grid',
      styles: {
        fontSize: 10,
        cellPadding: 4,
      },
      columnStyles: {
        0: { cellWidth: 90, fontStyle: 'bold' },
        1: { cellWidth: 70, halign: 'right' },
      },
      margin: { left: margin, right: margin },
    });

    // posição final da tabela
    // @ts-ignore - lastAutoTable é adicionado pelo jspdf-autotable
    y = (doc as any).lastAutoTable.finalY + 12;

    // ==================================================================
    // (ETAPA 1 PARA AQUI)
    //
    // Nas PRÓXIMAS ETAPAS vamos acrescentar:
    //  - Detalhe de Vendas
    //  - Quilometragem
    //  - Visitas
    //  - Rodapé com data + nº de página
    // ==================================================================

    // Por enquanto já salvamos um PDF simples com cabeçalho + resumo
    const nomeArquivoBase = vendedor.nome || 'vendedor';
    const nomeArquivo = `Relatorio_Vendedor_${nomeArquivoBase.replace(
      /\s+/g,
      '_'
    )}.pdf`;

    doc.save(nomeArquivo);
  } catch (err) {
    console.error('Erro ao gerar PDF do vendedor:', err);
    // Deixo estourar a exceção para o componente tratar se quiser
    throw err;
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

function formatarDataCurta(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [ano, mes, dia] = iso.split('-').map(Number);
  if (!ano || !mes || !dia) return iso;
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
}

function construirPeriodoLabel(
  dataInicio?: string | null,
  dataFim?: string | null
): string {
  const ini = formatarDataCurta(dataInicio || null);
  const fim = formatarDataCurta(dataFim || null);

  if (ini && fim) return `${ini} a ${fim}`;
  if (ini && !fim) return `a partir de ${ini}`;
  if (!ini && fim) return `até ${fim}`;
  return 'todo o histórico válido';
}
