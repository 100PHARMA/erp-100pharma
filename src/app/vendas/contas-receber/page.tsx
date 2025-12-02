'use client';

import { useState, useMemo } from 'react';
import { DollarSign, Search, Calendar, AlertTriangle, CheckCircle, Clock, XCircle, TrendingUp, ArrowLeft, Filter } from 'lucide-react';
import { faturasMock, clientesMock } from '@/lib/data';
import { Fatura } from '@/lib/types';
import Link from 'next/link';

type StatusConta = 'EM_ABERTO' | 'PARCIAL' | 'PAGO' | 'VENCIDO';
type AgingRange = '0-30' | '31-60' | '61-90' | '90+';

export default function ContasReceberPage() {
  const [contas, setContas] = useState<Fatura[]>(faturasMock);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusConta | 'TODOS'>('TODOS');
  const [filtroAging, setFiltroAging] = useState<AgingRange | 'TODOS'>('TODOS');

  // Calcular aging (dias em atraso)
  const calcularAging = (dataVencimento: Date): number => {
    const hoje = new Date();
    const vencimento = new Date(dataVencimento);
    const diffTime = hoje.getTime() - vencimento.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Obter range de aging
  const getAgingRange = (dias: number): AgingRange => {
    if (dias <= 30) return '0-30';
    if (dias <= 60) return '31-60';
    if (dias <= 90) return '61-90';
    return '90+';
  };

  // Determinar status da conta
  const determinarStatus = (fatura: Fatura): StatusConta => {
    const aging = calcularAging(fatura.dataVencimento);
    
    if (fatura.valorPago >= fatura.valor) {
      return 'PAGO';
    } else if (fatura.valorPago > 0) {
      return 'PARCIAL';
    } else if (aging > 0) {
      return 'VENCIDO';
    } else {
      return 'EM_ABERTO';
    }
  };

  // Filtrar contas
  const contasFiltradas = useMemo(() => {
    return contas.filter(conta => {
      const status = determinarStatus(conta);
      const aging = calcularAging(conta.dataVencimento);
      const agingRange = getAgingRange(aging);

      const matchSearch = conta.numero?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         conta.clienteNome?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = filtroStatus === 'TODOS' || status === filtroStatus;
      const matchAging = filtroAging === 'TODOS' || agingRange === filtroAging;
      
      return matchSearch && matchStatus && matchAging;
    });
  }, [contas, searchTerm, filtroStatus, filtroAging]);

  // Estatísticas
  const stats = useMemo(() => {
    const emAberto = contas.filter(c => determinarStatus(c) === 'EM_ABERTO').length;
    const parcial = contas.filter(c => determinarStatus(c) === 'PARCIAL').length;
    const pago = contas.filter(c => determinarStatus(c) === 'PAGO').length;
    const vencido = contas.filter(c => determinarStatus(c) === 'VENCIDO').length;

    const valorEmAberto = contas
      .filter(c => determinarStatus(c) === 'EM_ABERTO')
      .reduce((acc, c) => acc + (c.valor - c.valorPago), 0);

    const valorVencido = contas
      .filter(c => determinarStatus(c) === 'VENCIDO')
      .reduce((acc, c) => acc + (c.valor - c.valorPago), 0);

    const valorRecebido = contas
      .filter(c => determinarStatus(c) === 'PAGO')
      .reduce((acc, c) => acc + c.valor, 0);

    // Aging
    const aging030 = contas.filter(c => {
      const dias = calcularAging(c.dataVencimento);
      return dias > 0 && dias <= 30 && determinarStatus(c) !== 'PAGO';
    }).reduce((acc, c) => acc + (c.valor - c.valorPago), 0);

    const aging3160 = contas.filter(c => {
      const dias = calcularAging(c.dataVencimento);
      return dias > 30 && dias <= 60 && determinarStatus(c) !== 'PAGO';
    }).reduce((acc, c) => acc + (c.valor - c.valorPago), 0);

    const aging6190 = contas.filter(c => {
      const dias = calcularAging(c.dataVencimento);
      return dias > 60 && dias <= 90 && determinarStatus(c) !== 'PAGO';
    }).reduce((acc, c) => acc + (c.valor - c.valorPago), 0);

    const aging90plus = contas.filter(c => {
      const dias = calcularAging(c.dataVencimento);
      return dias > 90 && determinarStatus(c) !== 'PAGO';
    }).reduce((acc, c) => acc + (c.valor - c.valorPago), 0);

    return {
      emAberto,
      parcial,
      pago,
      vencido,
      valorEmAberto,
      valorVencido,
      valorRecebido,
      aging030,
      aging3160,
      aging6190,
      aging90plus
    };
  }, [contas]);

  // Verificar limite de crédito
  const verificarLimiteCredito = (clienteId: string): { ultrapassado: boolean; percentual: number } => {
    const cliente = clientesMock.find(c => c.id === clienteId);
    if (!cliente || !cliente.limiteCredito) {
      return { ultrapassado: false, percentual: 0 };
    }

    const totalPendente = contas
      .filter(c => c.clienteId === clienteId && determinarStatus(c) !== 'PAGO')
      .reduce((acc, c) => acc + (c.valor - c.valorPago), 0);

    const percentual = (totalPendente / cliente.limiteCredito) * 100;
    const ultrapassado = totalPendente > cliente.limiteCredito;

    return { ultrapassado, percentual };
  };

  // Registrar pagamento
  const registrarPagamento = (faturaId: string) => {
    const fatura = contas.find(c => c.id === faturaId);
    if (!fatura) return;

    const valorRestante = fatura.valor - fatura.valorPago;
    const valorPagamento = prompt(`Valor a receber: ${valorRestante.toFixed(2)}€\n\nDigite o valor do pagamento:`);
    
    if (valorPagamento) {
      const valor = parseFloat(valorPagamento);
      if (isNaN(valor) || valor <= 0) {
        alert('Valor inválido!');
        return;
      }

      if (valor > valorRestante) {
        alert('Valor maior que o saldo pendente!');
        return;
      }

      const contasAtualizadas = contas.map(c =>
        c.id === faturaId
          ? { ...c, valorPago: c.valorPago + valor }
          : c
      );

      setContas(contasAtualizadas);
      alert(`✅ Pagamento de ${valor.toFixed(2)}€ registrado com sucesso!`);
    }
  };

  // Obter cor do status
  const getStatusColor = (status: StatusConta) => {
    switch (status) {
      case 'EM_ABERTO': return 'bg-blue-100 text-blue-800';
      case 'PARCIAL': return 'bg-yellow-100 text-yellow-800';
      case 'PAGO': return 'bg-green-100 text-green-800';
      case 'VENCIDO': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Obter ícone do status
  const getStatusIcon = (status: StatusConta) => {
    switch (status) {
      case 'EM_ABERTO': return <Clock className="w-4 h-4" />;
      case 'PARCIAL': return <TrendingUp className="w-4 h-4" />;
      case 'PAGO': return <CheckCircle className="w-4 h-4" />;
      case 'VENCIDO': return <AlertTriangle className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Link 
            href="/vendas"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-green-600" />
              Contas a Receber
            </h1>
            <p className="text-gray-600 text-sm sm:text-base mt-1">
              Gestão de recebimentos e aging
            </p>
          </div>
        </div>
      </div>

      {/* Estatísticas de Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Em Aberto</p>
              <p className="text-2xl font-bold text-blue-600">
                {stats.valorEmAberto.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
              </p>
              <p className="text-xs text-gray-500 mt-1">{stats.emAberto} contas</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-100 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Parcial</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.parcial}</p>
              <p className="text-xs text-gray-500 mt-1">contas</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3">
            <div className="bg-red-100 p-3 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Vencido</p>
              <p className="text-2xl font-bold text-red-600">
                {stats.valorVencido.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
              </p>
              <p className="text-xs text-gray-500 mt-1">{stats.vencido} contas</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-3 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Recebido</p>
              <p className="text-2xl font-bold text-green-600">
                {stats.valorRecebido.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
              </p>
              <p className="text-xs text-gray-500 mt-1">{stats.pago} contas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Aging */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-600" />
          Aging (Análise de Vencimento)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
            <p className="text-sm text-gray-600 mb-1">0-30 dias</p>
            <p className="text-xl font-bold text-green-700">
              {stats.aging030.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
            </p>
          </div>
          <div className="p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-500">
            <p className="text-sm text-gray-600 mb-1">31-60 dias</p>
            <p className="text-xl font-bold text-yellow-700">
              {stats.aging3160.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
            </p>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg border-l-4 border-orange-500">
            <p className="text-sm text-gray-600 mb-1">61-90 dias</p>
            <p className="text-xl font-bold text-orange-700">
              {stats.aging6190.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
            </p>
          </div>
          <div className="p-4 bg-red-50 rounded-lg border-l-4 border-red-500">
            <p className="text-sm text-gray-600 mb-1">90+ dias</p>
            <p className="text-xl font-bold text-red-700">
              {stats.aging90plus.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
            </p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Filtros</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por número ou cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="TODOS">Todos os Status</option>
            <option value="EM_ABERTO">Em Aberto</option>
            <option value="PARCIAL">Parcial</option>
            <option value="PAGO">Pago</option>
            <option value="VENCIDO">Vencido</option>
          </select>

          <select
            value={filtroAging}
            onChange={(e) => setFiltroAging(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="TODOS">Todos os Períodos</option>
            <option value="0-30">0-30 dias</option>
            <option value="31-60">31-60 dias</option>
            <option value="61-90">61-90 dias</option>
            <option value="90+">90+ dias</option>
          </select>
        </div>
      </div>

      {/* Lista de Contas */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-green-600 to-emerald-600 text-white">
              <tr>
                <th className="text-left py-4 px-4 sm:px-6 text-sm font-semibold">Fatura</th>
                <th className="text-left py-4 px-4 text-sm font-semibold">Cliente</th>
                <th className="text-center py-4 px-4 text-sm font-semibold">Vencimento</th>
                <th className="text-center py-4 px-4 text-sm font-semibold">Aging</th>
                <th className="text-center py-4 px-4 text-sm font-semibold">Status</th>
                <th className="text-right py-4 px-4 text-sm font-semibold">Valor</th>
                <th className="text-right py-4 px-4 text-sm font-semibold">Pago</th>
                <th className="text-right py-4 px-4 text-sm font-semibold">Saldo</th>
                <th className="text-center py-4 px-4 text-sm font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {contasFiltradas.map((conta, index) => {
                const status = determinarStatus(conta);
                const aging = calcularAging(conta.dataVencimento);
                const saldo = conta.valor - conta.valorPago;
                const limiteInfo = verificarLimiteCredito(conta.clienteId);

                return (
                  <tr 
                    key={conta.id}
                    className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                    }`}
                  >
                    <td className="py-4 px-4 sm:px-6">
                      <p className="font-semibold text-gray-900">{conta.numero}</p>
                    </td>
                    <td className="py-4 px-4">
                      <div>
                        <p className="text-sm text-gray-900">{conta.clienteNome}</p>
                        {limiteInfo.ultrapassado && (
                          <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Limite ultrapassado
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center text-sm text-gray-600">
                      {new Date(conta.dataVencimento).toLocaleDateString('pt-PT')}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {aging > 0 ? (
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          aging <= 30 ? 'bg-green-100 text-green-800' :
                          aging <= 60 ? 'bg-yellow-100 text-yellow-800' :
                          aging <= 90 ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {aging} dias
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">-</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                        {getStatusIcon(status)}
                        {status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="font-semibold text-gray-900">
                        {(conta.valor || 0).toFixed(2)}€
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="text-green-600 font-medium">
                        {(conta.valorPago || 0).toFixed(2)}€
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className={`font-bold ${saldo > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {(saldo || 0).toFixed(2)}€
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-center">
                        {status !== 'PAGO' && (
                          <button 
                            onClick={() => registrarPagamento(conta.id)}
                            className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition-colors"
                          >
                            Receber
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {contasFiltradas.length === 0 && (
          <div className="text-center py-12">
            <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Nenhuma conta encontrada</p>
          </div>
        )}
      </div>

      {/* Alertas de Limite de Crédito */}
      {clientesMock.some(cliente => {
        const limiteInfo = verificarLimiteCredito(cliente.id);
        return limiteInfo.ultrapassado;
      }) && (
        <div className="mt-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-red-900 mb-2">⚠️ Clientes com Limite de Crédito Ultrapassado</h4>
              <p className="text-sm text-red-800 mb-3">
                Os seguintes clientes ultrapassaram o limite de crédito. Novas vendas estão bloqueadas:
              </p>
              <ul className="space-y-2">
                {clientesMock
                  .filter(cliente => verificarLimiteCredito(cliente.id).ultrapassado)
                  .map(cliente => {
                    const limiteInfo = verificarLimiteCredito(cliente.id);
                    return (
                      <li key={cliente.id} className="text-sm text-red-800">
                        <strong>{cliente.nome}</strong> - {limiteInfo.percentual.toFixed(0)}% do limite utilizado
                      </li>
                    );
                  })}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
