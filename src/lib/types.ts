// ======================================================================
// TIPOS DO ERP 100PHARMA - Sistema Completo de Gestão Comercial
// ======================================================================

// ======================================================================
// MÓDULO 1 - CONFIGURAÇÕES GERAIS
// ======================================================================

export interface ConfiguracaoEmpresa {
  id: string;
  nomeEmpresa: string;
  nif: string;
  morada: string;
  codigoPostal: string;
  localidade: string;
  pais: string;
  telefone: string;
  email: string;
  website: string;
  iban: string;
}

export interface ConfiguracaoFiscal {
  id: string;
  tabelaIVA: TaxaIVA[];
  ivaPadrao: number;
  seriesFatura: SerieFatura[];
}

export interface TaxaIVA {
  id: string;
  percentagem: number;
  descricao: string;
  ativo: boolean;
}

export interface SerieFatura {
  id: string;
  serie: string; // ex: "2025A"
  ultimoNumero: number;
  ativo: boolean;
}

export interface ParametrosFinanceiros {
  id: string;
  custoAquisicaoPadrao: number;
  custoVariavelPadrao: number;
  valorIncentivoPodologista: number; // 1€ por frasco
  valorFundoFarmaceuticoPorFrasco: number; // 0.28€
  valorKm: number; // 0.20€/km
  custoFixoMensal: number;
  capitalGiroIdeal: number;
}

export interface ConfiguracaoComissaoFase1 {
  id: string;
  percentagem1: number; // 5%
  limite1: number; // 3000€
  percentagem2: number; // 8%
  limite2: number; // 7000€
  percentagem3: number; // 10%
}

export interface ConfiguracaoComissaoFase2 {
  id: string;
  modoComissaoVendedor: 'FASE1_FAIXAS' | 'FASE2_AVANCADA';
  valorComissaoFarmaciaNova: number; // 50€
  valorComissaoFarmaciaAtiva: number; // 1.50€
  tetoMensalComissaoFarmaciaAtiva: number; // 1500€
  limiteFarmaciasPorVendedor: number; // 200
}

export interface BonusVolumeMensal {
  id: string;
  quantidadeFrascos: number;
  valorBonus: number;
}

export interface BonusMarcoAnual {
  id: string;
  quantidadeNovasFarmacias: number;
  valorBonus: number;
}

// ======================================================================
// MÓDULO 2 - PRODUTOS & ESTOQUE
// ======================================================================

export interface Produto {
  id: string;
  nome: string;
  descricao: string;
  sku: string;
  categoria: string;
  precoSemIVA: number;
  taxaIVA: number;
  custo: number;
  estoque: number;
  estoqueMinimo: number;
  ativo: boolean;
  dataCadastro: Date;
  dataAtualizacao?: Date;
}

export interface MovimentacaoEstoque {
  id: string;
  produtoId: string;
  produtoNome: string;
  tipo: 'ENTRADA' | 'SAIDA' | 'AJUSTE';
  quantidade: number;
  estoqueAnterior: number;
  estoqueNovo: number;
  motivo: string;
  responsavel: string;
  dataMovimentacao: Date;
  observacoes?: string;
}

// ======================================================================
// MÓDULO 3 - CLIENTES (FARMÁCIAS, PODOLOGISTAS, CLÍNICAS)
// ======================================================================

export type TipoCliente = 'Farmacia' | 'Podologista' | 'Clinica' | 'Consumidor';
export type StatusCliente = 'PROSPECT' | 'ATIVO' | 'EM_RISCO' | 'INATIVO';
export type CondicaoPagamento = 'PRONTO' | '30_DIAS' | '60_DIAS' | '90_DIAS';

export interface Cliente {
  id: string;
  nome: string;
  tipo: TipoCliente;
  nif: string;
  morada: string;
  codigoPostal: string;
  localidade: string;
  contacto: string;
  email: string;
  condicaoPagamento: CondicaoPagamento;
  limiteCredito: number;
  status: StatusCliente;
  dataCadastro: Date;
  dataUltimaCompra?: Date;
  vendedorResponsavel?: string;
  observacoes?: string;
}

export interface HistoricoCliente {
  id: string;
  clienteId: string;
  tipo: 'VENDA' | 'VISITA' | 'TAREFA' | 'OBSERVACAO';
  descricao: string;
  valor?: number;
  data: Date;
  responsavel: string;
}

// ======================================================================
// MÓDULO 4 - FORNECEDORES & COMPRAS
// ======================================================================

export interface Fornecedor {
  id: string;
  nome: string;
  nif: string;
  morada: string;
  codigoPostal: string;
  localidade: string;
  pais: string;
  contacto: string;
  email: string;
  iban: string;
  condicaoPagamento: CondicaoPagamento;
  ativo: boolean;
  dataCadastro: Date;
  observacoes?: string;
}

export interface ItemCompra {
  produtoId: string;
  produtoNome: string;
  quantidade: number;
  custoUnitario: number;
  subtotal: number;
}

