'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, User, FileText, Package, CreditCard, CheckCircle, Clock, AlertCircle, Save, DollarSign, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/utils/formatCurrency';
import Link from 'next/link';
import ModalPagamento from '../components/ModalPagamento';
import EmitirNotaCreditoButton from './EmitirNotaCreditoButton';
import { atualizarDataVencimento } from './actions';
import { toast } from 'sonner';

interface Cliente {
  nome: string;
  tipo: string;
  nif?: string;
  email?: string;
  telefone?: string;
  morada?: string;
}

interface VendaItem {
  id: string;
  produto_id: string;
  quantidade: number;
  preco_unitario: number;
  total_linha: number;
  produtos?: {
    nome: string;
  };
}

interface Fatura {
  id: string;
  numero: string;
  data_emissao: string;
  data_vencimento: string;
  total_com_iva: number;
  estado: string;
  cliente_id: string;
  venda_id: string;
  data_pagamento?: string;
  valor_pago?: number;
  tipo: 'FATURA' | 'NOTA_CREDITO';
  fatura_referenciada_id?: string;
}

interface FaturaReferenciada {
  numero: string;
  data_emissao: string;
}

interface Pagamento {
  id: string;
  data_pagamento: string;
  valor_pago: number;
  metodo_pagamento?: string;
  observacoes?: string;
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [fatura, setFatura] = useState<Fatura | null>(null);
  const [faturaReferenciada, setFaturaReferenciada] = useState<FaturaReferenciada | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [itens, setItens] = useState<VendaItem[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalPagamento, setModalPagamento] = useState(false);
  
  // Estados para edição da data de vencimento
  const [editandoVencimento, setEditandoVencimento] = useState(false);
  const [novaDataVencimento, setNovaDataVencimento] = useState('');
  const [salvandoVencimento, setSalvandoVencimento] = useState(false);

