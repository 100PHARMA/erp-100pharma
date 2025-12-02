'use client';

import { useState } from 'react';
import { 
  Plus, Search, Filter, Download, Eye, Edit, Trash2, 
  FileText, ShoppingCart, CheckCircle, X, ChevronRight,
  AlertCircle, TrendingUp, Users, Package, Calendar
} from 'lucide-react';

// Tipos
type EstadoVenda = 'RASCUNHO' | 'ORÇAMENTO' | 'PEDIDO' | 'FATURADO';
type TipoCliente = 'FARMÁCIA' | 'PODOLOGISTA' | 'CLÍNICA';

interface Cliente {
  id: string;
  nome: string;
  tipo: TipoCliente;
  nif: string;
  limiteCredito: number;
  saldoAberto: number;
  condicaoPagamento: string;
  ativo: boolean;
}

interface Produto {
  id: string;
  nome: string;
  preco: number;
  iva: number;
  estoque: number;
  temIncentivo: boolean;
  temFundoFarmaceutico: boolean;
}

interface ItemVenda {
  id: string;
  produto: Produto;
  quantidade: number;
  precoUnitario: number;
  iva: number;
  totalSemIva: number;
  totalIva: number;
  totalComIva: number;
}

interface Venda {
  id: string;
  numero?: string;
  tipo: EstadoVenda;
  cliente: Cliente;
  vendedor: string;
  dataCriacao: Date;
  itens: ItemVenda[];
  totalSemIva: number;
  totalIva: number;
  totalComIva: number;
  estado: EstadoVenda;
  podologistaAssociado?: string;
}

interface Vendedor {
  id: string;
  nome: string;
  farmaciasCarteira: number;
  farmaciasAtivasMes: number;
  comissoesEstimadas: number;
}

// Dados mockados
const clientesMock: Cliente[] = [
  { id: '1', nome: 'Farmácia Central', tipo: 'FARMÁCIA', nif: '123456789', limiteCredito: 10000, saldoAberto: 2500, condicaoPagamento: '30 dias', ativo: true },
  { id: '2', nome: 'Clínica São José', tipo: 'CLÍNICA', nif: '987654321', limiteCredito: 15000, saldoAberto: 5000, condicaoPagamento: '60 dias', ativo: true },
  { id: '3', nome: 'Dr. João Silva', tipo: 'PODOLOGISTA', nif: '456789123', limiteCredito: 5000, saldoAberto: 1000, condicaoPagamento: '15 dias', ativo: true },
];

const produtosMock: Produto[] = [
  { id: '1', nome: 'Creme Hidratante 50ml', preco: 15.50, iva: 23, estoque: 100, temIncentivo: true, temFundoFarmaceutico: false },
  { id: '2', nome: 'Óleo Essencial 30ml', preco: 25.00, iva: 23, estoque: 50, temIncentivo: false, temFundoFarmaceutico: true },
  { id: '3', nome: 'Gel Podológico 100ml', preco: 18.75, iva: 23, estoque: 75, temIncentivo: true, temFundoFarmaceutico: true },
];

const vendedorMock: Vendedor = {
  id: '1',
  nome: 'Maria Santos',
  farmaciasCarteira: 45,
  farmaciasAtivasMes: 32,
  comissoesEstimadas: 2500
};

