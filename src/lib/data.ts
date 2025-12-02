// ======================================================================
// DADOS MOCKADOS - ERP 100PHARMA
// Sistema Completo de Gestão Comercial
// ======================================================================

import {
  Produto,
  MovimentacaoEstoque,
  Cliente,
  Vendedor,
  Venda,
  Fatura,
  ComissaoVendedor,
  Visita,
  ContaReceber,
  Concurso,
  ConfiguracaoEmpresa,
  ConfiguracaoFiscal,
  ParametrosFinanceiros,
  ConfiguracaoComissaoFase1,
  ConfiguracaoComissaoFase2,
  BonusVolumeMensal,
  BonusMarcoAnual,
  Fornecedor,
  Compra,
  Tarefa,
  Podologista,
  Quilometragem,
} from './types';

// ======================================================================
// CONFIGURAÇÕES GERAIS
// ======================================================================

export const configuracaoEmpresa: ConfiguracaoEmpresa = {
  id: '1',
  nomeEmpresa: '100PHARMA',
  nif: '123456789',
  morada: 'Rua das Flores, 123',
  codigoPostal: '1000-100',
  localidade: 'Lisboa',
  pais: 'Portugal',
  telefone: '+351 21 123 4567',
  email: 'geral@100pharma.pt',
  website: 'www.100fungo.com',
  iban: 'PT50 0000 0000 0000 0000 0000 0',
};

export const configuracaoFiscal: ConfiguracaoFiscal = {
  id: '1',
  tabelaIVA: [
    { id: '1', percentagem: 0, descricao: 'Isento', ativo: true },
    { id: '2', percentagem: 6, descricao: 'Taxa Reduzida', ativo: true },
    { id: '3', percentagem: 13, descricao: 'Taxa Intermédia', ativo: true },
    { id: '4', percentagem: 23, descricao: 'Taxa Normal', ativo: true },
  ],
  ivaPadrao: 23,
  seriesFatura: [
    { id: '1', serie: '2025A', ultimoNumero: 1250, ativo: true },
    { id: '2', serie: '2025B', ultimoNumero: 0, ativo: false },
  ],
};

export const parametrosFinanceiros: ParametrosFinanceiros = {
  id: '1',
  custoAquisicaoPadrao: 5.0,
  custoVariavelPadrao: 2.5,
  valorIncentivoPodologista: 1.0,
  valorFundoFarmaceuticoPorFrasco: 0.28,
  valorKm: 0.2,
  custoFixoMensal: 15000,
  capitalGiroIdeal: 50000,
};

export const comissaoFase1: ConfiguracaoComissaoFase1 = {
  id: '1',
  percentagem1: 5,
  limite1: 3000,
  percentagem2: 8,
  limite2: 7000,
  percentagem3: 10,
};

export const comissaoFase2: ConfiguracaoComissaoFase2 = {
  id: '1',
  modoComissaoVendedor: 'FASE2_AVANCADA',
  valorComissaoFarmaciaNova: 50,
  valorComissaoFarmaciaAtiva: 1.5,
  tetoMensalComissaoFarmaciaAtiva: 1500,
  limiteFarmaciasPorVendedor: 200,
};

export const bonusVolumeMensal: BonusVolumeMensal[] = [
  { id: '1', quantidadeFrascos: 10000, valorBonus: 500 },
  { id: '2', quantidadeFrascos: 20000, valorBonus: 1000 },
  { id: '3', quantidadeFrascos: 30000, valorBonus: 2000 },
  { id: '4', quantidadeFrascos: 40000, valorBonus: 3000 },
  { id: '5', quantidadeFrascos: 50000, valorBonus: 5000 },
];

export const bonusMarcoAnual: BonusMarcoAnual[] = [
  { id: '1', quantidadeNovasFarmacias: 100, valorBonus: 1000 },
  { id: '2', quantidadeNovasFarmacias: 250, valorBonus: 2500 },
  { id: '3', quantidadeNovasFarmacias: 500, valorBonus: 5000 },
  { id: '4', quantidadeNovasFarmacias: 750, valorBonus: 7000 },
  { id: '5', quantidadeNovasFarmacias: 1000, valorBonus: 10000 },
];

// ======================================================================
// PRODUTOS
// ======================================================================

