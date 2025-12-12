'use client';

import Link from 'next/link';
import { useCallback, useMemo } from 'react';
import {
  gerarRelatorioPodologistaPdf,
  RelatorioRow,
} from '@/lib/relatorio-podologista-pdf';

type RelatorioClientProps = {
  podologistaNome: string;
  rows: RelatorioRow[];
  totalFarmacias: number;
  totalFrascosValidos: number;
  totalIncentivos: number;
  dataInicio: string | null;
  dataFim: string | null;
};

function formatDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  // Esperado: YYYY-MM-DD
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;

  const [year, month, day] = parts.map(Number);
  if (!year || !month || !day) return dateStr;

  return `${String(day).padStart(2, '0')}/${String(month).padStart(
    2,
    '0'
  )}/${year}`;
}

function toNumberSafe(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatEuro(value: unknown): string {
  const n = toNumberSafe(value, 0);
  // Formatação PT (vírgula decimal)
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export default function RelatorioClient(props: RelatorioClientProps) {
  const {
    podologistaNome,
    rows,
    totalFarmacias,
    totalFrascosValidos,
    totalIncentivos,
    dataInicio,
    dataFim,
  } = props;

  const periodoLabel = useMemo(() => {
    const ini = formatDate(dataInicio);
    const fim = formatDate(dataFim);

    if (ini && fim) return `Período: ${ini} a ${fim}`;
    if (ini && !fim) return `Período: a partir de ${ini}`;
    if (!ini && fim) return `Período: até ${fim}`;
    return 'Período: todo o histórico válido';
  }, [dataInicio, dataFim]);

  // Normalizar rows para evitar NaN / strings inesperadas
  const rowsNormalizadas = useMemo(() => {
    return (rows ?? []).map((r) => ({
      ...r,
      frascos_validos: toNumberSafe((r as any).frascos_validos, 0),
      incentivo_total: toNumberSafe((r as any).incentivo_total, 0),
    }));
  }, [rows]);

  const totalIncentivosSeguro = useMemo(() => {
    return toNumberSafe(totalIncentivos, 0);
  }, [totalIncentivos]);

  const handleExportPdf = useCallback(() => {
    try {
      gerarRelatorioPodologistaPdf({
        podologistaNome,
        rows: rowsNormalizadas as any,
        totalFarmacias: toNumberSafe(totalFarmacias, 0),
        totalFrascosValidos: toNumberSafe(totalFrascosValidos, 0),
        totalIncentivos: totalIncentivosSeguro,
        dataInicio,
        dataFim,
      });
    } catch (err) {
      console.error('Erro ao gerar PDF do podologista:', err);
      alert('Erro ao gerar o PDF. Verifique a consola do navegador.');
    }
  }, [
    podologistaNome,
    rowsNormalizadas,
    totalFarmacias,
    totalFrascosValidos,
    totalIncentivosSeguro,
    dataInicio,
    dataFim,
  ]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{podologistaNome}</h1>
          <p className="text-sm text-gray-500">Relatório de incentivos por cliente</p>
          <p className="text-xs text-gray-400 mt-1">{periodoLabel}</p>
        </div>

        <Link
          href="/podologistas"
          className="text-sm px-3 py-2 rounded border border-gray-300 hover:bg-gray-50"
        >
          Voltar aos Podologistas
        </Link>
      </div>

      {/* Filtros (GET, tratados no server) */}
      <form
        className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end"
        method="get"
      >
        <div className="flex flex-col space-y-1">
          <label htmlFor="data_inicio" className="text-sm font-medium">
            Data inicial
          </label>
          <input
            id="data_inicio"
            name="data_inicio"
            type="date"
            defaultValue={dataInicio ?? ''}
            className="border rounded px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col space-y-1">
          <label htmlFor="data_fim" className="text-sm font-medium">
            Data final
          </label>
          <input
            id="data_fim"
            name="data_fim"
            type="date"
            defaultValue={dataFim ?? ''}
            className="border rounded px-3 py-2 text-sm"
          />
        </div>

        <div className="hidden sm:block" />

        <div className="flex space-x-2 justify-end">
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Aplicar filtros
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            className="px-3 py-2 text-xs font-medium rounded border border-gray-300 hover:bg-gray-50"
          >
            Exportar PDF
          </button>

          <button
            type="button"
            className="px-3 py-2 text-xs font-medium rounded border border-gray-300 text-gray-400 cursor-not-allowed"
            disabled
          >
            Exportar Excel
          </button>
        </div>
      </form>

      {/* Cards resumo */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="border rounded-lg p-4 bg-white shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">
            Total de clientes
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {toNumberSafe(totalFarmacias, 0)}
          </p>
        </div>

        <div className="border rounded-lg p-4 bg-white shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">
            Total de frascos válidos
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {toNumberSafe(totalFrascosValidos, 0)}
          </p>
        </div>

        <div className="border rounded-lg p-4 bg-white shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">
            Total de incentivos
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {formatEuro(totalIncentivosSeguro)}
          </p>
        </div>
      </section>

      {/* Tabela detalhada por cliente */}
      <section className="border rounded-lg bg-white shadow-sm overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-600">
                Cliente
              </th>
              <th className="px-4 py-2 text-right font-medium text-gray-600">
                Frascos válidos
              </th>
              <th className="px-4 py-2 text-right font-medium text-gray-600">
                Incentivo
              </th>
            </tr>
          </thead>
          <tbody>
            {rowsNormalizadas.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-gray-500">
                  Nenhum frasco válido encontrado para os filtros selecionados.
                </td>
              </tr>
            )}

            {rowsNormalizadas.map((row) => (
              <tr key={row.cliente_id} className="border-t">
                <td className="px-4 py-2">
                  <span className="font-medium">{row.cliente_nome}</span>
                </td>
                <td className="px-4 py-2 text-right">{row.frascos_validos}</td>
                <td className="px-4 py-2 text-right">
                  {formatEuro(row.incentivo_total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