export interface Compra {
  id: string;
  numeroCompra: string;
  fornecedorId: string;
  fornecedorNome: string;
  itens: ItemCompra[];
  subtotal: number;
  totalIVA: number;
  total: number;
  dataCompra: Date;
  dataEntregaPrevista?: Date;
  estado: 'RASCUNHO' | 'CONFIRMADO' | 'RECEBIDO' | 'CANCELADO';
  responsavel: string;
  observacoes?: string;
}

// ======================================================================
// MÓDULO 5 - VENDEDORES
// ======================================================================

export type PerfilAcesso = 'ADMIN' | 'GERENTE' | 'FINANCEIRO' | 'VENDEDOR';

export interface Vendedor {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  nif: string;
  morada: string;
  codigoPostal: string;
  localidade: string;
  perfil: PerfilAcesso;
  salarioBase: number;
  ativo: boolean;
  dataAdmissao: Date;
  metaMensal: number;
  comissaoAtual: number;
  totalVendasMes: number;
  totalFarmaciasAtivas: number;
  totalNovasFarmacias: number;
  totalKmMes: number;
  carteiraClientes: string[]; // IDs dos clientes (máx 200)
  observacoes?: string;
}

export interface PainelVendedor {
  vendedorId: string;
  vendedorNome: string;
  mes: number;
  ano: number;
  faturacao: number;
  volume: number;
  percentualMeta: number;
  kmPercorridos: number;
  comissoes: number;
  novasFarmacias: number;
  farmaciasAtivas: number;
}

// ======================================================================
// MÓDULO 6 - AGENDA E TAREFAS
// ======================================================================

export type PrioridadeTarefa = 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';
export type EstadoTarefa = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA';

export interface Tarefa {
  id: string;
  titulo: string;
  descricao: string;
  prioridade: PrioridadeTarefa;
  responsavelId: string;
  responsavelNome: string;
  clienteId?: string;
  clienteNome?: string;
  dataInicio: Date;
  dataVencimento: Date;
  dataConclusao?: Date;
  estado: EstadoTarefa;
  notificacoes: boolean;
  observacoes?: string;
}

// ======================================================================
// MÓDULO 7 - VISITAS & QUILOMETRAGEM
// ======================================================================

export interface Visita {
  id: string;
  vendedorId: string;
  vendedorNome: string;
  clienteId: string;
  clienteNome: string;
  dataVisita: Date;
  horaInicio: string;
  horaFim: string;
  kmInicial?: number;
  kmFinal?: number;
  kmTotal: number;
  valorKm: number;
  totalKm: number;
  objetivo: string;
  resultado: string;
  proximaAcao?: string;
  fotosExposicao: string[]; // URLs das fotos (máx 3)
  status: 'AGENDADA' | 'REALIZADA' | 'CANCELADA';
  observacoes?: string;
}

export interface Quilometragem {
  id: string;
  vendedorId: string;
  vendedorNome: string;
  mes: number;
  ano: number;
  totalKm: number;
  valorPorKm: number;
  totalReembolso: number;
  status: 'PENDENTE' | 'APROVADO' | 'PAGO';
}

// ======================================================================
// MÓDULO 8 - PODOLOGISTAS & INCENTIVOS
// ======================================================================

export interface Podologista {
  id: string;
  nome: string;
  nif: string;
  contacto: string;
  email: string;
  morada: string;
  codigoPostal: string;
  localidade: string;
  ativo: boolean;
  dataCadastro: Date;
  totalVendas: number;
  totalIncentivos: number;
  observacoes?: string;
}

export interface IncentivoPodologista {
  id: string;
  podologistaId: string;
  podologistaNome: string;
  vendaId: string;
  numeroFatura: string;
  quantidadeFrascos: number;
  valorPorFrasco: number;
  totalIncentivo: number;
  trimestre: number;
  ano: number;
  dataPagamento?: Date;
  status: 'PENDENTE' | 'APROVADO' | 'PAGO';
}

// ======================================================================
// MÓDULO 9 - VENDAS, PEDIDOS E FATURAS
// ======================================================================

export type StatusPedido = 'ORCAMENTO' | 'PEDIDO' | 'FATURADO' | 'CANCELADO';

export interface ItemVenda {
  produtoId: string;
  produtoNome: string;
  quantidade: number;
  precoUnitario: number;
  taxaIVA: number;
  subtotal: number;
  valorIVA: number;
  total: number;
}

export interface Venda {
  id: string;
  numero: string;
  numeroVenda?: string;
  clienteId: string;
  clienteNome: string;
  vendedorId: string;
  vendedorNome: string;
  podologistaId?: string;
  podologistaNome?: string;
  itens: ItemVenda[];
  subtotal: number;
  descontoPercentual?: number;
  descontoValor?: number;
  totalSemIVA?: number;
  iva?: number;
  totalIVA?: number;
  total: number;
  dataVenda: Date;
  status: StatusPedido;
  numeroFatura?: string;
  dataFaturamento?: Date;
  faturaId?: string;
  observacoes?: string;
}