export const produtosMock: Produto[] = [
  {
    id: '1',
    nome: '100FUNGO - Tratamento Antifúngico',
    descricao: 'Solução tópica para tratamento de micoses - Frasco 30ml',
    sku: '100FUNGO-30ML',
    categoria: 'Dermatologia',
    precoSemIVA: 18.50,
    taxaIVA: 6,
    custo: 8.20,
    estoque: 1250,
    estoqueMinimo: 500,
    ativo: true,
    dataCadastro: new Date('2024-01-10'),
  },
  {
    id: '2',
    nome: '100FUNGO - Spray Antifúngico',
    descricao: 'Spray para tratamento de micoses - 50ml',
    sku: '100FUNGO-SPRAY-50ML',
    categoria: 'Dermatologia',
    precoSemIVA: 22.00,
    taxaIVA: 6,
    custo: 10.50,
    estoque: 850,
    estoqueMinimo: 400,
    ativo: true,
    dataCadastro: new Date('2024-01-15'),
  },
  {
    id: '3',
    nome: 'Paracetamol 500mg',
    descricao: 'Analgésico e antitérmico - Caixa com 20 comprimidos',
    sku: 'PARA-500-20',
    categoria: 'Analgésicos',
    precoSemIVA: 10.50,
    taxaIVA: 6,
    custo: 4.20,
    estoque: 320,
    estoqueMinimo: 200,
    ativo: true,
    dataCadastro: new Date('2024-02-01'),
  },
  {
    id: '4',
    nome: 'Omeprazol 20mg',
    descricao: 'Antiácido - Caixa com 28 cápsulas',
    sku: 'OMEP-20-28',
    categoria: 'Gastroenterologia',
    precoSemIVA: 15.40,
    taxaIVA: 6,
    custo: 6.80,
    estoque: 180,
    estoqueMinimo: 150,
    ativo: true,
    dataCadastro: new Date('2024-02-10'),
  },
  {
    id: '5',
    nome: 'Vitamina D3 1000UI',
    descricao: 'Suplemento vitamínico - Caixa com 60 cápsulas',
    sku: 'VITD3-1000-60',
    categoria: 'Vitaminas',
    precoSemIVA: 12.90,
    taxaIVA: 6,
    custo: 5.50,
    estoque: 95,
    estoqueMinimo: 100,
    ativo: true,
    dataCadastro: new Date('2024-03-01'),
  },
];

// ======================================================================
// MOVIMENTAÇÕES DE ESTOQUE
// ======================================================================

export const movimentacoesEstoqueMock: MovimentacaoEstoque[] = [
  {
    id: '1',
    produtoId: '1',
    produtoNome: '100FUNGO - Tratamento Antifúngico',
    tipo: 'ENTRADA',
    quantidade: 500,
    estoqueAnterior: 750,
    estoqueNovo: 1250,
    motivo: 'Compra de fornecedor',
    responsavel: 'Ana Costa',
    dataMovimentacao: new Date('2024-03-15T10:30:00'),
    observacoes: 'Lote 2024-001 - Validade 12/2025'
  },
  {
    id: '2',
    produtoId: '1',
    produtoNome: '100FUNGO - Tratamento Antifúngico',
    tipo: 'SAIDA',
    quantidade: 50,
    estoqueAnterior: 1250,
    estoqueNovo: 1200,
    motivo: 'Venda - Fatura 2025A/001',
    responsavel: 'João Silva',
    dataMovimentacao: new Date('2024-03-16T14:20:00'),
  },
  {
    id: '3',
    produtoId: '2',
    produtoNome: '100FUNGO - Spray Antifúngico',
    tipo: 'ENTRADA',
    quantidade: 300,
    estoqueAnterior: 550,
    estoqueNovo: 850,
    motivo: 'Compra de fornecedor',
    responsavel: 'Ana Costa',
    dataMovimentacao: new Date('2024-03-14T09:15:00'),
    observacoes: 'Lote 2024-002'
  },
  {
    id: '4',
    produtoId: '3',
    produtoNome: 'Paracetamol 500mg',
    tipo: 'SAIDA',
    quantidade: 80,
    estoqueAnterior: 400,
    estoqueNovo: 320,
    motivo: 'Venda - Pedido múltiplas farmácias',
    responsavel: 'Maria Santos',
    dataMovimentacao: new Date('2024-03-17T11:45:00'),
  },
  {
    id: '5',
    produtoId: '4',
    produtoNome: 'Omeprazol 20mg',
    tipo: 'AJUSTE',
    quantidade: -20,
    estoqueAnterior: 200,
    estoqueNovo: 180,
    motivo: 'Inventário - Correção de contagem',
    responsavel: 'Ana Costa',
    dataMovimentacao: new Date('2024-03-13T16:00:00'),
    observacoes: 'Divergência identificada no inventário mensal'
  },
  {
    id: '6',
    produtoId: '5',
    produtoNome: 'Vitamina D3 1000UI',
    tipo: 'ENTRADA',
    quantidade: 150,
    estoqueAnterior: 45,
    estoqueNovo: 195,
    motivo: 'Compra de fornecedor',
    responsavel: 'Ana Costa',
    dataMovimentacao: new Date('2024-03-12T10:00:00'),
  },
  {
    id: '7',
    produtoId: '5',
    produtoNome: 'Vitamina D3 1000UI',
    tipo: 'SAIDA',
    quantidade: 100,
    estoqueAnterior: 195,
    estoqueNovo: 95,
    motivo: 'Venda - Clínica Dermatológica',
    responsavel: 'Carlos Oliveira',
    dataMovimentacao: new Date('2024-03-18T15:30:00'),
  },
  {
    id: '8',
    produtoId: '2',
    produtoNome: '100FUNGO - Spray Antifúngico',
    tipo: 'SAIDA',
    quantidade: 25,
    estoqueAnterior: 850,
    estoqueNovo: 825,
    motivo: 'Venda - Farmácia São João',
    responsavel: 'Maria Santos',
    dataMovimentacao: new Date('2024-03-19T09:00:00'),
  },
  {
    id: '9',
    produtoId: '3',
    produtoNome: 'Paracetamol 500mg',
    tipo: 'AJUSTE',
    quantidade: 5,
    estoqueAnterior: 315,
    estoqueNovo: 320,
    motivo: 'Ajuste - Produtos encontrados em estoque secundário',
    responsavel: 'Ana Costa',
    dataMovimentacao: new Date('2024-03-19T17:00:00'),
    observacoes: 'Produtos localizados no armazém B'
  },
  {
    id: '10',
    produtoId: '1',
    produtoNome: '100FUNGO - Tratamento Antifúngico',
    tipo: 'SAIDA',
    quantidade: 30,
    estoqueAnterior: 1200,
    estoqueNovo: 1170,
    motivo: 'Venda - Farmácia Central',
    responsavel: 'João Silva',
    dataMovimentacao: new Date('2024-03-20T10:15:00'),
  },
];