  const carregarDados = async () => {
    try {
      setLoading(true);

      // Carregar fatura com campos de pagamento, tipo e fatura_referenciada_id
      const { data: faturaData, error: faturaError } = await supabase
        .from('faturas')
        .select(`
          id,
          numero,
          data_emissao,
          data_vencimento,
          total_com_iva,
          estado,
          cliente_id,
          venda_id,
          data_pagamento,
          valor_pago,
          tipo,
          fatura_referenciada_id
        `)
        .eq('id', id)
        .single();

      if (faturaError || !faturaData) {
        console.error('Erro ao carregar fatura:', faturaError);
        setFatura(null);
        setLoading(false);
        return;
      }

      setFatura(faturaData);
      setNovaDataVencimento(faturaData.data_vencimento);

      // Se for nota de crédito e tiver fatura referenciada, carregar dados da fatura original
      if (faturaData.tipo === 'NOTA_CREDITO' && faturaData.fatura_referenciada_id) {
        const { data: faturaRefData } = await supabase
          .from('faturas')
          .select('numero, data_emissao')
          .eq('id', faturaData.fatura_referenciada_id)
          .single();

        if (faturaRefData) {
          setFaturaReferenciada(faturaRefData);
        }
      }

      // Carregar cliente
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('nome, tipo, nif, email, telefone, morada')
        .eq('id', faturaData.cliente_id)
        .single();

      if (clienteData) {
        setCliente(clienteData);
      }

      // Carregar itens da venda
      const { data: itensData, error: itensError } = await supabase
        .from('venda_itens')
        .select(`
          id,
          produto_id,
          quantidade,
          preco_unitario,
          total_linha,
          produtos (nome)
        `)
        .eq('venda_id', faturaData.venda_id);

      if (itensError) {
        console.error('Erro ao carregar itens da venda:', itensError);
        setItens([]);
      } else if (itensData) {
        console.log('✅ Itens carregados:', itensData);
        setItens(itensData as any);
      } else {
        console.log('⚠️ Nenhum item encontrado para venda_id:', faturaData.venda_id);
        setItens([]);
      }

      // Carregar histórico de pagamentos
      const { data: pagamentosData, error: pagamentosError } = await supabase
        .from('fatura_pagamentos')
        .select('id, data_pagamento, valor_pago, metodo_pagamento, observacoes')
        .eq('fatura_id', faturaData.id)
        .order('data_pagamento', { ascending: true });

      if (pagamentosError) {
        console.error('Erro ao carregar pagamentos:', pagamentosError);
        setPagamentos([]);
      } else {
        setPagamentos(pagamentosData || []);
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      carregarDados();
    }
  }, [id]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatDateForInput = (dateString: string) => {
    // Converte para formato YYYY-MM-DD para o input type="date"
    return dateString.split('T')[0];
  };

  // Função para obter label do status baseado no estado do banco
  const getStatusLabel = (estado: string) => {
    switch (estado) {
      case 'PAGA':
        return 'Paga';
      case 'PENDENTE':
        return 'Pendente';
      case 'PARCIAL':
        return 'Parcial';
      case 'CANCELADA':
        return 'Cancelada';
      default:
        return estado;
    }
  };

  const getStatusConfig = (estado: string) => {
    const configs = {
      PAGA: {
        badge: 'bg-green-100 text-green-800',
        icon: CheckCircle,
        label: 'Paga',
      },
      PARCIAL: {
        badge: 'bg-orange-100 text-orange-800',
        icon: Clock,
        label: 'Parcial',
      },
      PENDENTE: {
        badge: 'bg-yellow-100 text-yellow-800',
        icon: Clock,
        label: 'Pendente',
      },
      CANCELADA: {
        badge: 'bg-gray-100 text-gray-800',
        icon: AlertCircle,
        label: 'Cancelada',
      },
    };
    
    return configs[estado as keyof typeof configs] || configs.PENDENTE;
  };

  const getTipoBadge = (tipo: 'FATURA' | 'NOTA_CREDITO') => {
    if (tipo === 'NOTA_CREDITO') {
      return 'bg-purple-100 text-purple-800';
    }
    return 'bg-blue-100 text-blue-800';
  };

  const getTipoLabel = (tipo: 'FATURA' | 'NOTA_CREDITO') => {
    if (tipo === 'NOTA_CREDITO') {
      return 'Nota de Crédito';
    }
    return 'Fatura';
  };

  const podeRegistrarPagamento = (tipo: string, estado: string) => {
    // Não permitir pagamento em notas de crédito
    if (tipo === 'NOTA_CREDITO') {
      return false;
    }
    // Não permitir pagamento em faturas canceladas ou pagas
    return estado !== 'PAGA' && estado !== 'CANCELADA';
  };

  const podeEditarVencimento = (tipo: string, estado: string) => {
    // Não permitir edição em notas de crédito
    if (tipo === 'NOTA_CREDITO') {
      return false;
    }
    // Não permitir edição em faturas canceladas ou pagas
    return estado !== 'PAGA' && estado !== 'CANCELADA';
  };

  const handleSalvarVencimento = async () => {
    if (!fatura || !novaDataVencimento) return;

    setSalvandoVencimento(true);
    try {
      const resultado = await atualizarDataVencimento(fatura.id, novaDataVencimento);

      if (resultado.success) {
        toast.success('Data de vencimento atualizada com sucesso!');
        setEditandoVencimento(false);
        // Recarregar dados para mostrar a nova data
        await carregarDados();
      } else {
        toast.error(resultado.error || 'Erro ao atualizar data de vencimento');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro inesperado ao atualizar data de vencimento');
    } finally {
      setSalvandoVencimento(false);
    }
  };

  const handlePagamentoSucesso = () => {
    // Recarregar dados após pagamento
    carregarDados();
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando detalhes da fatura...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!fatura) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Fatura não encontrada</h2>
          <p className="text-gray-600 mb-6">A fatura que procura não existe ou foi removida.</p>
          <Link
            href="/faturas"
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar para faturas
          </Link>
        </div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(fatura.estado);
  const StatusIcon = statusConfig.icon;
  
  // Cálculo correto de Subtotal, IVA e Total
  const total = fatura.total_com_iva ?? 0;
  const subtotal = Math.round((total / 1.23) * 100) / 100;
  const iva = Math.round((total - subtotal) * 100) / 100;
  
  // Cálculo de valores de pagamento
  const totalPago = fatura.valor_pago || 0;
  const saldoEmAberto = Math.max(total - totalPago, 0);

  // Determinar título baseado no tipo
  const titulo = fatura.tipo === 'NOTA_CREDITO' ? `Nota de Crédito ${fatura.numero}` : `Fatura ${fatura.numero}`;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/faturas"
          className="inline-flex items-center gap-2 text-green-600 hover:text-green-700 font-semibold mb-4 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar para faturas
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {titulo}
            </h1>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${statusConfig.badge}`}>
                <StatusIcon className="w-4 h-4" />
                {statusConfig.label}
              </span>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getTipoBadge(fatura.tipo)}`}>
                {getTipoLabel(fatura.tipo)}
              </span>
            </div>
            
            {/* Se for nota de crédito e tiver fatura referenciada */}
            {fatura.tipo === 'NOTA_CREDITO' && faturaReferenciada && (
              <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                <span>Referente à fatura:</span>
                <Link
                  href={`/faturas/${fatura.fatura_referenciada_id}`}
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold"
                >
                  {faturaReferenciada.numero}
                  <ExternalLink className="w-4 h-4" />
                </Link>
                <span className="text-gray-400">({formatDate(faturaReferenciada.data_emissao)})</span>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            {podeRegistrarPagamento(fatura.tipo, fatura.estado) && (
              <button
                onClick={() => setModalPagamento(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
              >
                <CreditCard className="w-5 h-5" />
                Registrar Pagamento
              </button>
            )}
            
            {/* Botão Emitir Nota de Crédito */}
            <EmitirNotaCreditoButton
              faturaId={fatura.id}
              faturaNumero={fatura.numero}
              faturaEstado={fatura.estado}
              faturaTipo={fatura.tipo}
            />
          </div>
        </div>
      </div>

      {/* Datas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-100 p-3 rounded-xl">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Data de Emissão</p>
              <p className="text-lg font-bold text-gray-900">{formatDate(fatura.data_emissao)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-orange-100 p-3 rounded-xl">
              <Calendar className="w-6 h-6 text-orange-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600 mb-1">Data de Vencimento</p>
              
              {podeEditarVencimento(fatura.tipo, fatura.estado) ? (
                <div className="flex items-center gap-2">
                  {editandoVencimento ? (
                    <>
                      <input
                        type="date"
                        value={formatDateForInput(novaDataVencimento)}
                        onChange={(e) => setNovaDataVencimento(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      <button
                        onClick={handleSalvarVencimento}
                        disabled={salvandoVencimento}
                        className="inline-flex items-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm font-semibold rounded-lg transition-colors"
                      >
                        {salvandoVencimento ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Guardando...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            Guardar
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setEditandoVencimento(false);
                          setNovaDataVencimento(fatura.data_vencimento);
                        }}
                        disabled={salvandoVencimento}
                        className="px-3 py-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg transition-colors"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-bold text-gray-900">{formatDate(fatura.data_vencimento)}</p>
                      <button
                        onClick={() => setEditandoVencimento(true)}
                        className="ml-2 text-orange-600 hover:text-orange-700 text-sm font-semibold underline"
                      >
                        Editar
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-lg font-bold text-gray-900">{formatDate(fatura.data_vencimento)}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Resumo Financeiro */}
      <div className={`rounded-2xl shadow-lg p-6 mb-6 text-white ${
        fatura.tipo === 'NOTA_CREDITO' 
          ? 'bg-gradient-to-br from-purple-600 to-pink-600' 
          : 'bg-gradient-to-br from-green-600 to-emerald-600'
      }`}>
        <h2 className="text-xl font-bold mb-4">Resumo Financeiro</h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className={fatura.tipo === 'NOTA_CREDITO' ? 'text-purple-100' : 'text-green-100'}>Subtotal</span>
            <span className="text-2xl font-bold">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className={fatura.tipo === 'NOTA_CREDITO' ? 'text-purple-100' : 'text-green-100'}>IVA (23%)</span>
            <span className="text-xl font-semibold">{formatCurrency(iva)}</span>
          </div>
          <div className={`border-t pt-3 flex justify-between items-center ${
            fatura.tipo === 'NOTA_CREDITO' ? 'border-purple-400' : 'border-green-400'
          }`}>
            <span className="text-lg font-semibold">Total</span>
            <span className="text-3xl font-bold">{formatCurrency(total)}</span>
          </div>
          {totalPago > 0 && fatura.tipo !== 'NOTA_CREDITO' && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-green-100">Total Pago</span>
                <span className="text-xl font-semibold">{formatCurrency(totalPago)}</span>
              </div>
              <div className="border-t border-green-400 pt-3 flex justify-between items-center">
                <span className="text-lg font-semibold">Saldo em Aberto</span>
                <span className="text-3xl font-bold">{formatCurrency(saldoEmAberto)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Histórico de Pagamentos - não mostrar para notas de crédito */}
      {pagamentos.length > 0 && fatura.tipo !== 'NOTA_CREDITO' && (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-3 rounded-xl">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">Histórico de Pagamentos</h2>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Data do Pagamento</th>
                  <th className="text-right py-4 px-4 text-sm font-semibold text-gray-700">Valor Pago</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Método</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Observações</th>
                </tr>
              </thead>
              <tbody>
                {pagamentos.map((pagamento, index) => (
                  <tr
                    key={pagamento.id}
                    className={`border-b border-gray-100 ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                    }`}
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="font-semibold text-gray-900">
                          {formatDate(pagamento.data_pagamento)}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right font-bold text-green-600">
                      {formatCurrency(pagamento.valor_pago)}
                    </td>
                    <td className="py-4 px-4 text-gray-900">
                      {pagamento.metodo_pagamento || '-'}
                    </td>
                    <td className="py-4 px-6 text-gray-600 text-sm">
                      {pagamento.observacoes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dados do Cliente */}
      {cliente && (
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-purple-100 p-3 rounded-xl">
              <User className="w-6 h-6 text-purple-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Dados do Cliente</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Nome</p>
              <p className="font-semibold text-gray-900">{cliente.nome}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Tipo</p>
              <p className="font-semibold text-gray-900 capitalize">{cliente.tipo}</p>
            </div>
            {cliente.nif && (
              <div>
                <p className="text-sm text-gray-600">NIF</p>
                <p className="font-semibold text-gray-900">{cliente.nif}</p>
              </div>
            )}
            {cliente.email && (
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-semibold text-gray-900">{cliente.email}</p>
              </div>
            )}
            {cliente.telefone && (
              <div>
                <p className="text-sm text-gray-600">Telefone</p>
                <p className="font-semibold text-gray-900">{cliente.telefone}</p>
              </div>
            )}
            {cliente.morada && (
              <div className="sm:col-span-2">
                <p className="text-sm text-gray-600">Morada</p>
                <p className="font-semibold text-gray-900">{cliente.morada}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Itens da Venda */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className={`p-6 ${
          fatura.tipo === 'NOTA_CREDITO'
            ? 'bg-gradient-to-r from-purple-600 to-pink-600'
            : 'bg-gradient-to-r from-green-600 to-emerald-600'
        }`}>
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-3 rounded-xl">
              <Package className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">Itens da Venda</h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          {itens.length > 0 ? (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Produto</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-gray-700">Quantidade</th>
                  <th className="text-right py-4 px-4 text-sm font-semibold text-gray-700">Preço Unit.</th>
                  <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((item, index) => (
                  <tr
                    key={item.id}
                    className={`border-b border-gray-100 ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                    }`}
                  >
                    <td className="py-4 px-6">
                      <p className="font-semibold text-gray-900">
                        {item.produtos?.nome || 'Produto não informado'}
                      </p>
                    </td>
                    <td className="py-4 px-4 text-center text-gray-900">
                      {item.quantidade}
                    </td>
                    <td className="py-4 px-4 text-right text-gray-900">
                      {formatCurrency(item.preco_unitario)}
                    </td>
                    <td className="py-4 px-6 text-right font-semibold text-gray-900">
                      {formatCurrency(item.total_linha)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p>Nenhum item encontrado para esta venda</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Pagamento */}
      {modalPagamento && (
        <ModalPagamento
          fatura={{
            id: fatura.id,
            numero: fatura.numero,
            total_com_iva: fatura.total_com_iva,
            valor_pago: fatura.valor_pago,
          }}
          isOpen={modalPagamento}
          onClose={() => setModalPagamento(false)}
          onSuccess={handlePagamentoSucesso}
        />
      )}
    </div>
  );
}
