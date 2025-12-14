"use client";

import { useCallback, useState } from "react";
import { FileText } from "lucide-react";
import { gerarRelatorioFinanceiroPDF } from "@/lib/pdf/gerarRelatorioFinanceiro";

type DadosFinanceirosMensais = {
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
};

type Props = {
  dados: DadosFinanceirosMensais;
};

export function RelatorioFinanceiroPdfButton({ dados }: Props) {
  const [gerando, setGerando] = useState(false);

  const handleClick = useCallback(async () => {
    if (gerando) return;

    try {
      setGerando(true);
      await Promise.resolve(gerarRelatorioFinanceiroPDF(dados));
    } catch (err) {
      console.error("Erro ao gerar relatório financeiro PDF:", err);
      alert("Erro ao gerar o PDF. Veja o console para detalhes.");
    } finally {
      setGerando(false);
    }
  }, [dados, gerando]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={gerando}
      className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors font-semibold shadow-md flex items-center gap-2 justify-center disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <FileText className="w-5 h-5" />
      {gerando ? "Gerando..." : "Gerar Relatório (PDF)"}
    </button>
  );
}