// ======================================================================
// CLIENTES
// ======================================================================

export const clientesMock: Cliente[] = [
  {
    id: '1',
    nome: 'Farmácia Central de Lisboa',
    tipo: 'Farmacia',
    nif: '500123456',
    morada: 'Av. da Liberdade, 250',
    codigoPostal: '1250-140',
    localidade: 'Lisboa',
    contacto: '+351 21 234 5678',
    email: 'geral@farmaciacentral.pt',
    condicaoPagamento: '30_DIAS',
    limiteCredito: 10000,
    status: 'ATIVO',
    dataCadastro: new Date('2024-01-15'),
    dataUltimaCompra: new Date('2024-03-18'),
    vendedorResponsavel: '1',
  },
  {
    id: '2',
    nome: 'Farmácia São João',
    tipo: 'Farmacia',
    nif: '500234567',
    morada: 'Rua de São João, 45',
    codigoPostal: '4000-450',
    localidade: 'Porto',
    contacto: '+351 22 345 6789',
    email: 'contacto@farmaciasaojoao.pt',
    condicaoPagamento: '60_DIAS',
    limiteCredito: 15000,
    status: 'ATIVO',
    dataCadastro: new Date('2024-01-20'),
    dataUltimaCompra: new Date('2024-03-17'),
    vendedorResponsavel: '2',
  },
  {
    id: '3',
    nome: 'Clínica Podológica Saúde dos Pés',
    tipo: 'Podologista',
    nif: '500345678',
    morada: 'Praça do Comércio, 12',
    codigoPostal: '1100-148',
    localidade: 'Lisboa',
    contacto: '+351 21 456 7890',
    email: 'clinica@saudedospes.pt',
    condicaoPagamento: 'PRONTO',
    limiteCredito: 5000,
    status: 'ATIVO',
    dataCadastro: new Date('2024-02-01'),
    dataUltimaCompra: new Date('2024-03-15'),
    vendedorResponsavel: '1',
  },
  {
    id: '4',
    nome: 'Farmácia Nova de Braga',
    tipo: 'Farmacia',
    nif: '500456789',
    morada: 'Av. Central, 89',
    codigoPostal: '4700-200',
    localidade: 'Braga',
    contacto: '+351 25 567 8901',
    email: 'info@farmacianovabraga.pt',
    condicaoPagamento: '30_DIAS',
    limiteCredito: 8000,
    status: 'PROSPECT',
    dataCadastro: new Date('2024-03-10'),
    vendedorResponsavel: '3',
  },
  {
    id: '5',
    nome: 'Clínica Dermatológica Coimbra',
    tipo: 'Clinica',
    nif: '500567890',
    morada: 'Rua da Sofia, 156',
    codigoPostal: '3000-390',
    localidade: 'Coimbra',
    contacto: '+351 23 678 9012',
    email: 'clinica@dermacoimbra.pt',
    condicaoPagamento: '90_DIAS',
    limiteCredito: 20000,
    status: 'ATIVO',
    dataCadastro: new Date('2024-02-15'),
    dataUltimaCompra: new Date('2024-03-16'),
    vendedorResponsavel: '2',
  },
];