export interface Fatura {
  id: string;
  numero: string;
  numeroFatura?: string;
  serieFatura?: string;
  vendaId: string;
  clienteId: string;
  clienteNome: string;
  clienteNIF?: string;
  clienteMorada?: string;
  dataEmissao: Date;
  dataVencimento: Date;
  condicaoPagamento?: CondicaoPagamento;
  subtotal?: number;
  totalIVA?: number;
  valor: number;
  total: number;
  valorPago: number;
  incentivoPodologista?: number;
  fundoFarmaceutico?: number;
  status: 'PAGO' | 'PENDENTE' | 'VENCIDO' | 'CANCELADO';
  formaPagamento?: string;
  dataPagamento?: Date;
  observacoes?: string;
}

// ======================================================================
// MÓDULO 10 - CONTAS A RECEBER
// ======================================================================

export type StatusContaReceber = 'ABERTO' | 'PARCIAL' | 'PAGO' | 'VENCIDO';
export type FaixaAging = '0-30' | '31-60' | '61-90' | '90+';

export interface ContaReceber {
  id: string;
  faturaId: string;
  numeroFatura: string;
  clienteId: string;
  clienteNome: string;
  dataEmissao: Date;
  dataVencimento: Date;
  valor: number;
  valorPago: number;
  valorPendente: number;
  status: StatusContaReceber;
  diasAtraso: number;
  faixaAging: FaixaAging;
}

export interface PagamentoRecebido {
  id: string;
  contaReceberId: string;
  faturaId: string;
  valor: number;
  formaPagamento: string;
  dataPagamento: Date;
  responsavel: string;
  observacoes?: string;
}

export interface AgingReport {
  faixa: FaixaAging;
  quantidade: number;
  valor: number;
}

// ======================================================================
// MÓDULO 11 - COMISSÕES
// ======================================================================

export interface ComissaoVendedor {
  id: string;
  vendedorId: string;
  vendedorNome: string;
  mes: number;
  ano: number;
  totalVendas: number;
  comissaoFase1: number;
  comissaoFase2FarmaciasNovas: number;
  comissaoFase2FarmaciasAtivas: number;
  bonusVolume: number;
  bonusMarcos: number;
  totalComissao: number;
  status: 'CALCULADA' | 'APROVADA' | 'PAGA';
  dataPagamento?: Date;
}

// ======================================================================
// MÓDULO 12 - METAS
// ======================================================================

export interface Meta {
  id: string;
  vendedorId: string;
  vendedorNome: string;
  mesAno: string;
  metaVendas: number;
  realizadoVendas: number;
  percentualVendas: number;
  metaNovasFarmacias: number;
  realizadoNovasFarmacias: number;
  percentualNovasFarmacias: number;
  metaVisitas: number;
  realizadoVisitas: number;
  percentualVisitas: number;
  status: 'ATINGIDA' | 'NAO_ATINGIDA' | 'EM_ANDAMENTO';
}

// ======================================================================
// MÓDULO 13 - CONCURSOS
// ======================================================================

export interface Concurso {
  id: string;
  nome: string;
  descricao: string;
  dataInicio: Date;
  dataFim: Date;
  tipo: 'VENDAS' | 'NOVAS_FARMACIAS' | 'VISITAS' | 'MISTO';
  metaObjetivo: number;
  premios: PremiosConcurso[];
  participantes: string[]; // IDs dos vendedores
  status: 'ATIVO' | 'ENCERRADO' | 'CANCELADO';
}

export interface PremiosConcurso {
  posicao: number;
  descricao: string;
  valor: number;
}

export interface ResultadoConcurso {
  id: string;
  concursoId: string;
  vendedorId: string;
  vendedorNome: string;
  pontuacao: number;
  posicao: number;
  premiado: boolean;
  valorPremio?: number;
}

// ======================================================================
// MÓDULO 14 - DASHBOARD & KPIs
// ======================================================================

export interface KPI {
  titulo: string;
  valor: string | number;
  variacao?: number;
  descricao?: string;
  icone: string;
  cor: string;
}

export interface DashboardData {
  faturamentoTotal: number;
  faturamentoMes: number;
  totalVendas: number;
  totalClientes: number;
  totalProdutos: number;
  estoqueTotal: number;
  produtosEstoqueBaixo: number;
  contasReceber: number;
  contasVencidas: number;
  metaAtingida: number;
}

// ======================================================================
// MÓDULO 15 - AUTENTICAÇÃO
// ======================================================================

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilAcesso;
  vendedorId?: string;
  ativo: boolean;
  ultimoAcesso?: Date;
}

export interface SessaoUsuario {
  usuario: Usuario;
  token: string;
  expiraEm: Date;
}
