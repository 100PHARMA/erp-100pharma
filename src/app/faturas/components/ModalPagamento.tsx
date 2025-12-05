'use client';

import { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, FileText, MessageSquare } from 'lucide-react';
import { formatCurrency } from '@/utils/formatCurrency';
import { registrarPagamentoFatura } from '../actions';
import { toast } from 'sonner';

interface ModalPagamentoProps {
  fatura: {
    id: string;
    numero: string;
    total_com_iva: number;
    valor_pago?: number;
  };
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ModalPagamento({
  fatura,
  isOpen,
  onClose,
  onSuccess,
}: ModalPagamentoProps) {
  // Calcular saldo em aberto
  const total = fatura.total_com_iva ?? 0;
  const jaPago = fatura.valor_pago ?? 0;
  const saldo = Math.max(total - jaPago, 0);

  const [dataPagamento, setDataPagamento] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [valorPago, setValorPago] = useState(saldo.toFixed(2));
  const [metodoPagamento, setMetodoPagamento] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [loading, setLoading] = useState(false);

  // Atualizar valor quando o modal abrir com nova fatura
  useEffect(() => {
    if (isOpen) {
      const novoSaldo = Math.max(total - jaPago, 0);
      setValorPago(novoSaldo.toFixed(2));
      setDataPagamento(new Date().toISOString().split('T')[0]);
      setMetodoPagamento('');
      setObservacoes('');
    }
  }, [isOpen, total, jaPago]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const valorNumerico = parseFloat(valorPago);
      
      if (isNaN(valorNumerico) || valorNumerico <= 0) {
        toast.error('Valor pago deve ser maior que zero');
        setLoading(false);
        return;
      }

      if (valorNumerico > saldo) {
        toast.error(`Valor não pode ser maior que o saldo em aberto (${formatCurrency(saldo)})`);
        setLoading(false);
        return;
      }

      const result = await registrarPagamentoFatura(
        fatura.id,
        valorNumerico,
        dataPagamento,
        metodoPagamento || null,
        observacoes || null
      );

      if (result.success) {
        toast.success('Pagamento registrado com sucesso!');
        onSuccess();
        onClose();
      } else {
        toast.error(result.error || 'Erro ao processar pagamento');
      }
    } catch (err) {
      console.error('Erro ao processar pagamento:', err);
      toast.error('Erro inesperado ao processar pagamento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Registrar Pagamento
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Fatura {fatura.numero}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={loading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Resumo Financeiro */}
        <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-b border-gray-200">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total da Fatura:</span>
              <span className="text-lg font-bold text-gray-900">
                {formatCurrency(total)}
              </span>
            </div>
            {jaPago > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Já Pago:</span>
                <span className="text-lg font-semibold text-green-600">
                  {formatCurrency(jaPago)}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-gray-300">
              <span className="text-sm font-semibold text-gray-700">Saldo em Aberto:</span>
              <span className="text-xl font-bold text-blue-600">
                {formatCurrency(saldo)}
              </span>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Data de Pagamento */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Data de Pagamento *
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Valor Pago */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Valor a Pagar *
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={saldo}
                value={valorPago}
                onChange={(e) => setValorPago(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                required
                disabled={loading}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Você pode pagar o valor total ou fazer um pagamento parcial
            </p>
          </div>

          {/* Método de Pagamento */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Método de Pagamento <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={metodoPagamento}
                onChange={(e) => setMetodoPagamento(e.target.value)}
                placeholder="Ex: Transferência, MBWay, Multibanco..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                disabled={loading}
              />
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Observações <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <div className="relative">
              <MessageSquare className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Adicione notas sobre este pagamento..."
                rows={3}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                disabled={loading}
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Processando...' : 'Confirmar Pagamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