// ======================================================================
// FORNECEDORES
// ======================================================================

export const fornecedoresMock: Fornecedor[] = [
  {
    id: '1',
    nome: 'Laboratórios Farmacêuticos Lda',
    nif: '501234567',
    morada: 'Rua Industrial, 45',
    codigoPostal: '2700-100',
    localidade: 'Amadora',
    pais: 'Portugal',
    contacto: '+351 21 987 6543',
    email: 'comercial@labfarm.pt',
    iban: 'PT50 0010 0000 1234 5678 9012 3',
    condicaoPagamento: '30_DIAS',
    ativo: true,
    dataCadastro: new Date('2024-01-05'),
  },
  {
    id: '2',
    nome: 'Distribuidora Médica Portugal',
    nif: '502345678',
    morada: 'Av. da República, 123',
    codigoPostal: '4000-200',
    localidade: 'Porto',
    pais: 'Portugal',
    contacto: '+351 22 876 5432',
    email: 'geral@distmedica.pt',
    iban: 'PT50 0020 0000 9876 5432 1098 7',
    condicaoPagamento: '60_DIAS',
    ativo: true,
    dataCadastro: new Date('2024-01-10'),
  },
];

// ======================================================================
// COMPRAS
// ======================================================================

export const comprasMock: Compra[] = [
  {
    id: '1',
    numeroCompra: 'CMP-2024-001',
    fornecedorId: '1',
    fornecedorNome: 'Laboratórios Farmacêuticos Lda',
    itens: [
      {
        produtoId: '1',
        produtoNome: '100FUNGO - Tratamento Antifúngico',
        quantidade: 500,
        custoUnitario: 8.20,
        subtotal: 4100.00,
      },
    ],
    subtotal: 4100.00,
    totalIVA: 246.00,
    total: 4346.00,
    dataCompra: new Date('2024-03-15'),
    dataEntregaPrevista: new Date('2024-03-20'),
    estado: 'RECEBIDO',
    responsavel: 'Ana Costa',
  },
];

// ======================================================================
// VENDEDORES
// ======================================================================

export const vendedoresMock: Vendedor[] = [
  {
    id: '1',
    nome: 'João Silva',
    email: 'joao.silva@100pharma.pt',
    telefone: '+351 91 234 5678',
    nif: '123456789',
    morada: 'Rua das Acácias, 12',
    codigoPostal: '1000-001',
    localidade: 'Lisboa',
    perfil: 'VENDEDOR',
    salarioBase: 1200,
    ativo: true,
    dataAdmissao: new Date('2023-06-01'),
    metaMensal: 25000,
    comissaoAtual: 2850,
    totalVendasMes: 28500,
    totalFarmaciasAtivas: 45,
    totalNovasFarmacias: 8,
    totalKmMes: 1250,
    carteiraClientes: ['1', '3'],
  },
  {
    id: '2',
    nome: 'Maria Santos',
    email: 'maria.santos@100pharma.pt',
    telefone: '+351 92 345 6789',
    nif: '234567890',
    morada: 'Av. Central, 89',
    codigoPostal: '4000-100',
    localidade: 'Porto',
    perfil: 'VENDEDOR',
    salarioBase: 1200,
    ativo: true,
    dataAdmissao: new Date('2023-08-15'),
    metaMensal: 30000,
    comissaoAtual: 3420,
    totalVendasMes: 34200,
    totalFarmaciasAtivas: 52,
    totalNovasFarmacias: 12,
    totalKmMes: 1850,
    carteiraClientes: ['2', '5'],
  },
  {
    id: '3',
    nome: 'Carlos Oliveira',
    email: 'carlos.oliveira@100pharma.pt',
    telefone: '+351 93 456 7890',
    nif: '345678901',
    morada: 'Rua Nova, 56',
    codigoPostal: '4700-100',
    localidade: 'Braga',
    perfil: 'VENDEDOR',
    salarioBase: 1200,
    ativo: true,
    dataAdmissao: new Date('2024-01-10'),
    metaMensal: 20000,
    comissaoAtual: 1680,
    totalVendasMes: 16800,
    totalFarmaciasAtivas: 28,
    totalNovasFarmacias: 5,
    totalKmMes: 980,
    carteiraClientes: ['4'],
  },
  {
    id: '4',
    nome: 'Ana Costa',
    email: 'ana.costa@100pharma.pt',
    telefone: '+351 91 567 8901',
    nif: '456789012',
    morada: 'Praça da República, 1',
    codigoPostal: '1000-200',
    localidade: 'Lisboa',
    perfil: 'GERENTE',
    salarioBase: 2500,
    ativo: true,
    dataAdmissao: new Date('2023-01-05'),
    metaMensal: 0,
    comissaoAtual: 0,
    totalVendasMes: 0,
    totalFarmaciasAtivas: 0,
    totalNovasFarmacias: 0,
    totalKmMes: 0,
    carteiraClientes: [],
  },
];

