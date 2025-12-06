// src/lib/relatorio-podologista-pdf.ts

// Tipo compatível com o que usamos no relatório do podologista
export type RelatorioRow = {
  podologista_id: string;
  podologista_nome: string;
  cliente_id: string;
  cliente_nome: string;
  frascos_validos: number;
  incentivo_total: string | number;
};

/**
 * Versão temporária: ainda sem geração real de PDF.
 * Apenas garante que o projeto compila e o botão funciona sem quebrar a build.
 */
export function gerarRelatorioPodologistaPdf(args: {
  podologistaNome: string;
  rows: RelatorioRow[];
  totalFarmacias: number;
  totalFrascosValidos: number;
  totalIncentivos: number;
  dataInicio: string | null;
  dataFim: string | null;
}) {
  // Isto só será executado no browser (chamado a partir de um componente 'use client')
  console.log('Dados do relatório do podologista para PDF:', args);
  alert('A exportação em PDF do podologista ainda está em configuração.');
}
