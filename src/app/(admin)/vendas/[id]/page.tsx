import { supabase } from '@/lib/supabase';
import { ArrowLeft, Package, User, Calendar, Receipt, AlertCircle } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import FinalizarVendaButton from './FinalizarVendaButton';

// ======================================================================
// TIPOS
// ======================================================================

type EstadoVenda = 'ORCAMENTO' | 'ABERTA' | 'FECHADA' | 'CANCELADA';

interface Cliente {
  id: string;
  nome: string;
  tipo: string;
  nif: string;
  email: string;
  telefone: string;
}

interface Vendedor {
  id: string;
  nome: string;
  email: string;
}

interface Produto {
  id: string;
  nome: string;
  preco: number;
}

interface ItemVenda {
  id: string;
  produto_id: string;
  quantidade: number;
  preco_unitario: number;
  total_linha: number;
  produtos: Produto;
}

interface Venda {
  id: string;
  numero: string;
  cliente_id: string;
  vendedor_id: string;
  data: string;
  estado: EstadoVenda;
  subtotal: number;
  iva: number;
  total_com_iva: number;
  observacoes: string;
  created_at: string;
  updated_at: string;
  clientes: Cliente;
  vendedores: Vendedor;
  venda_itens: ItemVenda[];
}

interface Fatura {
  id: string;
  numero: string;
  venda_id: string;
  estado: string;
  total_com_iva: number;
}

// ======================================================================
// COMPONENTE PRINCIPAL (SERVER COMPONENT)
// ======================================================================

export default async function VendaDetalhesPage({
  params,
}: {
  params: { id: string };
}) {
  const vendaId = params.id;

  // ======================================================================
  // CARREGAMENTO SERVER-SIDE
  // ======================================================================

  // Carregar venda com relacionamentos
  const { data: venda, error: vendaError } = await supabase
    .from('vendas')
    .select(`
      *,
      clientes (id, nome, tipo, nif, email, telefone),
      vendedores (id, nome, email),
      venda_itens (
        id,
        produto_id,
        quantidade,
        preco_unitario,
        total_linha,
        produtos (id, nome, preco)
      )
    `)
    .eq('id', vendaId)
    .single();

  if (vendaError || !venda) {
    notFound();
  }

  // Se a venda está fechada, buscar a fatura associada
  let fatura: Fatura | null = null;
  if (venda.estado === 'FECHADA') {
    const { data: faturaData } = await supabase
      .from('faturas')
      .select('id, numero, venda_id, estado, total_com_iva')
      .eq('venda_id', vendaId)
      .single();

    if (faturaData) {
      fatura = faturaData;
    }
  }

  // ======================================================================
  // RENDERIZAÇÃO
  // ======================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/vendas"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar
            </Link>

            <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
              venda.estado === 'FECHADA' ? 'bg-green-100 text-green-800' :
              venda.estado === 'ABERTA' ? 'bg-orange-100 text-orange-800' :
              venda.estado === 'ORCAMENTO' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {venda.estado}
            </span>
          </div>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                Venda {venda.numero}
              </h1>
              <p className="text-gray-600">
                Criada em {new Date(venda.created_at).toLocaleDateString('pt-PT')}
              </p>
            </div>

            {/* Botão Finalizar Venda - Client Component */}
            <FinalizarVendaButton
              vendaId={venda.id}
              estadoInicial={venda.estado}
              vendaNumero={venda.numero}
            />
          </div>
        </div>

        {/* Informações do Cliente e Vendedor */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Cliente */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-100 p-3 rounded-lg">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Cliente</h2>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-600">Nome</p>
                <p className="text-lg font-semibold text-gray-900">{venda.clientes.nome}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Tipo</p>
                <p className="text-gray-900">{venda.clientes.tipo}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">NIF</p>
                <p className="text-gray-900">{venda.clientes.nif}</p>
              </div>
              {venda.clientes.email && (
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="text-gray-900">{venda.clientes.email}</p>
                </div>
              )}
              {venda.clientes.telefone && (
                <div>
                  <p className="text-sm text-gray-600">Telefone</p>
                  <p className="text-gray-900">{venda.clientes.telefone}</p>
                </div>
              )}
            </div>
          </div>

          {/* Vendedor */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-purple-100 p-3 rounded-lg">
                <User className="w-6 h-6 text-purple-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Vendedor</h2>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-600">Nome</p>
                <p className="text-lg font-semibold text-gray-900">{venda.vendedores.nome}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="text-gray-900">{venda.vendedores.email}</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">Data da venda:</span>
              </div>
              <p className="text-lg font-semibold text-gray-900 mt-1">
                {new Date(venda.data).toLocaleDateString('pt-PT', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Itens da Venda */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-orange-100 p-3 rounded-lg">
              <Package className="w-6 h-6 text-orange-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Itens da Venda</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Produto</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Quantidade</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Preço Unitário</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {venda.venda_itens.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {item.produtos.nome}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-gray-600">
                      {item.quantidade}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">
                      €{item.preco_unitario.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                      €{item.total_linha.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totais */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Resumo Financeiro</h2>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Subtotal (sem IVA)</span>
              <span className="text-2xl font-bold text-gray-900">
                €{venda.subtotal.toFixed(2)}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600">IVA (23%)</span>
              <span className="text-2xl font-bold text-gray-900">
                €{venda.iva.toFixed(2)}
              </span>
            </div>
            
            <div className="border-t-2 border-blue-300 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-lg text-gray-700 font-semibold">Total com IVA</span>
                <span className="text-4xl font-bold text-blue-600">
                  €{venda.total_com_iva.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Observações */}
        {venda.observacoes && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Observações</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{venda.observacoes}</p>
          </div>
        )}

        {/* Fatura Associada */}
        {fatura && (
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-green-600 p-3 rounded-lg">
                  <Receipt className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Fatura Emitida</h2>
                  <p className="text-gray-600">Número: {fatura.numero}</p>
                </div>
              </div>
              
              <Link
                href={`/faturas/${fatura.id}`}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors flex items-center gap-2"
              >
                <Receipt className="w-5 h-5" />
                Ver Fatura
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
