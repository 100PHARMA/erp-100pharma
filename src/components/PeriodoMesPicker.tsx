'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type Props = {
  className?: string;
  anosAtras?: number;
  anosFrente?: number;
  label?: string;
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function PeriodoMesPicker({
  className = '',
  anosAtras = 2,
  anosFrente = 0,
  label = 'Período',
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  const now = new Date();
  const anoAtual = now.getUTCFullYear();
  const mesAtual = now.getUTCMonth() + 1;

  const ano = Number(sp.get('ano')) || anoAtual;
  const mes = Number(sp.get('mes')) || mesAtual;

  const anos = useMemo(() => {
    const out: number[] = [];
    for (let a = anoAtual - anosAtras; a <= anoAtual + anosFrente; a++) out.push(a);
    return out;
  }, [anoAtual, anosAtras, anosFrente]);

  const meses = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);

  const setPeriodo = (novoAno: number, novoMes: number) => {
    const params = new URLSearchParams(sp.toString());
    params.set('ano', String(novoAno));
    params.set('mes', String(novoMes));
    router.replace(`?${params.toString()}`);
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="text-sm font-medium text-gray-700">{label}</div>
      <div className="flex gap-2">
        <select
          value={ano}
          onChange={(e) => setPeriodo(Number(e.target.value), mes)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
        >
          {anos.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <select
          value={mes}
          onChange={(e) => setPeriodo(ano, Number(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
        >
          {meses.map((m) => (
            <option key={m} value={m}>
              {pad2(m)}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setPeriodo(anoAtual, mesAtual)}
          className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          title="Voltar ao mês atual"
        >
          Mês atual
        </button>
      </div>

      <div className="text-xs text-gray-500">
        Período global via URL (?ano=YYYY&mes=MM). Base: € sem IVA (faturas emitidas).
      </div>
    </div>
  );
}