export default function VendasPage() {
  const [modalAberto, setModalAberto] = useState(false);
  const [etapaAtual, setEtapaAtual] = useState(1);
  const [vendas, setVendas] = useState<Venda[]>([]);
  
  // Estados do formulário
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [vendedorSelecionado, setVendedorSelecionado] = useState<Vendedor>(vendedorMock);
  const [itensVenda, setItensVenda] = useState<ItemVenda[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
  const [quantidade, setQuantidade] = useState(1);
  const [podologistaAssociado, setPodologistaAssociado] = useState('');
  const [associarPodologista, setAssociarPodologista] = useState(false);

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState<EstadoVenda | 'TODOS'>('TODOS');
  const [filtroCliente, setFiltroCliente] = useState('');
  const [busca, setBusca] = useState('');

  // Funções auxiliares
  const calcularTotais = (itens: ItemVenda[]) => {
    const totalSemIva = itens.reduce((acc, item) => acc + item.totalSemIva, 0);
    const totalIva = itens.reduce((acc, item) => acc + item.totalIva, 0);
    const totalComIva = itens.reduce((acc, item) => acc + item.totalComIva, 0);
    return { totalSemIva, totalIva, totalComIva };
  };

  const adicionarItem = () => {
    if (!produtoSelecionado || quantidade <= 0) return;

    const totalSemIva = produtoSelecionado.preco * quantidade;
    const totalIva = totalSemIva * (produtoSelecionado.iva / 100);
    const totalComIva = totalSemIva + totalIva;

    const novoItem: ItemVenda = {
      id: Date.now().toString(),
      produto: produtoSelecionado,
      quantidade,
      precoUnitario: produtoSelecionado.preco,
      iva: produtoSelecionado.iva,
      totalSemIva,
      totalIva,
      totalComIva
    };

    setItensVenda([...itensVenda, novoItem]);
    setProdutoSelecionado(null);
    setQuantidade(1);
  };

  const removerItem = (id: string) => {
    setItensVenda(itensVenda.filter(item => item.id !== id));
  };

  const proximaEtapa = () => {
    if (etapaAtual === 1 && !clienteSelecionado) {
      alert('Selecione um cliente');
      return;
    }
    if (etapaAtual === 3 && itensVenda.length === 0) {
      alert('Adicione pelo menos um produto');
      return;
    }
    setEtapaAtual(etapaAtual + 1);
  };

  const etapaAnterior = () => {
    setEtapaAtual(etapaAtual - 1);
  };

  const salvarVenda = (estado: EstadoVenda) => {
    if (!clienteSelecionado) return;

    const totais = calcularTotais(itensVenda);
    const novaVenda: Venda = {
      id: Date.now().toString(),
      numero: estado === 'FATURADO' ? `FT${Date.now()}` : undefined,
      tipo: estado,
      cliente: clienteSelecionado,
      vendedor: vendedorSelecionado.nome,
      dataCriacao: new Date(),
      itens: itensVenda,
      ...totais,
      estado,
      podologistaAssociado: associarPodologista ? podologistaAssociado : undefined
    };

    setVendas([...vendas, novaVenda]);
    fecharModal();
    alert(`${estado} criado com sucesso!`);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEtapaAtual(1);
    setClienteSelecionado(null);
    setItensVenda([]);
    setProdutoSelecionado(null);
    setQuantidade(1);
    setAssociarPodologista(false);
    setPodologistaAssociado('');
  };

  const vendasFiltradas = vendas.filter(venda => {
    const matchEstado = filtroEstado === 'TODOS' || venda.estado === filtroEstado;
    const matchCliente = !filtroCliente || venda.cliente.nome.toLowerCase().includes(filtroCliente.toLowerCase());
    const matchBusca = !busca || venda.cliente.nome.toLowerCase().includes(busca.toLowerCase()) || venda.numero?.toLowerCase().includes(busca.toLowerCase());
    return matchEstado && matchCliente && matchBusca;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                Vendas / Orçamentos / Pedidos
              </h1>
              <p className="text-gray-600">Gestão completa do ciclo de vendas</p>
            </div>
            <button
              onClick={() => setModalAberto(true)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 flex items-center gap-2 hover:scale-105"
            >
              <Plus className="w-5 h-5" />
              Nova Venda
            </button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-3 rounded-lg">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Vendas</p>
                  <p className="text-2xl font-bold text-blue-600">{vendas.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="bg-green-600 p-3 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Faturadas</p>
                  <p className="text-2xl font-bold text-green-600">
                    {vendas.filter(v => v.estado === 'FATURADO').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="bg-orange-600 p-3 rounded-lg">
                  <ShoppingCart className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Pedidos</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {vendas.filter(v => v.estado === 'PEDIDO').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="bg-purple-600 p-3 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Faturado</p>
                  <p className="text-2xl font-bold text-purple-600">
                    €{vendas.filter(v => v.estado === 'FATURADO').reduce((acc, v) => acc + v.totalComIva, 0).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar vendas..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as EstadoVenda | 'TODOS')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="TODOS">Todos os Estados</option>
              <option value="RASCUNHO">Rascunho</option>
              <option value="ORÇAMENTO">Orçamento</option>
              <option value="PEDIDO">Pedido</option>
              <option value="FATURADO">Faturado</option>
            </select>

            <input
              type="text"
              placeholder="Filtrar por cliente..."
              value={filtroCliente}
              onChange={(e) => setFiltroCliente(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            <button className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg flex items-center gap-2 justify-center transition-colors">
              <Filter className="w-5 h-5" />
              Mais Filtros
            </button>
          </div>
        </div>

        {/* Lista de Vendas */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Nº Documento</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Tipo</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Cliente</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Vendedor</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Data</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold">Total s/ IVA</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold">IVA</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold">Total c/ IVA</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold">Estado</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {vendasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                      <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                      <p className="text-lg font-semibold mb-2">Nenhuma venda encontrada</p>
                      <p className="text-sm">Clique em "Nova Venda" para começar</p>
                    </td>
                  </tr>
                ) : (
                  vendasFiltradas.map((venda) => (
                    <tr key={venda.id} className="hover:bg-blue-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {venda.numero || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{venda.tipo}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{venda.cliente.nome}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{venda.vendedor}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {venda.dataCriacao.toLocaleDateString('pt-PT')}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        €{venda.totalSemIva.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-600">
                        €{venda.totalIva.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                        €{venda.totalComIva.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                          venda.estado === 'FATURADO' ? 'bg-green-100 text-green-800' :
                          venda.estado === 'PEDIDO' ? 'bg-orange-100 text-orange-800' :
                          venda.estado === 'ORÇAMENTO' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {venda.estado}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button className="p-2 hover:bg-blue-100 rounded-lg transition-colors" title="Ver">
                            <Eye className="w-4 h-4 text-blue-600" />
                          </button>
                          <button className="p-2 hover:bg-green-100 rounded-lg transition-colors" title="Editar">
                            <Edit className="w-4 h-4 text-green-600" />
                          </button>
                          <button className="p-2 hover:bg-purple-100 rounded-lg transition-colors" title="Exportar">
                            <Download className="w-4 h-4 text-purple-600" />
                          </button>
                          {venda.estado !== 'FATURADO' && (
                            <button className="p-2 hover:bg-red-100 rounded-lg transition-colors" title="Eliminar">
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Nova Venda */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header do Modal */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-2xl">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold">Nova Venda</h2>
                  <p className="text-blue-100 text-sm mt-1">Etapa {etapaAtual} de 6</p>
                </div>
                <button
                  onClick={fecharModal}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Progress Bar */}
              <div className="mt-4 bg-white/20 rounded-full h-2">
                <div
                  className="bg-white h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(etapaAtual / 6) * 100}%` }}
                />
              </div>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6">
              {/* Etapa 1: Seleção do Cliente */}
              {etapaAtual === 1 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Users className="w-6 h-6 text-blue-600" />
                      Seleção do Cliente
                    </h3>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Cliente *
                    </label>
                    <select
                      value={clienteSelecionado?.id || ''}
                      onChange={(e) => {
                        const cliente = clientesMock.find(c => c.id === e.target.value);
                        setClienteSelecionado(cliente || null);
                      }}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Selecione um cliente</option>
                      {clientesMock.map((cliente) => (
                        <option key={cliente.id} value={cliente.id}>
                          {cliente.nome} - {cliente.tipo}
                        </option>
                      ))}
                    </select>
                  </div>

                  {clienteSelecionado && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">Tipo de Cliente</p>
                          <p className="font-semibold text-gray-900">{clienteSelecionado.tipo}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">NIF</p>
                          <p className="font-semibold text-gray-900">{clienteSelecionado.nif}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Condição de Pagamento</p>
                          <p className="font-semibold text-gray-900">{clienteSelecionado.condicaoPagamento}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Limite de Crédito</p>
                          <p className="font-semibold text-gray-900">€{clienteSelecionado.limiteCredito.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Saldo em Aberto</p>
                          <p className="font-semibold text-red-600">€{clienteSelecionado.saldoAberto.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Crédito Disponível</p>
                          <p className="font-semibold text-green-600">
                            €{(clienteSelecionado.limiteCredito - clienteSelecionado.saldoAberto).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {clienteSelecionado.saldoAberto > clienteSelecionado.limiteCredito * 0.8 && (
                        <div className="flex items-start gap-2 bg-orange-100 border border-orange-300 rounded-lg p-3">
                          <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-orange-900">Atenção ao Limite de Crédito</p>
                            <p className="text-xs text-orange-700 mt-1">
                              Cliente próximo do limite. Considere apenas orçamento.
                            </p>
                          </div>
                        </div>
                      )}

                      {!clienteSelecionado.ativo && (
                        <div className="flex items-start gap-2 bg-red-100 border border-red-300 rounded-lg p-3">
                          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-red-900">Cliente Inativo</p>
                            <p className="text-xs text-red-700 mt-1">
                              Cliente inativo por falta de compras. Confirmar continuação?
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Etapa 2: Vendedor */}
              {etapaAtual === 2 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Users className="w-6 h-6 text-blue-600" />
                      Identificação do Vendedor
                    </h3>
                  </div>

                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="bg-blue-600 p-3 rounded-full">
                        <Users className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Vendedor</p>
                        <p className="text-2xl font-bold text-gray-900">{vendedorSelecionado.nome}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mt-6">
                      <div className="bg-white rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-1">Farmácias na Carteira</p>
                        <p className="text-2xl font-bold text-blue-600">{vendedorSelecionado.farmaciasCarteira}</p>
                      </div>
                      <div className="bg-white rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-1">Ativas no Mês</p>
                        <p className="text-2xl font-bold text-green-600">{vendedorSelecionado.farmaciasAtivasMes}</p>
                      </div>
                      <div className="bg-white rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-1">Comissões Estimadas</p>
                        <p className="text-2xl font-bold text-purple-600">€{vendedorSelecionado.comissoesEstimadas}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Etapa 3: Produtos */}
              {etapaAtual === 3 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Package className="w-6 h-6 text-blue-600" />
                      Adição de Produtos
                    </h3>
                  </div>

                  {/* Adicionar Produto */}
                  <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Produto
                        </label>
                        <select
                          value={produtoSelecionado?.id || ''}
                          onChange={(e) => {
                            const produto = produtosMock.find(p => p.id === e.target.value);
                            setProdutoSelecionado(produto || null);
                          }}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Selecione um produto</option>
                          {produtosMock.map((produto) => (
                            <option key={produto.id} value={produto.id}>
                              {produto.nome} - €{produto.preco.toFixed(2)} (Estoque: {produto.estoque})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Quantidade
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={quantidade}
                          onChange={(e) => setQuantidade(parseInt(e.target.value) || 1)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {produtoSelecionado && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600">Preço Unit.</p>
                            <p className="font-semibold">€{produtoSelecionado.preco.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">IVA</p>
                            <p className="font-semibold">{produtoSelecionado.iva}%</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Estoque</p>
                            <p className={`font-semibold ${produtoSelecionado.estoque < quantidade ? 'text-red-600' : 'text-green-600'}`}>
                              {produtoSelecionado.estoque} un.
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600">Total</p>
                            <p className="font-semibold text-blue-600">
                              €{(produtoSelecionado.preco * quantidade * (1 + produtoSelecionado.iva / 100)).toFixed(2)}
                            </p>
                          </div>
                        </div>

                        {produtoSelecionado.estoque < quantidade && (
                          <div className="flex items-center gap-2 mt-2 text-orange-700">
                            <AlertCircle className="w-4 h-4" />
                            <p className="text-xs">Estoque insuficiente. Venda permitida com alerta.</p>
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      onClick={adicionarItem}
                      disabled={!produtoSelecionado || quantidade <= 0}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-5 h-5" />
                      Adicionar Item
                    </button>
                  </div>

                  {/* Lista de Itens */}
                  {itensVenda.length > 0 && (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Produto</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Qtd</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Preço</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">IVA</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Total</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {itensVenda.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900">{item.produto.nome}</td>
                              <td className="px-4 py-3 text-sm text-center text-gray-600">{item.quantidade}</td>
                              <td className="px-4 py-3 text-sm text-right text-gray-900">€{item.precoUnitario.toFixed(2)}</td>
                              <td className="px-4 py-3 text-sm text-right text-gray-600">€{item.totalIva.toFixed(2)}</td>
                              <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">€{item.totalComIva.toFixed(2)}</td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => removerItem(item.id)}
                                  className="p-1 hover:bg-red-100 rounded transition-colors"
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Etapa 4: Podologista */}
              {etapaAtual === 4 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Users className="w-6 h-6 text-blue-600" />
                      Associar Podologista (Opcional)
                    </h3>
                  </div>

                  {clienteSelecionado?.tipo === 'FARMÁCIA' ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="associarPodo"
                          checked={associarPodologista}
                          onChange={(e) => setAssociarPodologista(e.target.checked)}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <label htmlFor="associarPodo" className="text-sm font-semibold text-gray-700">
                          Associar podologista a esta venda
                        </label>
                      </div>

                      {associarPodologista && (
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Selecione o Podologista
                          </label>
                          <select
                            value={podologistaAssociado}
                            onChange={(e) => setPodologistaAssociado(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Selecione um podologista</option>
                            {clientesMock
                              .filter(c => c.tipo === 'PODOLOGISTA')
                              .map((podo) => (
                                <option key={podo.id} value={podo.id}>
                                  {podo.nome}
                                </option>
                              ))}
                          </select>

                          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-blue-900">
                              <strong>Incentivo Podologista:</strong> Ao associar um podologista, 
                              ele receberá incentivos trimestrais baseados no volume de vendas desta farmácia.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                      <p className="text-gray-600">
                        Associação de podologista disponível apenas para clientes do tipo FARMÁCIA.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Etapa 5: Resumo */}
              {etapaAtual === 5 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <FileText className="w-6 h-6 text-blue-600" />
                      Resumo Financeiro
                    </h3>
                  </div>

                  {/* Totais */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Subtotal sem IVA</p>
                        <p className="text-2xl font-bold text-gray-900">
                          €{calcularTotais(itensVenda).totalSemIva.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Total IVA</p>
                        <p className="text-2xl font-bold text-gray-900">
                          €{calcularTotais(itensVenda).totalIva.toFixed(2)}
                        </p>
                      </div>
                      <div className="col-span-2 border-t border-blue-300 pt-4 mt-2">
                        <p className="text-sm text-gray-600">Total com IVA</p>
                        <p className="text-4xl font-bold text-blue-600">
                          €{calcularTotais(itensVenda).totalComIva.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Informações Adicionais */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Incentivo Podologista</p>
                      <p className="text-xl font-bold text-green-600">
                        €{associarPodologista && podologistaAssociado ? (calcularTotais(itensVenda).totalSemIva * 0.05).toFixed(2) : '0.00'}
                      </p>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Fundo Farmacêutico</p>
                      <p className="text-xl font-bold text-purple-600">
                        €{(calcularTotais(itensVenda).totalSemIva * 0.03).toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Comissão Estimada</p>
                      <p className="text-xl font-bold text-orange-600">
                        €{(calcularTotais(itensVenda).totalSemIva * 0.08).toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Frascos Equivalentes</p>
                      <p className="text-xl font-bold text-blue-600">
                        {itensVenda.reduce((acc, item) => acc + item.quantidade, 0)}
                      </p>
                    </div>
                  </div>

                  {/* Status Crédito */}
                  {clienteSelecionado && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-sm font-semibold text-gray-700">Status do Limite de Crédito</p>
                        <p className="text-sm text-gray-600">
                          Vencimento: {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-PT')}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="bg-gray-200 rounded-full h-3">
                            <div
                              className={`h-3 rounded-full ${
                                (clienteSelecionado.saldoAberto + calcularTotais(itensVenda).totalComIva) / clienteSelecionado.limiteCredito > 0.9
                                  ? 'bg-red-500'
                                  : (clienteSelecionado.saldoAberto + calcularTotais(itensVenda).totalComIva) / clienteSelecionado.limiteCredito > 0.7
                                  ? 'bg-orange-500'
                                  : 'bg-green-500'
                              }`}
                              style={{
                                width: `${Math.min(
                                  ((clienteSelecionado.saldoAberto + calcularTotais(itensVenda).totalComIva) / clienteSelecionado.limiteCredito) * 100,
                                  100
                                )}%`
                              }}
                            />
                          </div>
                        </div>
                        <p className="text-sm font-semibold text-gray-900">
                          €{(clienteSelecionado.saldoAberto + calcularTotais(itensVenda).totalComIva).toFixed(2)} / €{clienteSelecionado.limiteCredito.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Botões de Ação */}
                  <div className="grid grid-cols-3 gap-4">
                    <button
                      onClick={() => salvarVenda('ORÇAMENTO')}
                      className="bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-colors"
                    >
                      Salvar como Orçamento
                    </button>
                    <button
                      onClick={() => salvarVenda('PEDIDO')}
                      className="bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-lg font-semibold transition-colors"
                    >
                      Transformar em Pedido
                    </button>
                    <button
                      onClick={() => setEtapaAtual(6)}
                      className="bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition-colors"
                    >
                      Faturar
                    </button>
                  </div>
                </div>
              )}

              {/* Etapa 6: Faturar */}
              {etapaAtual === 6 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                      Faturar (Gerar Documento Legal)
                    </h3>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                    <div className="text-center mb-6">
                      <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                      <h4 className="text-xl font-bold text-green-900 mb-2">Confirmação de Faturação</h4>
                      <p className="text-green-700">
                        Ao confirmar, será gerado um documento legal português com todos os dados necessários.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-white rounded-lg p-4 border">
                        <h5 className="font-semibold text-gray-900 mb-3">Dados da Empresa</h5>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600">Nome</p>
                            <p className="font-semibold">Empresa Exemplo, Lda</p>
                          </div>
                          <div>
                            <p className="text-gray-600">NIF</p>
                            <p className="font-semibold">123456789</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Morada</p>
                            <p className="font-semibold">Rua Exemplo, 123, Lisboa</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Contacto</p>
                            <p className="font-semibold">+351 123 456 789</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-4 border">
                        <h5 className="font-semibold text-gray-900 mb-3">Cliente</h5>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600">Nome</p>
                            <p className="font-semibold">{clienteSelecionado?.nome}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">NIF</p>
                            <p className="font-semibold">{clienteSelecionado?.nif}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Morada</p>
                            <p className="font-semibold">Morada do cliente</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Tipo</p>
                            <p className="font-semibold">{clienteSelecionado?.tipo}</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-4 border">
                        <h5 className="font-semibold text-gray-900 mb-3">Resumo da Fatura</h5>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Número da Fatura:</span>
                            <span className="font-semibold">FT{Date.now()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Data:</span>
                            <span className="font-semibold">{new Date().toLocaleDateString('pt-PT')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Total sem IVA:</span>
                            <span className="font-semibold">€{calcularTotais(itensVenda).totalSemIva.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">IVA:</span>
                            <span className="font-semibold">€{calcularTotais(itensVenda).totalIva.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between border-t pt-2">
                            <span className="text-gray-900 font-semibold">Total com IVA:</span>
                            <span className="font-bold text-green-600">€{calcularTotais(itensVenda).totalComIva.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h5 className="font-semibold text-blue-900 mb-2">Ações Automáticas</h5>
                        <ul className="text-sm text-blue-800 space-y-1">
                          <li>• Gerar PDF legal português</li>
                          <li>• Registrar saída de estoque</li>
                          <li>• Criar conta a receber</li>
                          <li>• Aplicar incentivos e comissões</li>
                          <li>• Atualizar ranking do concurso</li>
                          <li>• Enviar por email (opcional)</li>
                        </ul>
                      </div>
                    </div>

                    <div className="flex gap-4 mt-6">
                      <button
                        onClick={() => setEtapaAtual(5)}
                        className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-semibold transition-colors"
                      >
                        Voltar
                      </button>
                      <button
                        onClick={() => salvarVenda('FATURADO')}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition-colors"
                      >
                        Confirmar Faturação
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer com Navegação */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 rounded-b-2xl">
              <div className="flex justify-between">
                <button
                  onClick={etapaAnterior}
                  disabled={etapaAtual === 1}
                  className="px-6 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Anterior
                </button>

                {etapaAtual < 5 && (
                  <button
                    onClick={proximaEtapa}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
                  >
                    Seguinte
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}