// ======================================================================
// TAREFAS
// ======================================================================

export const tarefasMock: Tarefa[] = [
  {
    id: '1',
    titulo: 'Follow-up Farmácia Central',
    descricao: 'Ligar para confirmar recebimento do pedido',
    prioridade: 'ALTA',
    responsavelId: '1',
    responsavelNome: 'João Silva',
    clienteId: '1',
    clienteNome: 'Farmácia Central de Lisboa',
    dataInicio: new Date('2024-03-20'),
    dataVencimento: new Date('2024-03-25'),
    estado: 'PENDENTE',
    notificacoes: true,
  },
];

// ======================================================================
// PODOLOGISTAS
// ======================================================================

export const podologistasMock: Podologista[] = [
  {
    id: '1',
    nome: 'Dr. Pedro Almeida',
    nif: '123456789',
    contacto: '+351 91 234 5678',
    email: 'pedro.almeida@clinica.pt',
    morada: 'Rua das Flores, 45',
    codigoPostal: '1000-100',
    localidade: 'Lisboa',
    ativo: true,
    dataCadastro: new Date('2024-01-15'),
    totalVendas: 450,
    totalIncentivos: 450.00,
  },
];

// ======================================================================
// QUILOMETRAGEM
// ======================================================================

export const quilometragensMock: Quilometragem[] = [
  {
    id: '1',
    vendedorId: '1',
    vendedorNome: 'João Silva',
    mes: 3,
    ano: 2024,
    totalKm: 1250,
    valorPorKm: 0.20,
    totalReembolso: 250.00,
    status: 'APROVADO',
  },
];

// ======================================================================
// VENDAS
// ======================================================================

export const vendasMock: Venda[] = [
  {
    id: '1',
    numeroVenda: 'VND-2024-001',
    clienteId: '1',
    clienteNome: 'Farmácia Central de Lisboa',
    vendedorId: '1',
    vendedorNome: 'João Silva',
    itens: [
      {
        produtoId: '1',
        produtoNome: '100FUNGO - Tratamento Antifúngico',
        quantidade: 50,
        precoUnitario: 18.50,
        taxaIVA: 6,
        subtotal: 925.00,
        valorIVA: 55.50,
        total: 980.50,
      },
    ],
    subtotal: 925.00,
    descontoPercentual: 0,
    descontoValor: 0,
    totalSemIVA: 925.00,
    totalIVA: 55.50,
    total: 980.50,
    dataVenda: new Date('2024-03-15T10:30:00'),
    status: 'FATURADO',
    faturaId: '1',
  },
];

// ======================================================================
// FATURAS
// ======================================================================

export const faturasMock: Fatura[] = [
  {
    id: '1',
    numeroFatura: '2025A/001',
    serieFatura: '2025A',
    vendaId: '1',
    clienteId: '1',
    clienteNome: 'Farmácia Central de Lisboa',
    clienteNIF: '500123456',
    clienteMorada: 'Av. da Liberdade, 250, 1250-140 Lisboa',
    dataEmissao: new Date('2024-03-15'),
    dataVencimento: new Date('2024-04-14'),
    condicaoPagamento: '30_DIAS',
    subtotal: 925.00,
    totalIVA: 55.50,
    total: 980.50,
    incentivoPodologista: 0,
    fundoFarmaceutico: 14.00,
    status: 'PAGO',
    formaPagamento: 'Transferência Bancária',
    dataPagamento: new Date('2024-03-20'),
  },
];

// ======================================================================
// COMISSÕES
// ======================================================================

export const comissoesMock: ComissaoVendedor[] = [
  {
    id: '1',
    vendedorId: '1',
    vendedorNome: 'João Silva',
    mes: 3,
    ano: 2024,
    totalVendas: 28500,
    comissaoFase1: 2280,
    comissaoFase2FarmaciasNovas: 400,
    comissaoFase2FarmaciasAtivas: 67.50,
    bonusVolume: 0,
    bonusMarcos: 0,
    totalComissao: 2747.50,
    status: 'CALCULADA',
  },
];

// ======================================================================
// VISITAS
// ======================================================================

export const visitasMock: Visita[] = [
  {
    id: '1',
    vendedorId: '1',
    vendedorNome: 'João Silva',
    clienteId: '1',
    clienteNome: 'Farmácia Central de Lisboa',
    dataVisita: new Date('2024-03-15'),
    horaInicio: '10:00',
    horaFim: '11:30',
    kmInicial: 12500,
    kmFinal: 12525,
    kmTotal: 25,
    valorKm: 0.20,
    totalKm: 5.00,
    objetivo: 'Apresentação de novos produtos',
    resultado: 'Pedido fechado',
    fotosExposicao: [],
    status: 'REALIZADA',
  },
];

// ======================================================================
// CONTAS A RECEBER
// ======================================================================

export const contasReceberMock: ContaReceber[] = [
  {
    id: '1',
    faturaId: '1',
    numeroFatura: '2025A/001',
    clienteId: '1',
    clienteNome: 'Farmácia Central de Lisboa',
    dataEmissao: new Date('2024-03-15'),
    dataVencimento: new Date('2024-04-14'),
    valor: 980.50,
    valorPago: 980.50,
    valorPendente: 0,
    status: 'PAGO',
    diasAtraso: 0,
    faixaAging: '0-30',
  },
];

// ======================================================================
// CONCURSOS
// ======================================================================

export const concursosMock: Concurso[] = [
  {
    id: '1',
    nome: 'Campanha 100FUNGO - Primavera 2024',
    descricao: 'Concurso de vendas do produto 100FUNGO durante o trimestre',
    dataInicio: new Date('2024-03-01'),
    dataFim: new Date('2024-05-31'),
    tipo: 'VENDAS',
    metaObjetivo: 50000,
    premios: [
      { posicao: 1, descricao: '1º Lugar', valor: 2000 },
      { posicao: 2, descricao: '2º Lugar', valor: 1000 },
      { posicao: 3, descricao: '3º Lugar', valor: 500 },
    ],
    participantes: ['1', '2', '3'],
    status: 'ATIVO',
  },
];

// ======================================================================
// METAS
// ======================================================================

export const metasMock = [
  {
    id: '1',
    vendedorId: '1',
    vendedorNome: 'João Silva',
    mesAno: '2024-03',
    metaVendas: 25000,
    realizadoVendas: 28500,
    percentualVendas: 114,
    metaNovasFarmacias: 10,
    realizadoNovasFarmacias: 8,
    percentualNovasFarmacias: 80,
    metaVisitas: 50,
    realizadoVisitas: 45,
    percentualVisitas: 90,
    status: 'ATINGIDA',
  },
  {
    id: '2',
    vendedorId: '2',
    vendedorNome: 'Maria Santos',
    mesAno: '2024-03',
    metaVendas: 30000,
    realizadoVendas: 34200,
    percentualVendas: 114,
    metaNovasFarmacias: 12,
    realizadoNovasFarmacias: 12,
    percentualNovasFarmacias: 100,
    metaVisitas: 60,
    realizadoVisitas: 58,
    percentualVisitas: 97,
    status: 'ATINGIDA',
  },
  {
    id: '3',
    vendedorId: '3',
    vendedorNome: 'Carlos Oliveira',
    mesAno: '2024-03',
    metaVendas: 20000,
    realizadoVendas: 16800,
    percentualVendas: 84,
    metaNovasFarmacias: 8,
    realizadoNovasFarmacias: 5,
    percentualNovasFarmacias: 63,
    metaVisitas: 40,
    realizadoVisitas: 35,
    percentualVisitas: 88,
    status: 'NAO_ATINGIDA',
  },
];
